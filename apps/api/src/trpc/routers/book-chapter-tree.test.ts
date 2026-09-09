import { expect, test } from "bun:test";
import { bookChapterRoutes } from "./book-chapter.routes";

test("tree snapshot is book scoped and only selects lean hierarchy metadata", async () => {
	let args: any;
	let transactionOptions: any;
	const database: any = {
		book: { findFirstOrThrow: async () => ({ id: 3, shamelaId: 23833, tocStatus: "complete", sourceType: "shamela", ownerUserId: 1, editable: false, blog: { published: true } }) },
	};
	const caller = bookChapterRoutes.createCaller({
		db: {
			async $transaction(work: any, options: any) { transactionOptions = options; return work({ ...database, bookTocNode: this.bookTocNode }); },
			bookTocNode: {
				findMany: async (input: any) => {
					args = input;
					return [
						{
							id: 1,
							parentId: null,
							title: "Chapter",
							sortOrder: 0,
							shamelaPageNo: 106,
						},
					];
				},
			},
		} as any,
	});
	const result = await caller.tree({ bookId: 3 });
	expect(args.where).toEqual({
		bookId: 3,
		deletedAt: null,
		book: { deletedAt: null },
	});
	expect(Object.keys(args.select).sort()).toEqual([
		"id",
		"parentId",
		"shamelaPageNo",
		"sortOrder",
		"title",
	]);
	expect(result.items[0]?.sourcePageNo).toBe(106);
	expect(result.items[0]).not.toHaveProperty("url");
	expect(result.cache).toMatchObject({ bookId: 3, sourceBookId: 23833, complete: true, nodeCount: 1, exportable: true });
	expect(result.cache.revision).toMatch(/^[a-f0-9]{64}$/);
	expect(transactionOptions).toEqual({ isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 10_000 });
	database.book.findFirstOrThrow = async () => ({ id: 3, shamelaId: 23833, tocStatus: "pending", sourceType: "user", ownerUserId: 7 });
	const pending = await caller.tree({ bookId: 3 });
	expect(pending.cache.complete).toBe(false);
	expect(pending.cache.exportable).toBe(false);
	await expect(caller.tree({ bookId: -1 })).rejects.toThrow();
});
