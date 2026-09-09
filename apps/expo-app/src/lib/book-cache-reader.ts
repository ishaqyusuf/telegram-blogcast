import { getBookCacheRepository } from "@/db/book-cache-db";
import { decodeReaderPage, encodeReaderPage, type ReaderPage } from "./book-cache-page";
import { syncBookFolder } from "./book-cache-sync";
import type { PageTarget } from "./book-page-loader";
import { resolveLocalBookPage } from "./book-cache-resolution";
import { localSqlite } from "@/db/local-db";
import { readLegacyBookPage, findLegacyBookPage, listLegacyBooks } from "./book-cache-legacy";

export async function readCachedReaderPage(scope: string, bookId: number, pageId: number) {
	const repository = await getBookCacheRepository();
	let saved = await repository.readReaderPage(scope, bookId, pageId);
	if (!saved) {
		const legacy = await readLegacyBookPage(localSqlite, scope, bookId, pageId);
		if (legacy) {
			const { metadata } = encodeReaderPage(legacy.reader);
			await repository.savePage(scope, legacy.file, 0, false, metadata, true);
			await repository.rememberBook(scope, { id: bookId, nameAr: legacy.nameAr, nameEn: legacy.nameEn, sourceBookId: legacy.file.sourceBookId, pinned: legacy.pinned });
			saved = await repository.readReaderPage(scope, bookId, pageId);
		}
	}
	return saved ? decodeReaderPage(saved.page, saved.metadata) : null;
}

export async function saveCachedReaderPage(scope: string, page: ReaderPage, observedAt: number) {
	if (page.localCache?.restored || page.localCache?.legacy) return;
	const encoded = encodeReaderPage(page);
	const repository = await getBookCacheRepository();
	await repository.savePage(scope, encoded.file, observedAt, encoded.exportable, encoded.metadata);
	if (encoded.exportable) void syncBookFolder();
}

export async function resolveCachedPageTarget(scope: string, target: PageTarget) {
	const repository = await getBookCacheRepository();
	return resolveLocalBookPage(target, {
		findPage: async (bookId, sourcePageNo) => await repository.findPage(scope, bookId, sourcePageNo) ?? (await findLegacyBookPage(localSqlite, scope, sourcePageNo, { bookId }))?.pageId ?? null,
		findSourcePage: async (sourceBookId, sourcePageNo) => await repository.findSourcePage(scope, sourceBookId, sourcePageNo) ?? findLegacyBookPage(localSqlite, scope, sourcePageNo, { sourceBookId }),
		read: (bookId, pageId) => readCachedReaderPage(scope, bookId, pageId),
	});
}

export async function listCachedBookLibrary(scope: string) {
	const repository = await getBookCacheRepository();
	const legacy = await listLegacyBooks(localSqlite, scope);
	const books = new Map(legacy.map((book) => [book.id, book]));
	for (const book of await repository.listCachedBooks(scope)) {
		const previous = books.get(book.id);
		books.set(book.id, { ...book, nameAr: book.nameAr ?? previous?.nameAr ?? null, nameEn: book.nameEn ?? previous?.nameEn ?? null, pageCount: book.pageCount + (previous?.pageCount ?? 0), firstPageId: previous?.firstPageId ?? book.firstPageId });
	}
	return [...books.values()];
}
