import { createBookDocumentFromParagraphs } from "@acme/document/book";
import { getDocumentPlainText, serializeDocumentToHtml, type RichDocument } from "@acme/document/core";

type PageContent = { id: number; rawJson?: unknown; paragraphs: { id: number; text: string }[] };
type ReaderDocument = { pageId: number; document: unknown; contentHtml: string; plainText: string; contentVersion: number };

export function resolveReaderDocument(page: PageContent | undefined, remote?: ReaderDocument | null): ReaderDocument | null {
	if (!page) return null;
	const raw = page.rawJson && typeof page.rawJson === "object" && !Array.isArray(page.rawJson)
		? page.rawJson as Record<string, unknown> : {};
	const version = typeof raw.contentVersion === "number" ? raw.contentVersion : 0;
	if (remote?.pageId === page.id && remote.contentVersion >= version) return remote;
	const document = (raw.contentDocument ?? createBookDocumentFromParagraphs(page.paragraphs)) as RichDocument;
	return {
		pageId: page.id,
		document,
		contentHtml: typeof raw.contentHtml === "string" ? raw.contentHtml : serializeDocumentToHtml(document),
		plainText: typeof raw.contentPlainText === "string" ? raw.contentPlainText : getDocumentPlainText(document),
		contentVersion: version,
	};
}
