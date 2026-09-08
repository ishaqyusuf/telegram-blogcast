import { expect, test } from "bun:test";
import { savedTextPreview, sortSavedItems } from "./book-saved-items";

test("saved items follow source page order across volumes without mutating input", () => {
	const items = [
		{ pageId: 3, sourcePageNo: 300, pageNo: 2 },
		{ pageId: 1, sourcePageNo: 106, pageNo: 83, startOffset: 10 },
		{ pageId: 1, sourcePageNo: 106, pageNo: 83, startOffset: 2 },
		{ pageId: 4 },
	];
	expect(
		sortSavedItems(items).map((row) => [row.pageId, row.startOffset]),
	).toEqual([
		[1, 2],
		[1, 10],
		[3, undefined],
		[4, undefined],
	]);
	expect(items[0]?.pageId).toBe(3);
});

test("previews normalize whitespace and bound persisted text", () => {
	expect(savedTextPreview("  Opening\n\tline  ")).toBe("Opening line");
	expect(savedTextPreview("a".repeat(1000)).length).toBe(500);
	expect(savedTextPreview(null)).toBe("");
});
