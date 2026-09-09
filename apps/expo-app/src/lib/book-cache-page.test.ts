import { describe, expect, test } from "bun:test";
import { decodeReaderPage, encodeReaderPage } from "./book-cache-page";
import type { CachedPageFile } from "./book-cache-format";

const file = (): CachedPageFile => ({
	formatVersion: 1, bookId: 3, pageId: 12, sourceBookId: 23833, sourcePageNo: 106,
	contentVersion: 2, chapterTitle: "Chapter", printedPageNo: 83,
	previousSourcePageNo: 105, nextSourcePageNo: 107,
	paragraphs: [{ id: 19, pid: 1, text: "Some text", footnoteIds: "1", sourceMarks: [{ kind: "c5", start: 0, end: 4 }] }],
	footnotes: [{ id: 20, type: null, marker: "1", content: "A note", linkedParagraphs: "19", items: [{ text: "Detail" }] }],
	document: { type: "doc", version: 1, blocks: [{ id: "19", type: "paragraph", content: [{ type: "text", text: "Some text", marks: [{ type: "bold" }] }] }] },
	contentHtml: "<p><strong>Some text</strong></p>",
});

describe("cached reader pages", () => {
	test("portable export requires server eligibility and never trusts restored or legacy copies", () => {
		const page = decodeReaderPage(file(), null);
		page.localCache = undefined;
		page.book.ownerUserId = 1;
		expect(encodeReaderPage(page).exportable).toBe(false);
		page.contentExportable = true;
		expect(encodeReaderPage(page).exportable).toBe(true);
		expect(encodeReaderPage({ ...page, contentExportable: false }).exportable).toBe(false);
		expect(encodeReaderPage({ ...page, localCache: { restored: true } }).exportable).toBe(false);
		expect(encodeReaderPage({ ...page, localCache: { legacy: true } }).exportable).toBe(false);
	});
	test("round trips content, footnotes, formatting and private reader metadata", () => {
		const page = decodeReaderPage(file(), null);
		page.volume = { id: 7, number: 2, title: "Second volume" };
		page.volumeId = 7;
		page.createdAt = new Date("2026-09-01T00:00:00Z");
		const encoded = encodeReaderPage(page);
		expect(encoded.file).toEqual(file());
		const restored = decodeReaderPage(encoded.file, encoded.metadata);
		expect(restored.volume).toEqual(page.volume);
		expect(restored.createdAt).toEqual(page.createdAt);
		expect(restored.paragraphs).toEqual(page.paragraphs);
		expect(restored.footnotes).toEqual(page.footnotes);
		expect(restored.rawJson).toEqual(page.rawJson);
		expect(restored.nextShamelaUrl).toBe("https://shamela.ws/book/23833/107");
	});

	test("keeps annotations out of both content files and replaceable metadata", () => {
		const page = decodeReaderPage(file(), null);
		page.highlights = [{ id: 99, note: "private-highlight" }] as any;
		page.comments = [{ content: "private-comment" }] as any;
		page.book.ownerUserId = 55;
		const encoded = encodeReaderPage(page);
		expect(encoded.exportable).toBe(false);
		expect(JSON.stringify(encoded.file)).not.toContain("ownerUserId");
		expect(encoded.metadata).not.toContain("private-highlight");
		expect(encoded.metadata).not.toContain("private-comment");
	});

	test("rejects pending pages and mismatched metadata", () => {
		const page = decodeReaderPage(file(), null);
		expect(() => encodeReaderPage({ ...page, status: "pending" })).toThrow();
		const encoded = encodeReaderPage(page);
		expect(() => decodeReaderPage({ ...encoded.file, pageId: 13 }, encoded.metadata)).toThrow("different page");
	});

	test("restored files without private metadata default to read-only", () => {
		const page = decodeReaderPage({ ...file(), sourceBookId: null, sourcePageNo: null }, null);
		expect(page.book.editable).toBe(false);
		expect(page.audioReferences).toEqual([]);
		expect(page.adjacentPages.next.page).toBeNull();
	});
});
