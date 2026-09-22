import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import { FEED_STATE_KEY, createContentQueryCache } from "./content-query-cache";

function storage() {
	const records = new Map<string, string>();
	return {
		records,
		getItem: async (key: string) => records.get(key) ?? null,
		setItem: async (key: string, value: string) => {
			records.set(key, value);
		},
		removeItem: async (key: string) => {
			records.delete(key);
		},
	};
}
const detail = [["blog", "getBlog"], { input: { id: 42 }, type: "query" }];
const feed = [
	["blog", "posts"],
	{ input: { category: "all" }, type: "infinite" },
];

describe("durable mobile content", () => {
	test("restores detail, dates, feed and scroll state into a new process before network", async () => {
		const disk = storage();
		const first = new QueryClient();
		const date = new Date("2026-09-20T10:00:00Z");
		first.setQueryData(detail, { id: 42, date });
		first.setQueryData(feed, {
			pages: [{ data: [{ id: 42 }], meta: { cursor: 41 } }],
			pageParams: [null],
		});
		first.setQueryData(FEED_STATE_KEY, {
			category: "audio",
			offsets: { audio: 240 },
		});
		await createContentQueryCache(first, disk, "production").save();
		const restarted = new QueryClient({
			defaultOptions: { hydrate: { deserializeData: superjson.deserialize } },
		});
		await createContentQueryCache(restarted, disk, "production").restore();
		expect(restarted.getQueryData(detail)).toEqual({ id: 42, date });
		expect(restarted.getQueryData(feed)).toEqual(first.getQueryData(feed));
		expect(restarted.getQueryData(FEED_STATE_KEY)).toEqual(
			first.getQueryData(FEED_STATE_KEY),
		);
		expect(restarted.isFetching()).toBe(0);
	});
	test("never persists auth, local-service state, or background probes", async () => {
		const disk = storage();
		const client = new QueryClient();
		for (const route of ["auth", "getFetcherState", "posts"])
			client.setQueryData([["blog", route], { type: "query" }], "private");
		await createContentQueryCache(client, disk, "one").save();
		const restarted = new QueryClient();
		await createContentQueryCache(restarted, disk, "one").restore();
		expect(restarted.getQueryCache().getAll()).toHaveLength(0);
	});
	test("corrupt entries do not discard healthy entries; different environments stay isolated", async () => {
		const disk = storage();
		const client = new QueryClient();
		client.setQueryData(detail, { id: 42 });
		client.setQueryData(feed, { pages: [], pageParams: [] });
		await createContentQueryCache(client, disk, "one").save();
		const key = [...disk.records.keys()].find(
			(key) => !key.endsWith("manifest"),
		);
		expect(key).toBeDefined();
		if (!key) throw new Error("Expected a persisted cache entry");
		disk.records.set(key, "broken");
		const restarted = new QueryClient();
		await createContentQueryCache(restarted, disk, "one").restore();
		expect(restarted.getQueryCache().getAll()).toHaveLength(1);
		const other = new QueryClient();
		await createContentQueryCache(other, disk, "two").restore();
		expect(other.getQueryCache().getAll()).toHaveLength(0);
	});
	test("bounds retained pages while preserving corresponding pagination cursors", async () => {
		const disk = storage();
		const client = new QueryClient();
		client.setQueryData(feed, {
			pages: Array.from({ length: 10 }, (_, id) => ({ data: [{ id }] })),
			pageParams: [null, 1, 2, 3, 4, 5, 6, 7, 8, 9],
		});
		await createContentQueryCache(client, disk, "one").save();
		const restarted = new QueryClient();
		await createContentQueryCache(restarted, disk, "one").restore();
		const result = restarted.getQueryData<{
			pages: unknown[];
			pageParams: unknown[];
		}>(feed);
		expect(result).toBeDefined();
		if (!result) throw new Error("Expected the feed cache to restore");
		expect(result.pages).toHaveLength(5);
		expect(result.pageParams).toEqual([null, 1, 2, 3, 4]);
	});
	test("failed background refresh retains previously readable content", async () => {
		const disk = storage();
		const client = new QueryClient();
		client.setQueryData(detail, { id: 42 });
		await client
			.fetchQuery({
				queryKey: detail,
				queryFn: () => Promise.reject(new Error("offline")),
				retry: false,
				staleTime: 0,
			})
			.catch(() => {});
		await createContentQueryCache(client, disk, "one").save();
		const restarted = new QueryClient();
		await createContentQueryCache(restarted, disk, "one").restore();
		expect(restarted.getQueryData(detail)).toEqual({ id: 42 });
		expect(restarted.getQueryState(detail)?.status).toBe("success");
	});
});
