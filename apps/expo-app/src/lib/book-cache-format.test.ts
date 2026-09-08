import { describe, expect, test } from "bun:test";
import {
	bookCachePaths,
	parseChapterFile,
	parsePageFile,
	serializePageFile,
} from "./book-cache-format";

const page = () => ({
	formatVersion: 1,
	bookId: 3,
	pageId: 12,
	sourceBookId: 23833,
	sourcePageNo: 106,
	contentVersion: 2,
	chapterTitle: "Introduction",
	printedPageNo: 83,
	previousSourcePageNo: 105,
	nextSourcePageNo: 107,
	paragraphs: [{ id: 19, pid: 1, text: "A formatted paragraph", sourceMarks: [{ kind: "c5", start: 2, end: 11 }] }],
	footnotes: [{ id: 20, marker: "1", content: "A note", type: null }],
	document: { type: "doc", version: 1, blocks: [] },
	contentHtml: "<p>A <strong>formatted</strong> paragraph</p>",
});

const chapters = () => ({
	formatVersion: 1,
	bookId: 3,
	sourceBookId: 23833,
	revision: "capture-abc",
	complete: true,
	nodeCount: 3,
	nodes: [
		{ id: 10, parentId: null, title: "Root", sourcePageNo: null, sortOrder: 0 },
		{ id: 11, parentId: 10, title: "Child", sourcePageNo: 106, sortOrder: 0 },
		{ id: 12, parentId: 11, title: "Grandchild", sourcePageNo: 107, sortOrder: 0 },
	],
});

describe("portable book cache format", () => {
	test("uses database IDs rather than source page numbers for filenames", () => {
		expect(bookCachePaths(3, 12)).toEqual({
			book: "book-3", manifest: "book-3/manifest.json",
			chapters: "book-3/chapters.json", media: "book-3/media",
			page: "book-3/pages/page-12.json", markdown: "book-3/pages/page-12.md",
		});
		for (const id of [0, -1, 1.2, Infinity, Number.MAX_SAFE_INTEGER + 1, "../other"])
			expect(() => bookCachePaths(id as number, 12)).toThrow();
	});

	test("round trips formatting, paragraph identifiers, footnotes and source mapping", () => {
		const result = parsePageFile(serializePageFile(page()), { bookId: 3, pageId: 12 });
		expect(result).toEqual(page());
		expect(result.sourcePageNo).toBe(106);
	});

	test("rejects mismatched IDs, unsupported formats and invalid source marks", () => {
		expect(() => parsePageFile(JSON.stringify(page()), { bookId: 4, pageId: 12 })).toThrow();
		expect(() => parsePageFile(JSON.stringify(page()), { bookId: 3, pageId: 106 })).toThrow();
		expect(() => serializePageFile({ ...page(), formatVersion: 2 })).toThrow();
		expect(() => serializePageFile({ ...page(), paragraphs: [{ id: 19, pid: 1, text: "short", sourceMarks: [{ kind: "c5", start: 0, end: 500 }] }] })).toThrow();
	});

	test("does not silently export annotations or unknown private fields", () => {
		for (const field of ["highlights", "comments", "ownerUserId", "draft", "bookmarks"])
			expect(() => serializePageFile({ ...page(), [field]: "private" })).toThrow();
	});

	test("rejects duplicate paragraph and footnote IDs", () => {
		const value = page();
		expect(() => serializePageFile({ ...value, paragraphs: [...value.paragraphs, ...value.paragraphs] })).toThrow();
		expect(() => serializePageFile({ ...value, footnotes: [...value.footnotes, ...value.footnotes] })).toThrow();
	});

	test("validates a complete hierarchy including non-page parents", () => {
		expect(parseChapterFile(JSON.stringify(chapters()), 3)).toEqual(chapters());
	});

	test("rejects missing nodes, duplicates, orphan parents and cycles", () => {
		const base = chapters();
		for (const invalid of [
			{ ...base, complete: false },
			{ ...base, nodeCount: 4 },
			{ ...base, nodes: [...base.nodes.slice(0, 2), base.nodes[1]] },
			{ ...base, nodes: base.nodes.map((n) => n.id === 11 ? { ...n, parentId: 999 } : n) },
			{ ...base, nodes: base.nodes.map((n) => n.id === 10 ? { ...n, parentId: 12 } : n) },
			{ ...base, nodes: base.nodes.map((n) => n.id === 10 ? { ...n, parentId: 10 } : n) },
		]) expect(() => parseChapterFile(JSON.stringify(invalid), 3)).toThrow();
	});

	test("handles a deep hierarchy without recursive traversal", () => {
		const nodes = Array.from({ length: 5000 }, (_, i) => ({
			id: i + 1, parentId: i || null, title: "Chapter", sourcePageNo: null, sortOrder: 0,
		}));
		expect(parseChapterFile(JSON.stringify({ ...chapters(), nodes, nodeCount: nodes.length }), 3).nodes).toHaveLength(5000);
	});

	test("rejects corrupt JSON, wrong book identity and oversized files", () => {
		expect(() => parseChapterFile("not json", 3)).toThrow();
		expect(() => parseChapterFile(JSON.stringify(chapters()), 4)).toThrow();
		expect(() => parsePageFile(" ".repeat(8 * 1024 * 1024 + 1), { bookId: 3, pageId: 12 })).toThrow();
	});
});
