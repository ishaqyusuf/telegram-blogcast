import {
	type QueryClient,
	type QueryKey,
	dehydrate,
	hydrate,
} from "@tanstack/react-query";
import superjson from "superjson";

const VERSION = 1;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRY_CHARS = 400_000;
const MAX_TOTAL_CHARS = 2_000_000;
const MAX_QUERIES = 80;
const CONTENT_ROUTES = new Set([
	"blog.getBlog",
	"blog.posts",
	"album.getAlbum",
	"album.getAlbumTracks",
	"album.getAlbums",
	"album.getAlbumPlaybackQueue",
	"channel.getChannels",
]);
export const FEED_STATE_KEY = ["mobile-feed-state"] as const;

export function isPersistedContentKey(key: QueryKey) {
	if (key[0] === FEED_STATE_KEY[0]) return true;
	if (!Array.isArray(key[0])) return false;
	const route = key[0].join(".");
	// Background feed probes are intentionally not the visible feed snapshot.
	return (
		CONTENT_ROUTES.has(route) &&
		(route !== "blog.posts" ||
			(key[1] as { type?: string })?.type === "infinite")
	);
}

export interface ContentCacheStorage {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<unknown>;
	removeItem(key: string): Promise<unknown>;
}

export function createContentQueryCache(
	client: QueryClient,
	storage: ContentCacheStorage,
	scope: string,
) {
	const prefix = `content-cache:${VERSION}:${scope}:`;
	const manifestKey = `${prefix}manifest`;
	let previousKeys: string[] = [];
	let writes = Promise.resolve();

	async function restore() {
		try {
			const raw = await storage.getItem(manifestKey);
			if (!raw) return;
			const manifest = JSON.parse(raw);
			if (
				manifest.version !== VERSION ||
				!Array.isArray(manifest.keys) ||
				manifest.keys.length > MAX_QUERIES ||
				manifest.savedAt < Date.now() - MAX_AGE
			)
				return;
			previousKeys = manifest.keys.filter(
				(key: unknown): key is string =>
					typeof key === "string" && key.startsWith(prefix),
			);
			const records = await Promise.all(
				previousKeys.map(async (key) => {
					try {
						const record = await storage.getItem(key);
						if (!record || record.length > MAX_ENTRY_CHARS) return null;
						const query =
							superjson.parse<ReturnType<typeof dehydrate>["queries"][number]>(
								record,
							);
						if (
							!isPersistedContentKey(query.queryKey) ||
							!query.state?.dataUpdatedAt ||
							query.state.dataUpdatedAt < Date.now() - MAX_AGE
						)
							return null;
						return query;
					} catch {
						return null;
					}
				}),
			);
			hydrate(
				client,
				{ mutations: [], queries: records.filter((q) => q !== null) },
				{ defaultOptions: { deserializeData: (data) => data } },
			);
		} catch {
			/* A disposable cache must never prevent startup. */
		}
	}

	function save() {
		writes = writes
			.then(async () => {
				const snapshot = dehydrate(client, {
					shouldDehydrateMutation: () => false,
					shouldDehydrateQuery: (query) =>
						isPersistedContentKey(query.queryKey) &&
						query.state.data !== undefined &&
						query.state.dataUpdatedAt >= Date.now() - MAX_AGE,
					serializeData: (data) => data,
				});
				const generation = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
				const keys: string[] = [];
				let total = 0;
				for (const query of snapshot.queries.sort(
					(a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt,
				)) {
					// Retain successful content even if its background refresh failed.
					const { promise: _promise, ...record } = query;
					let data = record.state.data;
					if (
						data &&
						typeof data === "object" &&
						"pages" in data &&
						"pageParams" in data
					) {
						const pages = data as { pages: unknown[]; pageParams: unknown[] };
						data = {
							...data,
							pages: pages.pages.slice(0, 5),
							pageParams: pages.pageParams.slice(0, 5),
						};
					}
					const value = superjson.stringify({
						...record,
						state: {
							...record.state,
							data,
							error: null,
							fetchFailureCount: 0,
							fetchFailureReason: null,
							fetchStatus: "idle",
							status: "success",
						},
					});
					if (
						value.length > MAX_ENTRY_CHARS ||
						total + value.length > MAX_TOTAL_CHARS
					)
						continue;
					const key = `${prefix}${generation}:${keys.length}`;
					await storage.setItem(key, value);
					keys.push(key);
					total += value.length;
					if (keys.length >= MAX_QUERIES) break;
				}
				await storage.setItem(
					manifestKey,
					JSON.stringify({ version: VERSION, savedAt: Date.now(), keys }),
				);
				const oldKeys = previousKeys;
				previousKeys = keys;
				await Promise.all(
					oldKeys.map((key) => storage.removeItem(key).catch(() => undefined)),
				);
			})
			.catch(() => undefined);
		return writes;
	}
	return { restore, save };
}
