import superjson from "superjson";
import { createBookDocumentFromParagraphs } from "@acme/document/book";
import { BOOK_CACHE_FORMAT_VERSION, PROVIDER_PAGE_FORMAT_VERSION, parsePageFile, serializePageFile, shamelaSourceBookId, type CachedPageFile } from "./book-cache-format";
import type { vanillaTrpc } from "@/trpc/vanilla-client";

export type ReaderPage = Omit<Awaited<ReturnType<typeof vanillaTrpc.book.getPage.query>>, "contentExportable"> & { contentExportable?: boolean; localCache?: { restored?: true; legacy?: true } };
type ReaderMetadata = Omit<ReaderPage, "paragraphs" | "footnotes" | "highlights" | "comments" | "rawJson" | "documentJson">;

export function encodeReaderPage(page: ReaderPage) {
	if (page.status !== "fetched") throw new Error("Only fully fetched pages can be cached for reading.");
	const raw = page.rawJson && typeof page.rawJson === "object" && !Array.isArray(page.rawJson) ? page.rawJson : {};
	const content = {
		bookId: page.bookId, pageId: page.id,
		contentVersion: typeof raw.contentVersion === "number" ? raw.contentVersion : 0,
		chapterTitle: page.chapterTitle, printedPageNo: page.printedPageNo,
		previousSourcePageNo: page.previousShamelaPageNo, nextSourcePageNo: page.nextShamelaPageNo,
		paragraphs: page.paragraphs.map(({ id, pid, text, footnoteIds, sourceMarks }) => ({ id, pid, text, footnoteIds, sourceMarks })),
		footnotes: page.footnotes.map(({ id, marker, type, content, linkedParagraphs, items }) => ({ id, marker, type, content, linkedParagraphs, items })),
		document: raw.contentDocument ?? createBookDocumentFromParagraphs(page.paragraphs),
		contentHtml: typeof raw.contentHtml === "string" ? raw.contentHtml : null,
	};
	const provider = page.book.sourceProvider;
	const identity = provider === "ketabonline" && page.book.sourceBookId
		? { formatVersion: PROVIDER_PAGE_FORMAT_VERSION, sourceProvider: provider, sourceBookId: page.book.sourceBookId, sourcePageNo: page.shamelaPageNo }
		// Unknown providers are cached without a source identity rather than as Shamela pages.
		: { formatVersion: BOOK_CACHE_FORMAT_VERSION, sourceBookId: provider ? null : page.book.shamelaId, sourcePageNo: !provider && page.book.shamelaId ? page.shamelaPageNo : null };
	const file = parsePageFile(serializePageFile({ ...identity, ...content }), { bookId: page.bookId, pageId: page.id });
	const { paragraphs, footnotes, highlights, comments, rawJson, documentJson, ...metadata } = page;
	return {
		file,
		metadata: superjson.stringify(metadata),
		exportable: !page.localCache?.restored && !page.localCache?.legacy && page.contentExportable === true,
	};
}

export function decodeReaderPage(file: CachedPageFile, metadataText: string | null): ReaderPage {
	const shamelaBookId = shamelaSourceBookId(file);
	// Only version 1 Shamela files may reconstruct Shamela links; provider files never do.
	const sourceUrl = (pageNo: number | null) => shamelaBookId && pageNo ? `https://shamela.ws/book/${shamelaBookId}/${pageNo}` : null;
	const provider = file.formatVersion === PROVIDER_PAGE_FORMAT_VERSION ? file.sourceProvider : null;
	const fallback: ReaderMetadata = {
		id: file.pageId, bookId: file.bookId, createdAt: null, updatedAt: null, deletedAt: null,
		volumeId: null, volume: null, shamelaPageNo: file.sourcePageNo ?? 0, shamelaUrl: sourceUrl(file.sourcePageNo) ?? "",
		printedPageNo: file.printedPageNo, chapterTitle: file.chapterTitle, chapterUrl: null, topicTitle: null, topicUrl: null,
		previousShamelaPageNo: file.previousSourcePageNo, previousShamelaUrl: sourceUrl(file.previousSourcePageNo),
		nextShamelaPageNo: file.nextSourcePageNo, nextShamelaUrl: sourceUrl(file.nextSourcePageNo),
		sourcePageId: null, sourceContentHash: null,
		status: "fetched", audioReferences: [],
		book: {
			id: file.bookId, shamelaId: shamelaBookId, shamelaUrl: shamelaBookId ? `https://shamela.ws/book/${shamelaBookId}` : null,
			sourceProvider: provider, sourceBookId: provider ? file.sourceBookId : null,
			sourceType: provider ?? (shamelaBookId ? "shamela" : "user"), editable: false, ownerUserId: null,
		},
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
