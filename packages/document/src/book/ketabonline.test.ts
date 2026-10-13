import { describe, expect, test } from "bun:test";
import {
	convertKetabOnlinePageHtml,
	flattenKetabOnlineIndex,
	KetabOnlineError,
	normalizeKetabOnlineContent,
	normalizeKetabOnlineIndexPart,
	normalizeKetabOnlineMetadata,
	normalizeKetabOnlineSearch,
	parseKetabOnlineBookId,
	validateKetabOnlineContentUrl,
} from "./ketabonline";

const envelope = (data: unknown, extra: Record<string, unknown> = {}) => ({
	data,
	status: true,
	code: 200,
	...extra,
});

const metadataJson = (overrides: Record<string, unknown> = {}) =>
	envelope({
		id: 7,
		title: "كتاب <em>تجريبي</em>",
		authors: [{ id: 1, name: "مؤلف" }],
		categories: [{ id: 2, name: "حديث" }],
		pages_count: 3,
		parts_count: 2,
		index_count: 3,
		colors: ["#862d67", "bad"],
		parts: [
			{ id: 9001, name: "1", page_id: 1, pages: 2 },
			{ id: 9002, name: "2", page_id: 3, pages: 1 },
		],
		files: { data: { url: "https://s2.ketabonline.com/books/7/7.data.zip?123", size: 10 } },
		source: "المكتبة الشاملة",
		...overrides,
	});

const metadata = () => normalizeKetabOnlineMetadata(metadataJson(), 7);

const page = (id: number, part: { name: string; id: number }, printed: number) => ({
	id,
	page: printed,
	index: 0,
	content: `<p class="g-paragraph g-rtl" id="p-1">صفحة ${id}</p>`,
	seal: "",
	quran: null,
	hadeeth: null,
	shrooh: [],
	rowa: [],
	part,
	reciters: [],
});

const expectCode = (fn: () => unknown, code: string) => {
	try {
		fn();
	} catch (error) {
		expect(error).toBeInstanceOf(KetabOnlineError);
		expect((error as KetabOnlineError).code).toBe(code as KetabOnlineError["code"]);
		return;
	}
	throw new Error(`Expected ${code}`);
};

describe("KetabOnline identities", () => {
	test("accepts positive IDs and KetabOnline book links only", () => {
		expect(parseKetabOnlineBookId("29423")).toBe(29423);
		expect(parseKetabOnlineBookId(" 62952 ")).toBe(62952);
		expect(parseKetabOnlineBookId("https://ketabonline.com/ar/books/29423/read")).toBe(29423);
		for (const value of ["0", "-1", "1.5", "abc", "https://evil.com/ar/books/1", "http://ketabonline.com/ar/books/1", "99999999999"]) {
			expect(parseKetabOnlineBookId(value)).toBeNull();
		}
	});

	test("restricts content downloads to the verified host and book path", () => {
		expect(validateKetabOnlineContentUrl("https://s2.ketabonline.com/books/7/7.data.zip?1", 7).hostname).toBe("s2.ketabonline.com");
		for (const url of [
			"http://s2.ketabonline.com/books/7/7.data.zip",
			"https://s2.ketabonline.com.evil.com/books/7/7.data.zip",
			"https://s2.ketabonline.com/books/8/8.data.zip",
			"https://user:pass@s2.ketabonline.com/books/7/7.data.zip",
			"https://s2.ketabonline.com:444/books/7/7.data.zip",
			"https://s2.ketabonline.com/books/7/../8/8.data.zip",
		]) {
			expectCode(() => validateKetabOnlineContentUrl(url, 7), "invalid_response");
		}
	});
});

describe("KetabOnline envelopes", () => {
	test("normalizes search pagination and skips malformed rows", () => {
		const result = normalizeKetabOnlineSearch(
			envelope([{ id: 1, title: "رياض <em>الصالحين</em>", pages_count: 10 }, { id: 0 }, "bad"], {
				meta: { current_page: 1, last_page: 3, total: 7 },
			}),
		);
		expect(result.items).toEqual([
			expect.objectContaining({ id: 1, title: "رياض الصالحين", pagesCount: 10 }),
		]);
		expect(result).toMatchObject({ page: 1, lastPage: 3, total: 7, hasMore: true });
	});

	test("rejects application failures behind HTTP 200", () => {
		expectCode(() => normalizeKetabOnlineSearch({ status: false, code: 500, data: [] }), "invalid_response");
		expectCode(() => normalizeKetabOnlineMetadata({ status: false, code: 404 }, 7), "not_found");
		expectCode(() => normalizeKetabOnlineMetadata(metadataJson(), 8), "mismatch");
	});

	test("reads volumes without assuming part IDs are ordinals", () => {
		const meta = metadata();
		expect(meta.parts).toEqual([
			{ sourcePartId: 9001, name: "1", ordinal: 1, firstPageId: 1, pages: 2 },
			{ sourcePartId: 9002, name: "2", ordinal: 2, firstPageId: 3, pages: 1 },
		]);
		expect(meta.colors).toEqual(["#862d67"]);
		expect(meta.title).toBe("كتاب تجريبي");
		expectCode(
			() => normalizeKetabOnlineMetadata(metadataJson({ parts: [{ id: 1, name: "1" }, { id: 2, name: "1" }] }), 7),
			"invalid_response",
		);
	});
});

