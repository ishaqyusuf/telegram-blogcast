import { expect, test } from "bun:test";
import { resolveLocalBookPage } from "./book-cache-resolution";

const page = { id: 12, bookId: 3, shamelaUrl: "https://shamela.ws/book/23833/106" };
const cache = {
	async findPage(bookId: number, sourcePageNo: number) { return bookId === 3 && sourcePageNo === 106 ? 12 : null; },
	async findSourcePage(sourceBookId: number, sourcePageNo: number) { return sourceBookId === 23833 && sourcePageNo === 106 ? { bookId: 3, pageId: 12 } : null; },
	async read(bookId: number, pageId: number) { return bookId === 3 && pageId === 12 ? page : null; },
};

test("pasted source URLs resolve entirely locally to application book/page IDs", async () => {
	expect(await resolveLocalBookPage({ url: page.shamelaUrl }, cache)).toEqual(page);
});
test("chapter taps and swipes use the book/source-page lookup", async () => {
	expect(await resolveLocalBookPage({ bookId: 3, sourcePageNo: 106 }, cache)).toEqual(page);
	expect(await resolveLocalBookPage({ bookId: 3, sourcePageNo: 107 }, cache)).toBeNull();
});
test("wrong-book URLs and conflicting source page numbers never resolve cached content", async () => {
	await expect(resolveLocalBookPage({ bookId: 3, url: "https://shamela.ws/book/999/106" }, cache)).rejects.toThrow();
	await expect(resolveLocalBookPage({ bookId: 3, sourcePageNo: 107, url: page.shamelaUrl }, cache)).rejects.toThrow();
});
