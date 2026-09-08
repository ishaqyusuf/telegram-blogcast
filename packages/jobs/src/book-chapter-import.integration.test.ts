import { afterAll, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@acme/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { importBookChapters } from "./book-chapter-import";

const testUrl = process.env.CHAPTER_IMPORT_TEST_DATABASE_URL;
if (testUrl) {
	const url = new URL(testUrl);
	if (
		!["localhost", "127.0.0.1"].includes(url.hostname) ||
		url.pathname !== "/alghurobaa_chapter_test"
	) {
		throw new Error(
			"Chapter integration tests require the dedicated localhost test database.",
		);
	}
}
const db = testUrl
	? new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) })
	: null;
afterAll(async () => {
	await db?.$disconnect();
});
const html = (title = "Parent") =>
	`<div class="betaka-index"><ul><li><a href="/book/23833/1">${title}</a><ul style="display:none"><li><a href="/book/23833/106">Child</a></li></ul></li></ul></div>`;

async function fixture() {
	const book = await db!.book.create({
		data: { blog: { create: { type: "book" } }, shamelaId: 23833 },
	});
	const page = await db!.bookPage.create({
		data: {
			bookId: book.id,
			shamelaPageNo: 106,
			shamelaUrl: "/book/23833/106",
			status: "fetched",
			chapterTitle: "Keep my metadata",
			documentJson: { type: "paragraph", text: "Formatted content" },
			paragraphs: { create: { pid: 1, text: "Formatted content" } },
			highlights: {
				create: {
					userId: 1,
					startOffset: 0,
					endOffset: 9,
					quoteText: "Formatted",
					note: "Keep highlight",
				},
			},
			comments: { create: { userId: 1, content: "Keep comment" } },
		},
	});
	const capture = async (rawHtml = html()) =>
		db!.bookChapterImport.create({
			data: {
				bookId: book.id,
				returnPageId: page.id,
				captureHash: crypto.randomUUID(),
				rawHtml,
			},
		});
	const pageSnapshot = () =>
		db!.bookPage.findUniqueOrThrow({
			where: { id: page.id },
			include: { paragraphs: true, highlights: true, comments: true },
		});
	return { book, page, capture, pageSnapshot };
}

