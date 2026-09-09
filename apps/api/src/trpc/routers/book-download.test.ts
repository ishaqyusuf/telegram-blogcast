import { expect, test } from "bun:test";
import { bookRoutes } from "./book.routes";

test("download manifest contains only bounded metadata from a consistent snapshot", async () => {
	let options: any;
	let aggregate: any;
	const caller = bookRoutes.createCaller({ db: {
		async $transaction(work: any, input: any) {
			options = input;
			return work({
				book: { findFirstOrThrow: async () => ({ id: 3, nameAr: null, nameEn: "Book", shamelaId: 23833, contentHash: "hash", pagesUpdatedAt: null }) },
				bookPage: { aggregate: async (args: any) => { aggregate = args; return { _count: { id: 2 }, _max: { id: 13, updatedAt: new Date("2026-09-08T00:00:00Z") } }; } },
			});
		},
	} as any });
	const manifest = await caller.getBookDownloadManifest({ bookId: 3 });
	expect(manifest).toMatchObject({ bookId: 3, maxPageId: 13, totalPages: 2, sourceBookId: 23833 });
	expect(manifest).not.toHaveProperty("pages");
	expect(aggregate.where).toEqual({ bookId: 3, deletedAt: null, status: "fetched" });
	expect(options).toEqual({ isolationLevel: "RepeatableRead" });
});

test("download IDs are book-scoped, bounded by the snapshot, and paginated without offsets", async () => {
	let args: any;
	const caller = bookRoutes.createCaller({ db: { bookPage: { findMany: async (input: any) => { args = input; return [{ id: 12 }]; } } } as any });
	expect(await caller.getBookDownloadPageIds({ bookId: 3, afterId: 10, maxPageId: 13, limit: 20 })).toEqual([{ id: 12 }]);
	expect(args.where.id).toEqual({ gt: 10, lte: 13 });
	expect(args.where.bookId).toBe(3); expect(args.where.status).toBe("fetched");
	expect(args.select).toEqual({ id: true }); expect(args.take).toBe(20);
	await expect(caller.getBookDownloadPageIds({ bookId: 3, afterId: 0, maxPageId: 13, limit: 51 })).rejects.toThrow();
});