describe("KetabOnline content", () => {
	test("orders pages by volume then source ID, keeping repeated printed numbers", () => {
		const pages = normalizeKetabOnlineContent(
			{ id: 7, pages: [page(3, { name: "2", id: 9002 }, 1), page(2, { name: "1", id: 9001 }, 2), page(1, { name: "1", id: 9001 }, 1)] },
			metadata(),
		);
		expect(pages.map((item) => [item.sourcePageId, item.volumeNumber, item.printedPageNo])).toEqual([
			[1, 1, 1],
			[2, 1, 2],
			[3, 2, 1],
		]);
	});

	test("reports an empty archive as unavailable text, never an empty book", () => {
		expectCode(() => normalizeKetabOnlineContent({ id: 7, pages: [] }, metadata()), "unavailable");
	});

	test("rejects mismatched archives, unknown volumes, duplicates and count drift", () => {
		const pages = [page(1, { name: "1", id: 9001 }, 1), page(2, { name: "1", id: 9001 }, 2), page(3, { name: "2", id: 9002 }, 1)];
		expectCode(() => normalizeKetabOnlineContent({ id: 8, pages }, metadata()), "mismatch");
		expectCode(() => normalizeKetabOnlineContent({ id: 7, pages: [...pages.slice(0, 2), page(3, { name: "9", id: 1 }, 1)] }, metadata()), "mismatch");
		expectCode(() => normalizeKetabOnlineContent({ id: 7, pages: [...pages.slice(0, 2), page(3, { name: "2", id: 9001 }, 1)] }, metadata()), "mismatch");
		expectCode(() => normalizeKetabOnlineContent({ id: 7, pages: [pages[0], pages[0], pages[2]] }, metadata()), "invalid_archive");
		expectCode(() => normalizeKetabOnlineContent({ id: 7, pages: pages.slice(0, 2) }, metadata()), "mismatch");
	});

	test("records unverified source fields instead of inventing content", () => {
		const [first] = normalizeKetabOnlineContent(
			{ id: 7, pages: [{ ...page(1, { name: "1", id: 9001 }, 1), quran: [{ aya: 1 }], reciters: [] }, page(2, { name: "1", id: 9001 }, 2), page(3, { name: "2", id: 9002 }, 1)] },
			metadata(),
		);
		expect(first?.unsupportedFields).toEqual(["quran"]);
	});
});

