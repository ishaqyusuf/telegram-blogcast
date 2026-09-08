import { expect, test } from "bun:test";
import { bookRoutes } from "./book.routes";

test("saved page summaries are book-scoped, bounded and omit full page content", async () => {
	let args: any;
	const caller = bookRoutes.createCaller({
		db: {
			bookPage: {
				findMany: async (input: any) => {
					args = input;
					return [
						{
							id: 9,
							bookId: 3,
							shamelaPageNo: 106,
							printedPageNo: 83,
							paragraphs: [{ text: "  Opening\nline " + "x".repeat(700) }],
						},
					];
				},
			},
		} as any,
	});
	const result = await caller.getSavedPageSummaries({
		bookId: 3,
		pageIds: [9],
	});
	expect(args.where).toEqual({ id: { in: [9] }, bookId: 3, deletedAt: null });
	expect(args.select.paragraphs).toEqual({
		orderBy: { pid: "asc" },
		take: 1,
		select: { text: true },
	});
	expect(result[0]?.preview.length).toBe(500);
	expect(result[0]?.sourcePageNo).toBe(106);
	expect(result[0]?.pageNo).toBe(83);
	await expect(
		caller.getSavedPageSummaries({ bookId: 3, pageIds: Array(101).fill(9) }),
	).rejects.toThrow();
});
