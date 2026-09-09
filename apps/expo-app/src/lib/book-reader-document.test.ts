import { describe, expect, test } from "bun:test";
import { resolveReaderDocument } from "./book-reader-document";

const document = { type: "doc", version: 1, blocks: [{ id: "19", type: "paragraph", content: [{ type: "text", text: "Formatted text", marks: [{ type: "bold" }] }] }] };
const page = { id: 12, rawJson: { contentDocument: document, contentHtml: "<p><strong>Formatted text</strong></p>", contentVersion: 2 }, paragraphs: [{ id: 19, text: "Formatted text" }] };

describe("offline reader document", () => {
	test("preserves rich content and edit version without a server document request", () => {
		const resolved = resolveReaderDocument(page);
		expect(resolved?.document).toEqual(document);
		expect(resolved?.contentHtml).toEqual(page.rawJson.contentHtml);
		expect(resolved?.plainText).toBe("Formatted text");
		expect(resolved?.contentVersion).toBe(2);
	});
	test("ignores another page's document and an older cached query result", () => {
		const cached = resolveReaderDocument(page)!;
		expect(resolveReaderDocument(page, { ...cached, pageId: 13, plainText: "Wrong page" })).toEqual(cached);
		expect(resolveReaderDocument(page, { ...cached, contentVersion: 1, plainText: "Old text" })).toEqual(cached);
		const refreshed = { ...cached, contentVersion: 3, plainText: "New text" };
		expect(resolveReaderDocument(page, refreshed)).toEqual(refreshed);
	});
	test("supports legacy paragraph-only content and does not expose remote content without a page", () => {
		const cached = resolveReaderDocument({ ...page, rawJson: null });
		expect(cached?.plainText).toBe("Formatted text");
		expect(cached?.contentVersion).toBe(0);
		expect(cached?.contentHtml).toContain("Formatted text");
		expect(resolveReaderDocument(undefined, cached)).toBeNull();
	});
});
