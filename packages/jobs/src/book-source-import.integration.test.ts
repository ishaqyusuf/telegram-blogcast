import { afterAll, describe, expect, it } from "bun:test";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@acme/db";
import {
	KetabOnlineError,
	normalizeKetabOnlineIndexPart,
	normalizeKetabOnlineMetadata,
} from "@acme/document/book/ketabonline";
import { PrismaPg } from "@prisma/adapter-pg";
import {
	finishSourceImport,
	runBookSourceImport,
	sourceImportActiveKey,
} from "./book-source-import";
import type { KetabOnlineClient } from "./ketabonline-client";

const testUrl = process.env.BOOK_SOURCE_IMPORT_TEST_DATABASE_URL;
if (testUrl) {
	const url = new URL(testUrl);
	if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/alghurobaa_source_import_test")
		throw new Error("Source import integration tests require the dedicated localhost test database.");
}
const db = testUrl ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) }) : null;
afterAll(async () => {
	await db?.$disconnect();
});

type SourcePage = { id: number; part: "1" | "2"; text: string };
type SourceNode = { id: number; pageId: number; part: "1" | "2"; children?: SourceNode[] };

function fakeBook(bookId: number, pages: SourcePage[], nodes: SourceNode[]) {
	const parts = { "1": 9001, "2": 9002 } as const;
	const toIndex = (node: SourceNode, parent = 0): unknown => ({
		id: node.id,
		parent,
		title: `باب ${node.id}`,
		book_id: bookId,
		page_id: node.pageId,
		to_page_id: node.pageId,
		page: node.pageId,
		part_name: node.part,
		children: (node.children ?? []).map((child) => toIndex(child, node.id)),
	});
	const countNodes = (list: SourceNode[]): number => list.reduce((sum, node) => sum + 1 + countNodes(node.children ?? []), 0);
	const metadata = normalizeKetabOnlineMetadata(
		{
			status: true,
			code: 200,
			data: {
				id: bookId,
				title: `كتاب ${bookId}`,
				authors: [{ id: 1, name: "مؤلف الاختبار" }],
				pages_count: pages.length,
				index_count: countNodes(nodes),
				parts: [
					{ id: parts["1"], name: "1" },
					{ id: parts["2"], name: "2" },
				],
				files: { data: { url: `https://s2.ketabonline.com/books/${bookId}/${bookId}.data.zip?1`, size: 1 } },
			},
		},
		bookId,
	);
	const archive = {
		id: bookId,
		pages: pages.map((page) => ({
			id: page.id,
			page: page.id,
			content: `<p class="g-paragraph g-rtl" id="p-1">${page.text} <a href="#foot-1" class="g-footnote-link">(١)</a></p><p id="p-2">فقرة ثانية</p><div class="g-page-separator"></div><div class="g-page-footer"><p><span id="foot-1" class="g-footnote-target">(١)</span> حاشية ${page.id}</p></div>`,
			part: { name: page.part, id: parts[page.part] },
		})),
	};
	return { metadata, archive, nodes, toIndex };
}

function fakeClient(
	book: ReturnType<typeof fakeBook>,
	hooks: { metadata?: () => never; indexPart?: (partName: string) => void | Promise<void> } = {},
): KetabOnlineClient {
	return {
		search: async () => ({ items: [], page: 1, lastPage: 1, total: 0, hasMore: false }),
		metadata: async () => {
			hooks.metadata?.();
			return book.metadata;
		},
		archive: async () => ({ text: JSON.stringify(book.archive), archiveBytes: 10, archiveSha256: "sha" }),
		indexPart: async (bookId: number, partName: string) => {
			await hooks.indexPart?.(partName);
			const nodes = book.nodes.filter((node) => node.part === partName).map((node) => book.toIndex(node));
			return normalizeKetabOnlineIndexPart({ status: true, code: 200, data: nodes }, { bookId, partName });
		},
	};
}

async function createJob(sourceBookId: number) {
	return db!.bookSourceImport.create({
		data: {
			provider: "ketabonline",
			sourceBookId,
			ownerHash: "a".repeat(64),
			activeKey: sourceImportActiveKey("ketabonline", sourceBookId),
		},
	});
}