describe.skipIf(!testUrl)("chapter worker PostgreSQL transactions", () => {
	it("imports the full retained sample across batches with a complete hierarchy", async () => {
		const f = await fixture();
		const rawHtml = await readFile(
			resolve(
				__dirname,
				"../../document/src/book/fixtures/shamela-23833-betaka-index.html",
			),
			"utf8",
		);
		const job = await f.capture(rawHtml);
		const before = await f.pageSnapshot();
		await importBookChapters(db!, { importId: job.id, generation: 1 });
		const nodes = await db!.bookTocNode.findMany({
			where: { bookId: f.book.id, deletedAt: null },
		});
		const ids = new Set(nodes.map((n) => n.id));
		expect(nodes).toHaveLength(2405);
		expect(nodes.filter((n) => n.parentId === null)).toHaveLength(222);
		expect(
			nodes.every((n) =>
				n.depth === 0 ? n.parentId === null : ids.has(n.parentId!),
			),
		).toBe(true);
		expect(
			nodes.every((n) => n.metadataJson === null && n.shamelaPath === null),
		).toBe(true);
		expect(await db!.bookPage.count({ where: { bookId: f.book.id } })).toBe(1);
		expect(await f.pageSnapshot()).toEqual(before);
	});
	it("preserves the page and annotations, resolves parents, and never creates page stubs", async () => {
		const f = await fixture();
		const before = await f.pageSnapshot();
		const job = await f.capture();
		await importBookChapters(db!, { importId: job.id, generation: 1 });
		const nodes = await db!.bookTocNode.findMany({
			where: { bookId: f.book.id, deletedAt: null },
			orderBy: { depth: "asc" },
		});
		expect(nodes).toHaveLength(2);
		expect(nodes[0]!.parentId).toBeNull();
		expect(nodes[0]!.pageId).toBeNull();
		expect(nodes[1]!.parentId).toBe(nodes[0]!.id);
		expect(nodes[1]!.pageId).toBe(f.page.id);
		expect(await db!.bookPage.count({ where: { bookId: f.book.id } })).toBe(1);
		expect(await f.pageSnapshot()).toEqual(before);
		expect(
			(await db!.book.findUniqueOrThrow({ where: { id: f.book.id } }))
				.tocStatus,
		).toBe("complete");
		expect(
			(await db!.bookChapterImport.findUniqueOrThrow({ where: { id: job.id } }))
				.status,
		).toBe("complete");
		await importBookChapters(db!, { importId: job.id, generation: 1 });
		expect(
			await db!.bookTocNode.findMany({
				where: { bookId: f.book.id },
				orderBy: { depth: "asc" },
			}),
		).toEqual(nodes);
	});

	it("rolls back every tree write when final publication fails, then retries without duplicates", async () => {
		const f = await fixture();
		const first = await f.capture();
		await importBookChapters(db!, { importId: first.id, generation: 1 });
		const previousNodes = await db!.bookTocNode.findMany({
			where: { bookId: f.book.id },
			orderBy: { id: "asc" },
		});
		const before = await f.pageSnapshot();
		const next = await f.capture(html("Updated parent"));
		await db!.$executeRawUnsafe(
			`CREATE OR REPLACE FUNCTION fail_chapter_test_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected publication failure'; END; $$`,
		);
		await db!.$executeRawUnsafe(
			`CREATE TRIGGER fail_chapter_test_publication BEFORE UPDATE ON "BookChapterImport" FOR EACH ROW WHEN (NEW.status = 'complete') EXECUTE FUNCTION fail_chapter_test_publication()`,
		);
		try {
			await expect(
				importBookChapters(db!, { importId: next.id, generation: 1 }),
			).rejects.toThrow("injected publication failure");
		} finally {
			await db!.$executeRawUnsafe(
				'DROP TRIGGER fail_chapter_test_publication ON "BookChapterImport"',
			);
			await db!.$executeRawUnsafe(
				"DROP FUNCTION fail_chapter_test_publication()",
			);
		}
		expect(
			await db!.bookTocNode.findMany({
				where: { bookId: f.book.id },
				orderBy: { id: "asc" },
			}),
		).toEqual(previousNodes);
		expect(await f.pageSnapshot()).toEqual(before);
		expect(
			(
				await db!.bookChapterImport.findUniqueOrThrow({
					where: { id: next.id },
				})
			).status,
		).not.toBe("complete");
		await importBookChapters(db!, { importId: next.id, generation: 1 });
		const updated = await db!.bookTocNode.findMany({
			where: { bookId: f.book.id, deletedAt: null },
			orderBy: { id: "asc" },
		});
		expect(updated.map((n) => n.id)).toEqual(previousNodes.map((n) => n.id));
		expect(updated[0]!.title).toBe("Updated parent");
		expect(await f.pageSnapshot()).toEqual(before);
	});

	it("ignores cancelled and superseded-generation runs", async () => {
		const f = await fixture();
		const job = await f.capture();
		await db!.bookChapterImport.update({
			where: { id: job.id },
			data: { status: "cancelled" },
		});
		expect(
			await importBookChapters(db!, { importId: job.id, generation: 1 }),
		).toEqual({ skipped: true });
		await db!.bookChapterImport.update({
			where: { id: job.id },
			data: { status: "queued", generation: 2 },
		});
		expect(
			await importBookChapters(db!, { importId: job.id, generation: 1 }),
		).toEqual({ skipped: true });
		expect(await db!.bookTocNode.count({ where: { bookId: f.book.id } })).toBe(
			0,
		);
		await importBookChapters(db!, { importId: job.id, generation: 2 });
		expect(await db!.bookTocNode.count({ where: { bookId: f.book.id } })).toBe(
			2,
		);
	});

	it("cancels while the worker holds the book lock and rolls back publication", async () => {
		const f = await fixture();
		const job = await f.capture();
		const before = await f.pageSnapshot();
		const wrapped = new Proxy(db!, {
			get(target, key) {
				if (key !== "$transaction") return Reflect.get(target, key);
				return (work: (tx: any) => Promise<unknown>, options: any) =>
					target.$transaction(async (tx) => {
						const transaction = new Proxy(tx, {
							get(inner, field) {
								if (field !== "book") return Reflect.get(inner, field);
								return {
									...inner.book,
									update: async (args: any) => {
										const result = await inner.book.update(args);
										// Separate connection, exactly as the cancel API operates during publication.
										await db!.bookChapterImport.update({
											where: { id: job.id },
											data: { status: "cancelled" },
										});
										return result;
									},
								};
							},
						});
						return work(transaction);
					}, options);
			},
		});
		await expect(
			importBookChapters(wrapped, { importId: job.id, generation: 1 }),
		).rejects.toThrow("cancelled before publication");
		expect(
			(await db!.bookChapterImport.findUniqueOrThrow({ where: { id: job.id } }))
				.status,
		).toBe("cancelled");
		expect(
			(await db!.book.findUniqueOrThrow({ where: { id: f.book.id } }))
				.tocStatus,
		).not.toBe("complete");
		expect(await db!.bookTocNode.count({ where: { bookId: f.book.id } })).toBe(
			0,
		);
		expect(await f.pageSnapshot()).toEqual(before);
	});
});
