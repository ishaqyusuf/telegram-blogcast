import { expect, test } from "bun:test";
import { bookChapterRoutes } from "./book-chapter.routes";

test("tree snapshot is book scoped and only selects lean hierarchy metadata", async () => {
	let args: any;
	const caller = bookChapterRoutes.createCaller({
		db: {
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
	await expect(caller.tree({ bookId: -1 })).rejects.toThrow();
});