async function importWith(sourceBookId: number, client: KetabOnlineClient, pageBatchSize = 2) {
	const job = await createJob(sourceBookId);
	const result = await runBookSourceImport(db!, { importId: job.id, generation: 1 }, { client, pageBatchSize });
	return { job: await db!.bookSourceImport.findUniqueOrThrow({ where: { id: job.id } }), result };
}

async function livePages(bookId: number) {
	return db!.bookPage.findMany({
		where: { bookId, deletedAt: null },
		orderBy: { shamelaPageNo: "asc" },
		include: { paragraphs: { orderBy: { pid: "asc" } }, footnotes: true },
	});
}

const pagesV1: SourcePage[] = [
	{ id: 1, part: "1", text: "الأول" },
	{ id: 2, part: "1", text: "الثاني" },
	{ id: 3, part: "2", text: "الثالث" },
];
const nodesV1: SourceNode[] = [
	{ id: 10, pageId: 1, part: "1", children: [{ id: 11, pageId: 2, part: "1" }] },
	{ id: 12, pageId: 3, part: "2" },
];

describe.skipIf(!db)("KetabOnline whole-book import", () => {
	it("imports pages, volumes and every volume's chapters, then replays idempotently", async () => {
		const sourceBookId = randomInt(1_000_000, 1_900_000_000);
		const book = fakeBook(sourceBookId, pagesV1, nodesV1);
		const { job } = await importWith(sourceBookId, fakeClient(book));
		expect(job).toMatchObject({ status: "complete", phase: "done", activeKey: null, pagesSaved: 3, chaptersSaved: 3, volumesIndexed: 2 });
		const local = await db!.book.findUniqueOrThrow({
			where: { sourceProvider_sourceBookId: { sourceProvider: "ketabonline", sourceBookId } },
			include: { volumes: { orderBy: { number: "asc" } }, authors: true },
		});
		expect(local).toMatchObject({ sourceType: "ketabonline", editable: false, shamelaId: null, shamelaUrl: null, tocStatus: "complete" });
		expect(local.volumes.map((volume) => [volume.number, volume.sourcePartId])).toEqual([[1, 9001], [2, 9002]]);
		expect(local.authors.map((author) => author.name)).toEqual(["مؤلف الاختبار"]);

		const pages = await livePages(local.id);
		expect(pages.map((page) => [page.sourcePageId, page.shamelaPageNo, page.previousShamelaPageNo, page.nextShamelaPageNo, page.status, page.shamelaUrl])).toEqual([
			[1, 1, null, 2, "fetched", ""],
			[2, 2, 1, 3, "fetched", ""],
			[3, 3, 2, null, "fetched", ""],
		]);
		expect(pages.map((page) => page.chapterTitle)).toEqual(["باب 10", "باب 11", "باب 12"]);
		expect(pages[0]?.paragraphs.map((paragraph) => [paragraph.pid, paragraph.text, paragraph.footnoteIds])).toEqual([
			[1, "الأول (١)", "١"],
			[2, "فقرة ثانية", null],
		]);
		expect(pages[0]?.footnotes.map((footnote) => [footnote.marker, footnote.content, footnote.linkedParagraphs])).toEqual([["١", "حاشية 1", "1"]]);

		const tree = await db!.bookTocNode.findMany({ where: { bookId: local.id, deletedAt: null }, orderBy: { sortOrder: "asc" } });
		const byPath = new Map(tree.map((node) => [node.treePath, node]));
		expect(tree.map((node) => [node.treePath, node.depth, node.shamelaPageNo, node.volumeNumber])).toEqual([
			["ketabonline:10", 0, 1, 1],
			["ketabonline:11", 1, 2, 1],
			["ketabonline:12", 0, 3, 2],
		]);
		expect(byPath.get("ketabonline:11")?.parentId).toBe(byPath.get("ketabonline:10")!.id);
		expect(tree.map((node) => node.pageId)).toEqual(pages.map((page) => page.id));

		const replay = await importWith(sourceBookId, fakeClient(book));
		expect(replay.job.status).toBe("complete");
		const replayed = await livePages(local.id);
		expect(replayed.map((page) => [page.id, (page.rawJson as { contentVersion: number }).contentVersion])).toEqual(
			pages.map((page) => [page.id, 1]),
		);
		expect(await db!.book.count({ where: { sourceProvider: "ketabonline", sourceBookId } })).toBe(1);
	});

	it("refreshes changed pages in place, rebinds annotations and resequences reordered pages", async () => {
		const sourceBookId = randomInt(1_000_000, 1_900_000_000);
		await importWith(sourceBookId, fakeClient(fakeBook(sourceBookId, pagesV1, nodesV1)));
		const local = await db!.book.findUniqueOrThrow({ where: { sourceProvider_sourceBookId: { sourceProvider: "ketabonline", sourceBookId } } });
		const before = await livePages(local.id);
		const page2 = before[1]!;
		await db!.bookPageHighlight.create({
			data: { pageId: page2.id, paragraphId: page2.paragraphs[0]!.id, paragraphPid: 1, userId: 1, startOffset: 0, endOffset: 3, quoteText: page2.paragraphs[0]!.text },
		});
		await db!.bookPageComment.create({
			data: { pageId: page2.id, paragraphId: page2.paragraphs[1]!.id, paragraphPid: 2, userId: 1, content: "ملاحظة" },
		});

		// Page 2 changes, page 3 disappears, page 5 is inserted before the new page 6.
		const refreshed = fakeBook(
			sourceBookId,
			[
				{ id: 1, part: "1", text: "الأول" },
				{ id: 2, part: "1", text: "الثاني المنقح" },
				{ id: 5, part: "1", text: "الخامس" },
				{ id: 6, part: "2", text: "السادس" },
			],
			[
				{ id: 10, pageId: 1, part: "1", children: [{ id: 13, pageId: 5, part: "1" }] },
				{ id: 14, pageId: 6, part: "2" },
			],
		);
		const { job } = await importWith(sourceBookId, fakeClient(refreshed), 1);
		expect(job.status).toBe("complete");
		const after = await livePages(local.id);
		expect(after.map((page) => [page.sourcePageId, page.shamelaPageNo, page.previousShamelaPageNo, page.nextShamelaPageNo])).toEqual([
			[1, 1, null, 2],
			[2, 2, 1, 3],
			[5, 3, 2, 4],
			[6, 4, 3, null],
		]);
		expect(after[0]!.id).toBe(before[0]!.id);
		expect(after[1]!.id).toBe(page2.id);
		expect((after[0]!.rawJson as { contentVersion: number }).contentVersion).toBe(1);
		expect((after[1]!.rawJson as { contentVersion: number }).contentVersion).toBe(2);
		const retired = await db!.bookPage.findUniqueOrThrow({ where: { id: before[2]!.id } });
		expect(retired.deletedAt).not.toBeNull();
		expect(retired.shamelaPageNo).toBeLessThan(0);

		const highlight = await db!.bookPageHighlight.findFirstOrThrow({ where: { pageId: page2.id } });
		expect(highlight.paragraphId).toBe(after[1]!.paragraphs[0]!.id);
		expect(highlight.quoteText).toBe("الثاني المنقح (١)");
		const comment = await db!.bookPageComment.findFirstOrThrow({ where: { pageId: page2.id } });
		expect(comment.paragraphId).toBe(after[1]!.paragraphs[1]!.id);

		const tree = await db!.bookTocNode.findMany({ where: { bookId: local.id, deletedAt: null }, orderBy: { sortOrder: "asc" } });
		expect(tree.map((node) => [node.treePath, node.shamelaPageNo])).toEqual([
			["ketabonline:10", 1],
			["ketabonline:13", 3],
			["ketabonline:14", 4],
		]);
	});

	it("reports missing text without creating a book", async () => {
		const missing = randomInt(1_000_000, 1_900_000_000);
		const notFound = await importWith(
			missing,
			fakeClient(fakeBook(missing, pagesV1, nodesV1), {
				metadata: () => {
					throw new KetabOnlineError("not_found", "This book is not available on KetabOnline.");
				},
			}),
		);
		expect(notFound.job).toMatchObject({ status: "unavailable", errorCode: "not_found", activeKey: null, bookId: null });

		const empty = randomInt(1_000_000, 1_900_000_000);
		const book = fakeBook(empty, pagesV1, nodesV1);
		book.archive.pages = [];
		const emptyRun = await importWith(empty, fakeClient(book));
		expect(emptyRun.job).toMatchObject({ status: "unavailable", errorCode: "unavailable", bookId: null });
		expect(await db!.book.count({ where: { sourceProvider: "ketabonline", sourceBookId: { in: [missing, empty] } } })).toBe(0);
	});

	it("keeps text readable when a volume index fails, and a retry repairs the chapters", async () => {
		const sourceBookId = randomInt(1_000_000, 1_900_000_000);
		const book = fakeBook(sourceBookId, pagesV1, nodesV1);
		const failed = await importWith(
			sourceBookId,
			fakeClient(book, {
				indexPart: (part) => {
					if (part === "2") throw new KetabOnlineError("upstream", "KetabOnline is temporarily unavailable.", true);
				},
			}),
		);
		expect(failed.job).toMatchObject({ status: "failed", phase: "chapters", errorCode: "upstream", activeKey: null, pagesSaved: 3, volumesIndexed: 1 });
		expect(failed.job.errorMessage).toContain("Text is saved and readable");
		const local = await db!.book.findUniqueOrThrow({ where: { id: failed.job.bookId! } });
		expect(local.tocStatus).toBe("pending");
		expect(await db!.bookTocNode.count({ where: { bookId: local.id } })).toBe(0);
		expect((await livePages(local.id)).every((page) => page.status === "fetched")).toBe(true);

		await db!.bookSourceImport.update({
			where: { id: failed.job.id },
			data: { generation: 2, status: "queued", activeKey: sourceImportActiveKey("ketabonline", sourceBookId) },
		});
		await runBookSourceImport(db!, { importId: failed.job.id, generation: 2 }, { client: fakeClient(book) });
		const repaired = await db!.bookSourceImport.findUniqueOrThrow({ where: { id: failed.job.id } });
		expect(repaired).toMatchObject({ status: "complete", chaptersSaved: 3 });
		expect((await db!.book.findUniqueOrThrow({ where: { id: local.id } })).tocStatus).toBe("complete");
	});

	it("stops publication after cancellation and ignores stale generations", async () => {
		const sourceBookId = randomInt(1_000_000, 1_900_000_000);
		const job = await createJob(sourceBookId);
		const result = await runBookSourceImport(
			db!,
			{ importId: job.id, generation: 1 },
			{
				client: fakeClient(fakeBook(sourceBookId, pagesV1, nodesV1), {
					indexPart: async () => {
						await finishSourceImport(db!, { importId: job.id, generation: 1 }, { status: "cancelled", errorMessage: "Cancelled." });
					},
				}),
			},
		);
		expect(result).toEqual({ stopped: true });
		const cancelled = await db!.bookSourceImport.findUniqueOrThrow({ where: { id: job.id } });
		expect(cancelled).toMatchObject({ status: "cancelled", activeKey: null, completedAt: null });
		expect((await db!.book.findUniqueOrThrow({ where: { id: cancelled.bookId! } })).tocStatus).toBe("pending");

		const stale = await createJob(randomInt(1_000_000, 1_900_000_000));
		await db!.bookSourceImport.update({ where: { id: stale.id }, data: { generation: 2 } });
		expect(await runBookSourceImport(db!, { importId: stale.id, generation: 1 }, { client: fakeClient(fakeBook(1, pagesV1, nodesV1)) })).toEqual({ skipped: true });
		expect((await db!.bookSourceImport.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("queued");
	});

	it("allows only one active import per source book", async () => {
		const sourceBookId = randomInt(1_000_000, 1_900_000_000);
		await createJob(sourceBookId);
		await expect(createJob(sourceBookId)).rejects.toThrow();
	});
});
