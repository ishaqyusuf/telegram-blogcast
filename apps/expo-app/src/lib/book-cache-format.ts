import { z } from "zod";

export const BOOK_CACHE_FORMAT_VERSION = 1;
export const PREFERRED_BOOKS_DIRECTORY = "Android/media/com.alghurobaa.podcast/Books";
export const MAX_BOOK_CACHE_FILE_BYTES = 8 * 1024 * 1024;

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const ordinal = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const nullableText = z.string().nullable();
const attrs = z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean(), z.null()]));
const documentSchema = z.strictObject({
	type: z.literal("doc"),
	version: z.literal(1),
	blocks: z.array(z.strictObject({
		id: z.string(),
		type: z.enum(["paragraph", "heading", "blockquote"]),
		attrs: attrs.optional(),
		content: z.array(z.strictObject({
			type: z.literal("text"),
			text: z.string(),
			marks: z.array(z.strictObject({
				type: z.enum(["bold", "italic", "underline", "highlight", "link", "hashtag", "timestamp"]),
				attrs: attrs.optional(),
			})).optional(),
		})),
	})),
});

const paragraphSchema = z.strictObject({
	id,
	pid: ordinal,
	text: z.string(),
	footnoteIds: nullableText.optional(),
	sourceMarks: z.array(z.strictObject({ kind: z.literal("c5"), start: ordinal, end: ordinal })).nullable().optional(),
}).refine((p) => !p.sourceMarks?.some((m) => m.start >= m.end || m.end > p.text.length), "Invalid paragraph source range");

const pageSchema = z.strictObject({
	formatVersion: z.literal(BOOK_CACHE_FORMAT_VERSION),
	bookId: id,
	pageId: id,
	sourceBookId: id.nullable(),
	sourcePageNo: id.nullable(),
	contentVersion: ordinal,
	chapterTitle: nullableText,
	printedPageNo: ordinal.nullable(),
	previousSourcePageNo: id.nullable(),
	nextSourcePageNo: id.nullable(),
	paragraphs: z.array(paragraphSchema),
	footnotes: z.array(z.strictObject({ id, marker: z.string(), content: z.string(), type: nullableText })),
	document: documentSchema.nullable(),
	contentHtml: nullableText,
}).superRefine((page, context) => {
	for (const key of ["paragraphs", "footnotes"] as const) {
		if (new Set(page[key].map((row) => row.id)).size !== page[key].length)
			context.addIssue({ code: "custom", path: [key], message: `Duplicate ${key} IDs` });
	}
	if (page.sourcePageNo !== null && page.sourceBookId === null)
		context.addIssue({ code: "custom", path: ["sourceBookId"], message: "Source page requires a source book" });
});

const chapterSchema = z.strictObject({
	formatVersion: z.literal(BOOK_CACHE_FORMAT_VERSION),
	bookId: id,
	sourceBookId: id.nullable(),
	revision: z.string().min(1).max(256),
	complete: z.literal(true),
	nodeCount: ordinal,
	nodes: z.array(z.strictObject({
		id, parentId: id.nullable(), title: z.string(),
		sourcePageNo: id.nullable(), sortOrder: ordinal,
	})).max(100_000),
});

export type CachedPageFile = z.infer<typeof pageSchema>;
export type CachedChapterFile = z.infer<typeof chapterSchema>;

export function bookCachePaths(bookId: number, pageId: number) {
	id.parse(bookId);
	id.parse(pageId);
	const book = `book-${bookId}`;
	return {
		book, manifest: `${book}/manifest.json`, chapters: `${book}/chapters.json`,
		media: `${book}/media`, page: `${book}/pages/page-${pageId}.json`,
		markdown: `${book}/pages/page-${pageId}.md`,
	};
}

function parseJson(text: string): unknown {
	// Bound allocation before parsing externally editable files; Arabic uses multiple UTF-8 bytes.
	if (text.length > MAX_BOOK_CACHE_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAX_BOOK_CACHE_FILE_BYTES)
		throw new Error("Book cache file exceeds the supported size");
	return JSON.parse(text);
}

export function parsePageFile(text: string, expected: { bookId: number; pageId: number }): CachedPageFile {
	const page = pageSchema.parse(parseJson(text));
	if (page.bookId !== expected.bookId || page.pageId !== expected.pageId)
		throw new Error("Page cache identity does not match its destination");
	return page;
}

export function serializePageFile(input: unknown): string {
	const page = pageSchema.parse(input);
	const text = JSON.stringify(page);
	parseJson(text);
	return text;
}

export function parseChapterFile(text: string, expectedBookId: number): CachedChapterFile {
	const tree = chapterSchema.parse(parseJson(text));
	if (tree.bookId !== expectedBookId) throw new Error("Chapter cache belongs to a different book");
	const byId = new Map(tree.nodes.map((node) => [node.id, node]));
	if (tree.nodeCount !== tree.nodes.length || byId.size !== tree.nodes.length)
		throw new Error("Chapter cache has missing or duplicate nodes");
	const complete = new Set<number>();
	for (const node of tree.nodes) {
		const path = new Set<number>();
		let current: number | null = node.id;
		while (current !== null && !complete.has(current)) {
			if (path.has(current)) throw new Error("Chapter cache contains a cycle");
			const parent = byId.get(current);
			if (!parent) throw new Error("Chapter cache contains an unresolved parent");
			path.add(current);
			current = parent.parentId;
		}
		for (const visited of path) complete.add(visited);
	}
	return tree;
}