describe("KetabOnline page HTML", () => {
	const html =
		'<p class="g-paragraph g-rtl" id="p-1">أشهد أن <span class="g-holy-word">لا إله   إلا الله</span> وحده <a href="#foot-1" class="g-footnote-link">(١)</a> .</p>' +
		'<p class="g-paragraph g-rtl" id="p-2">نص <script>alert(1)</script><b onclick="x()">آمن</b> <a href="javascript:alert(1)">رابط</a> &amp; <a href="#foot-2" class="g-footnote-link">(٢)</a></p>' +
		'<div class="g-table"><div class="g-cell">صدر</div><div class="g-border"> ... </div><div class="g-cell">عجز</div></div>' +
		'<p class="g-paragraph g-ltr" id="p-3"><div class="g-page-separator" id="page-separator"></div><div class="g-page-footer"></p>' +
		'<p class="g-paragraph g-rtl" id="p-4"><span class="g-list"> <span id="foot-1" class="g-footnote-target">(١)</span> </span> "</span> المصدر الأول (١/ ٢).</p>' +
		'<p class="g-paragraph g-rtl" id="p-5">تتمة الحاشية.</p>' +
		'<p class="g-paragraph g-rtl" id="p-6"><span id="foot-2" class="g-footnote-target">(٢)</span> المصدر الثاني.</div></p>';

	test("keeps paragraph IDs, inline markers, highlighted holy text and footnotes", () => {
		const result = convertKetabOnlinePageHtml(html);
		expect(result.paragraphs.map((paragraph) => paragraph.text)).toEqual([
			"أشهد أن لا إله إلا الله وحده (١) .",
			"نص آمن رابط & (٢)",
			"صدر ... عجز",
		]);
		expect(result.paragraphs.map((paragraph) => paragraph.pid)).toEqual([1, 2, 3]);
		const [first] = result.paragraphs;
		expect(first?.footnoteIds).toBe("١");
		const mark = first!.sourceMarks[0]!;
		expect(first!.text.slice(mark.start, mark.end)).toBe("لا إله إلا الله");
		expect(result.footnotes).toEqual([
			{ marker: "١", type: "footnote", content: "المصدر الأول (١/ ٢).\nتتمة الحاشية.", linkedParagraphs: "1" },
			{ marker: "٢", type: "footnote", content: "المصدر الثاني.", linkedParagraphs: "2" },
		]);
	});

	test("never emits script bodies or markup", () => {
		const text = JSON.stringify(convertKetabOnlinePageHtml(html));
		expect(text).not.toContain("alert");
		expect(text).not.toContain("<");
		expect(text).not.toContain("javascript");
	});

	test("falls back to sequential paragraph numbers for irregular source IDs", () => {
		const result = convertKetabOnlinePageHtml('<p id="p-2">ب</p><p id="p-1">أ</p><p>ج</p>');
		expect(result.paragraphs.map((paragraph) => paragraph.pid)).toEqual([1, 2, 3]);
	});
});

describe("KetabOnline chapter index", () => {
	const node = (id: number, pageId: number, part: string, parent = 0, children: unknown[] = []) => ({
		id,
		parent,
		title: `باب ${id}`,
		book_id: 7,
		page_id: pageId,
		to_page_id: pageId,
		page: pageId,
		part_name: part,
		title_level: 1,
		reciters: [],
		children,
	});
	const parts = () => [
		normalizeKetabOnlineIndexPart(envelope([node(10, 1, "1", 0, [node(11, 2, "1", 10)])]), { bookId: 7, partName: "1" }),
		normalizeKetabOnlineIndexPart(envelope([node(12, 3, "2")]), { bookId: 7, partName: "2" }),
	];
	const flatten = (input = parts(), expectedCount = 3, pageIds = new Set([1, 2, 3])) =>
		flattenKetabOnlineIndex({ parts: input, volumes: metadata().parts, pageIds, expectedCount });

	test("flattens every volume with parents, depth and deterministic order", () => {
		expect(flatten().map((item) => [item.sourceNodeId, item.parentSourceNodeId, item.depth, item.sortOrder, item.volumeNumber])).toEqual([
			[10, null, 0, 0, 1],
			[11, 10, 1, 1, 1],
			[12, null, 0, 2, 2],
		]);
	});

	test("never returns a truncated or inconsistent tree", () => {
		expectCode(() => flatten(parts().slice(0, 1)), "incomplete_index");
		expectCode(() => flatten(undefined, 3, new Set([1, 3])), "incomplete_index");
		const duplicate = normalizeKetabOnlineIndexPart(envelope([{ ...node(12, 3, "2"), title: "مختلف" }]), { bookId: 7, partName: "2" });
		expectCode(() => flatten([...parts(), duplicate]), "incomplete_index");
		const badParent = normalizeKetabOnlineIndexPart(envelope([node(10, 1, "1", 0, [node(11, 2, "1", 99)])]), { bookId: 7, partName: "1" });
		expectCode(() => flatten([badParent, parts()[1]!]), "incomplete_index");
		expectCode(() => normalizeKetabOnlineIndexPart(envelope([{ ...node(10, 1, "1"), book_id: 8 }]), { bookId: 7, partName: "1" }), "mismatch");
		const truncated = envelope(Array.from({ length: 1000 }, (_, index) => node(index + 1, 1, "1")));
		expectCode(() => normalizeKetabOnlineIndexPart(truncated, { bookId: 7, partName: "1" }), "incomplete_index");
	});

	test("skips identical duplicates repeated across volume responses", () => {
		const repeated = normalizeKetabOnlineIndexPart(envelope([node(12, 3, "2")]), { bookId: 7, partName: "2" });
		expect(flatten([...parts(), repeated])).toHaveLength(3);
	});

	test("accepts a book with no chapters when none are declared", () => {
		expect(flattenKetabOnlineIndex({ parts: [], volumes: [], pageIds: new Set([1]), expectedCount: 0 })).toEqual([]);
	});
});
