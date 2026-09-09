import { canonicalPageUrl, type PageTarget } from "./book-page-loader";

type LocalPage = { id: number; bookId: number; shamelaUrl: string };

export async function resolveLocalBookPage<T extends LocalPage>(target: PageTarget, cache: {
	findPage: (bookId: number, sourcePageNo: number) => Promise<number | null>;
	findSourcePage: (sourceBookId: number, sourcePageNo: number) => Promise<{ bookId: number; pageId: number } | null>;
	read: (bookId: number, pageId: number) => Promise<T | null>;
}) {
	const url = target.url ? canonicalPageUrl(target.url) : undefined;
	const sourcePageNo = target.sourcePageNo ?? Number(url?.split("/").at(-1));
	if (!Number.isSafeInteger(sourcePageNo) || sourcePageNo < 1) return null;
	if (url && Number(url.split("/").at(-1)) !== sourcePageNo) throw new Error("The page number does not match the source link.");
	let bookId = target.bookId;
	let pageId: number | null = null;
	if (bookId) pageId = await cache.findPage(bookId, sourcePageNo);
	else if (url) {
		const source = await cache.findSourcePage(Number(url.split("/")[4]), sourcePageNo);
		bookId = source?.bookId;
		pageId = source?.pageId ?? null;
	}
	if (!bookId || !pageId) return null;
	const page = await cache.read(bookId, pageId);
	if (page && (page.bookId !== bookId || page.id !== pageId || (url && canonicalPageUrl(page.shamelaUrl) !== url)))
		throw new Error("Use a page link from this book.");
	return page;
}
