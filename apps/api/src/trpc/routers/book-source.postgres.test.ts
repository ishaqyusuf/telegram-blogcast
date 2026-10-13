import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@acme/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { bookSourceRoutes } from "./book-source.routes";

const testUrl = process.env.BOOK_SOURCE_IMPORT_TEST_DATABASE_URL;
if (testUrl) {
	const url = new URL(testUrl);
	if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/alghurobaa_source_import_test")
		throw new Error("Book source route tests require the dedicated localhost test database.");
}
const db = testUrl ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) }) : null;
const owner = "1".repeat(64);
const stranger = "2".repeat(64);
const caller = (ownerHash?: string) => bookSourceRoutes.createCaller({ db: db as any, bookImportOwnerHash: ownerHash });
const realFetch = globalThis.fetch;
let savedTriggerKey: string | undefined;

beforeAll(() => {
	// Never enqueue real Trigger runs from tests; dispatch failure exercises the saved outbox path.
	savedTriggerKey = process.env.TRIGGER_SECRET_KEY;
	process.env.TRIGGER_SECRET_KEY = "";
});
afterEach(() => {
	globalThis.fetch = realFetch;
});
afterAll(async () => {
	process.env.TRIGGER_SECRET_KEY = savedTriggerKey;
	await db?.$disconnect();
});

const stubFetch = (handler: (url: URL) => Response) => {
	globalThis.fetch = (async (input: string | URL | Request) => handler(new URL(input instanceof Request ? input.url : input))) as typeof fetch;
};

test.skipIf(!db)("duplicate starts share one saved job and only the owner can manage it", async () => {
	const sourceBookId = randomInt(1_000_000, 1_900_000_000);
	const first = await caller(owner).start({ sourceBookId });
	const second = await caller(stranger).start({ sourceBookId });
	expect(second.id).toBe(first.id);
	expect(first).toMatchObject({ status: "queued", canManage: true, errorMessage: expect.stringContaining("Waiting for the import worker") });
	expect(second).toMatchObject({ canManage: false, errorMessage: null, errorCode: null });

	const concurrent = await Promise.all([1, 2, 3].map(() => caller(owner).start({ sourceBookId: sourceBookId + 1 })));
	expect(new Set(concurrent.map((job) => job.id)).size).toBe(1);

	await expect(caller(stranger).cancel({ importId: first.id })).rejects.toThrow("Only the device");
	await expect(caller(stranger).retry({ importId: first.id })).rejects.toThrow("Only the device");
	await expect(caller().start({ sourceBookId })).rejects.toThrow("Update the app");

	const cancelled = await caller(owner).cancel({ importId: first.id });
	expect(cancelled.status).toBe("cancelled");
	const restarted = await caller(owner).start({ sourceBookId });
	expect(restarted.id).not.toBe(first.id);
	await expect(caller(owner).retry({ importId: first.id })).rejects.toThrow("already being imported");
	await caller(owner).cancel({ importId: restarted.id });

	const retried = await caller(owner).retry({ importId: first.id });
	expect(retried).toMatchObject({ status: "queued", generation: 2, canManage: true });
	expect((await caller(owner).mine({ limit: 20 })).some((job) => job.id === first.id)).toBe(true);
	expect(await caller().mine({ limit: 5 })).toEqual([]);
});

test.skipIf(!db)("previews explain missing text and mark books already in the library", async () => {
	const sourceBookId = randomInt(1_000_000, 1_900_000_000);
	stubFetch(() => new Response("<!DOCTYPE html><title>CMS</title>", { status: 404 }));
	const missing = await caller(owner).preview({ sourceBookId });
	expect(missing).toMatchObject({ available: false, unavailableReason: "This book is not available on KetabOnline.", localBookId: null });

	const blog = await db!.blog.create({ data: { type: "book" } });
	const book = await db!.book.create({ data: { blogId: blog.id, sourceProvider: "ketabonline", sourceBookId, sourceType: "ketabonline", editable: false } });
	stubFetch((url) => {
		expect(url.searchParams.get("q")).toBe("رياض الصالحين");
		return Response.json({
			status: true,
			code: 200,
			meta: { current_page: 1, last_page: 2, total: 11 },
			data: [{ id: sourceBookId, title: "رياض <em>الصالحين</em>", pages_count: 19, parts_count: 1 }],
		});
	});
	const search = await caller().search({ query: "رياض الصالحين" });
	expect(search).toMatchObject({ hasMore: true, items: [{ id: sourceBookId, localBookId: book.id }] });

	stubFetch(() => new Response("upstream down", { status: 503 }));
	await expect(caller().search({ query: "رياض" })).rejects.toMatchObject({ code: "BAD_GATEWAY" });
	stubFetch(() => new Response("<html>not json</html>", { status: 200 }));
	await expect(caller().preview({ sourceBookId })).rejects.toMatchObject({ code: "BAD_GATEWAY" });
});
