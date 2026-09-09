import superjson from "superjson";
import { createBookDocumentFromParagraphs } from "@acme/document/book";
import { parsePageFile, serializePageFile, type CachedPageFile } from "./book-cache-format";
import type { vanillaTrpc } from "@/trpc/vanilla-client";

export type ReaderPage = Omit<Awaited<ReturnType<typeof vanillaTrpc.book.getPage.query>>, "contentExportable"> & { contentExportable?: boolean; localCache?: { restored?: true; legacy?: true } };
type ReaderMetadata = Omit<ReaderPage, "paragraphs" | "footnotes" | "highlights" | "comments" | "rawJson" | "documentJson">;

export function encodeReaderPage(page: ReaderPage) {
	if (page.status !== "fetched") throw new Error("Only fully fetched pages can be cached for reading.");
	const raw = page.rawJson && typeof page.rawJson === "object" && !Array.isArray(page.rawJson) ? page.rawJson : {};
	const file = parsePageFile(serializePageFile({
		formatVersion: 1, bookId: page.bookId, pageId: page.id,
		sourceBookId: page.book.shamelaId, sourcePageNo: page.book.shamelaId ? page.shamelaPageNo : null,
		contentVersion: typeof raw.contentVersion === "number" ? raw.contentVersion : 0,
		chapterTitle: page.chapterTitle, printedPageNo: page.printedPageNo,
		previousSourcePageNo: page.previousShamelaPageNo, nextSourcePageNo: page.nextShamelaPageNo,
		paragraphs: page.paragraphs.map(({ id, pid, text, footnoteIds, sourceMarks }) => ({ id, pid, text, footnoteIds, sourceMarks })),
		footnotes: page.footnotes.map(({ id, marker, type, content, linkedParagraphs, items }) => ({ id, marker, type, content, linkedParagraphs, items })),
		document: raw.contentDocument ?? createBookDocumentFromParagraphs(page.paragraphs),
		contentHtml: typeof raw.contentHtml === "string" ? raw.contentHtml : null,
	}), { bookId: page.bookId, pageId: page.id });
	const { paragraphs, footnotes, highlights, comments, rawJson, documentJson, ...metadata } = page;
	return {
		file,
		metadata: superjson.stringify(metadata),
		exportable: !page.localCache?.restored && !page.localCache?.legacy && page.contentExportable === true,
	};
}

export function decodeReaderPage(file: CachedPageFile, metadataText: string | null): ReaderPage {
	const sourceUrl = (pageNo: number | null) => file.sourceBookId && pageNo ? `https://shamela.ws/book/${file.sourceBookId}/${pageNo}` : null;
	const fallback: ReaderMetadata = {
		id: file.pageId, bookId: file.bookId, createdAt: null, updatedAt: null, deletedAt: null,
		volumeId: null, volume: null, shamelaPageNo: file.sourcePageNo ?? 0, shamelaUrl: sourceUrl(file.sourcePageNo) ?? "",
		printedPageNo: file.printedPageNo, chapterTitle: file.chapterTitle, chapterUrl: null, topicTitle: null, topicUrl: null,
		previousShamelaPageNo: file.previousSourcePageNo, previousShamelaUrl: sourceUrl(file.previousSourcePageNo),
		nextShamelaPageNo: file.nextSourcePageNo, nextShamelaUrl: sourceUrl(file.nextSourcePageNo),
		status: "fetched", audioReferences: [],
		book: { id: file.bookId, shamelaId: file.sourceBookId, shamelaUrl: file.sourceBookId ? `https://shamela.ws/book/${file.sourceBookId}` : null, sourceType: file.sourceBookId ? "shamela" : "user", editable: false, ownerUserId: null },
		adjacentPages: {
			previous: { shamelaPageNo: file.previousSourcePageNo, shamelaUrl: sourceUrl(file.previousSourcePageNo), page: null },
			next: { shamelaPageNo: file.nextSourcePageNo, shamelaUrl: sourceUrl(file.nextSourcePageNo), page: null },
		},
	};
	const metadata = metadataText ? superjson.parse<ReaderMetadata>(metadataText) : fallback;
	if (metadata.id !== file.pageId || metadata.bookId !== file.bookId || metadata.book.id !== file.bookId)
		throw new Error("Cached reader metadata belongs to a different page.");
	return {
		...metadata,
		...(!metadataText ? { localCache: { restored: true as const } } : {}),
		paragraphs: file.paragraphs.map((p) => ({ ...p, pageId: file.pageId, footnoteIds: p.footnoteIds ?? null, sourceMarks: p.sourceMarks ?? null })),
		footnotes: file.footnotes.map((f) => ({ ...f, pageId: file.pageId, linkedParagraphs: f.linkedParagraphs ?? null, items: f.items ?? null })),
		highlights: [], comments: [],
		rawJson: { contentVersion: file.contentVersion, contentDocument: file.document, contentHtml: file.contentHtml },
		documentJson: file.document,
	};
}
