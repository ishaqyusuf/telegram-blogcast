import { describe, expect, test } from "bun:test";
import type { TRPCContext } from "../init";
import { bookRoutes } from "./book.routes";
import { bookChapterRoutes } from "./book-chapter.routes";

const rootUrl = "https://shamela.ws/book/23833";
const treeHtml = `<div class="betaka-index"><ul><li>
  <a class="exp_bu" data-id="10" href="javascript:;">+</a><a href="/book/23833/106">Parent</a>
  <ul style="display:none"><li><a href="/book/23833/106">Child</a></li></ul>
  </li></ul></div>`;
const pageHtml = `<html><head><title>Book</title></head><body>
  <h1><a href="/book/23833">Book</a></h1>
  <div class="nass"><p>Saved <span class="c5">formatted</span> content.</p></div>
  <div id="appended_pages"></div></body></html>`;

function database(existing = true, tocStatus = "pending") {
	let book: any = existing ? { id: 1, shamelaId: 23833, tocStatus } : null;
	const pages = new Map<number, any>();
	const nodes = new Map<string, any>();
	const imports = new Map<string, any>();
	const calls: string[] = [];
	let failNode = false;
	const staged: any = {
		id: 1,
		status: "staged",
		bookId: null,
		createdAt: new Date(),
		rawPage: {
			id: 1,
			html: pageHtml,
			requestedUrl: `${rootUrl}/106`,
			finalUrl: `${rootUrl}/106`,
			title: "Book",
		},
	};
	const db: any = {
		book: {
			findFirst: async () => book,
			findFirstOrThrow: async () => {
				if (!book) throw new Error("No book");
				return book;
			},
			create: async ({ data }: any) =>
				(book = { id: 1, tocStatus: "pending", ...data }),
			update: async ({ data }: any) => {
				Object.assign(book, data);
				return book;
			},
		},
		blog: { create: async () => ({ id: 1 }) },
		bookPage: {
			findFirst: async () => pages.get(106) ?? null,
			findFirstOrThrow: async () => {
				const page = pages.get(106);
				if (!page) throw new Error("No saved page");
				return page;
			},
			upsert: async ({ where, create, update }: any) => {
				const key = where.bookId_shamelaPageNo.shamelaPageNo;
				const page = pages.get(key);
				if (page) Object.assign(page, update);
				else pages.set(key, { id: key, paragraphs: [], ...create });
				return pages.get(key);
			},
			update: async ({ where, data }: any) => {
				Object.assign(pages.get(where.id), data);
				return pages.get(where.id);
			},
		},
		bookTocNode: {
			upsert: async ({ where, create, update }: any) => {
				calls.push("node");
				if (failNode) throw new Error("Tree write failed");
				const key = where.bookId_treePath.treePath;
				if (nodes.has(key)) Object.assign(nodes.get(key), update);
				else nodes.set(key, { id: nodes.size + 1, ...create });
				return nodes.get(key);
			},
			updateMany: async () => ({ count: 0 }),
		},
		bookChapterImport: {
			count: async () => imports.size,
			findUnique: async ({ where }: any) =>
				imports.get(where.bookId_captureHash.captureHash) ?? null,
			update: async ({ where, data }: any) => {
				const [key, job] = [...imports.entries()].find(
					([, job]) => job.id === where.id,
				)!;
				imports.delete(key);
				Object.assign(job, data);
				imports.set(job.captureHash, job);
				return job;
			},
			updateMany: async ({ where, data }: any) => {
				const job = [...imports.values()].find((job) => job.id === where.id);
				if (!job || (where.status?.in && !where.status.in.includes(job.status)))
					return { count: 0 };
				Object.assign(job, data);
				return { count: 1 };
			},
			upsert: async ({ where, create }: any) => {
				const key = where.bookId_captureHash.captureHash;
				if (!imports.has(key))
					imports.set(key, {
						id: crypto.randomUUID(),
						status: "queued",
						generation: 1,
						runId: "already-dispatched-test-run",
						nodeCount: 0,
						...create,
					});
				return imports.get(key);
			},
			findUniqueOrThrow: async ({ where }: any) =>
				[...imports.values()].find((job) => job.id === where.id),
		},
		$queryRaw: async () => [],
		shamelaStagedPageParse: {
			findFirstOrThrow: async () => staged,
			update: async ({ data }: any) => Object.assign(staged, data),
		},
		bookPageImportHistory: {
			create: async () => ({ id: 1 }),
			update: async () => ({ id: 1 }),
		},
		bookPageParagraph: {
			deleteMany: async () => calls.push("paragraphs"),
			createMany: async () => {},
			findMany: async () => [],
		},
		bookPageFootnote: {
			deleteMany: async () => {},
			createMany: async () => {},
		},
		bookPageHighlight: { findMany: async () => [] },
		bookPageComment: { findMany: async () => [] },
		$transaction: async (work: (tx: any) => Promise<unknown>) => {
			calls.push("transaction");
			const snapshot = structuredClone({ book, pages, nodes });
			try {
				return await work(db);
			} catch (error) {
				book = snapshot.book;
				pages.clear();
				snapshot.pages.forEach((v, k) => pages.set(k, v));
				nodes.clear();
				snapshot.nodes.forEach((v, k) => nodes.set(k, v));
				throw error;
			}
		},
	};
	return {
		chapterCaller: (ownerHash?: string) =>
			bookChapterRoutes.createCaller({
				db,
				bookImportOwnerHash: ownerHash,
			} as TRPCContext),
		caller: bookRoutes.createCaller({
			db,
			bookImportOwnerHash: "test-owner",
		} as TRPCContext),
		pages,
		nodes,
		imports,
		calls,
		staged,
		book: () => book,
		failNodes: () => {
			failNode = true;
		},
	};
}

describe("separate Shamela capture", () => {
	test("a new installation can recapture a terminal job without taking its ownership", async () => {
		const f = database();
		f.pages.set(106, { id: 106, bookId: 1, status: "fetched" });
		const input = { bookId: 1, pageId: 106, finalUrl: rootUrl, html: treeHtml };
		const first = await f.chapterCaller("owner").capture(input);
		const oldJob = [...f.imports.values()][0];
		oldJob.status = "failed";
		const next = await f.chapterCaller("replacement").capture(input);
		expect(next.id).not.toBe(first.id);
		expect(oldJob.ownerHash).toBe("owner");
		expect(f.imports.size).toBe(2);
		expect((await f.chapterCaller("replacement").capture(input)).id).toBe(
			next.id,
		);
	});

	test("URL-only books resolve their source identity without a numeric book field", async () => {
		const f = database();
		f.book().shamelaId = null;
		f.book().shamelaUrl = rootUrl;
		expect(
			await f.chapterCaller().resolvePage({ bookId: 1, sourcePageNo: 106 }),
		).toEqual({ pageId: null, sourceUrl: `${rootUrl}/106` });
	});
	test("only the originating installation can manage its import", async () => {
		const f = database();
		const job = {
			id: crypto.randomUUID(),
			bookId: 1,
			status: "queued",
			generation: 1,
			ownerHash: "owner",
		};
		f.imports.set("hash", job);
		await expect(
			f.chapterCaller().cancel({ importId: job.id }),
		).rejects.toThrow("Update the app");
		await expect(
			f.chapterCaller("stranger").cancel({ importId: job.id }),
		).rejects.toThrow("Only the device");
		await expect(
			f.chapterCaller("stranger").retry({ importId: job.id }),
		).rejects.toThrow("Only the device");
		const visible = await f
			.chapterCaller("stranger")
			.status({ importId: job.id });
		expect(visible.canManage).toBe(false);
		expect(visible).not.toHaveProperty("ownerHash");
		expect(
			(await f.chapterCaller("owner").status({ importId: job.id })).canManage,
		).toBe(true);
		expect(
			(await f.chapterCaller("owner").cancel({ importId: job.id })).status,
		).toBe("cancelled");
	});

	test("limits repeated retry generations", async () => {
		const f = database();
		const job = {
			id: crypto.randomUUID(),
			bookId: 1,
			status: "failed",
			generation: 5,
			ownerHash: "owner",
		};
		f.imports.set("hash", job);
		await expect(
			f.chapterCaller("owner").retry({ importId: job.id }),
		).rejects.toThrow("Retry limit");
	});
	for (const state of ["new", "pending", "complete"]) {
		test(`saves formatted page before chapters for ${state} books`, async () => {
			const fixture = database(state !== "new", state);
			const result = await fixture.caller.promoteStagedShamelaPageParse({
				stagedParseId: 1,
			});
			expect(result.page.id).toBe(106);
			expect(result.requiresFullToc).toBe(state !== "complete");
			expect(result.shamelaBookId).toBe(23833);
			expect(fixture.nodes.size).toBe(0);
			expect(
				fixture.pages
					.get(106)
					.documentJson.content.find((block: any) => block.type === "paragraph")
					.marks.length,
			).toBeGreaterThan(0);
			const retry = await fixture.caller.promoteStagedShamelaPageParse({
				stagedParseId: 1,
			});
			expect(retry.page.id).toBe(result.page.id);
			expect(
				fixture.calls.filter((call) => call === "paragraphs"),
			).toHaveLength(1);
		});
	}

	test("legacy chapter capture reuses its durable import and never rewrites the saved page", async () => {
		const fixture = database();
		const page = {
			id: 106,
			bookId: 1,
			documentJson: { content: "formatted" },
			printedPageNo: 9,
			highlights: [{ id: 20 }],
			comments: [{ id: 30 }],
			chapterTitle: "Existing title",
		};
		fixture.pages.set(106, structuredClone(page));
		const input = { bookId: 1, finalUrl: rootUrl, html: treeHtml };
		await fixture.caller.captureShamelaChapters(input);
		await fixture.caller.captureShamelaChapters(input);
		expect(fixture.pages.get(106)).toEqual(page);
		expect(fixture.pages.size).toBe(1);
		expect(fixture.nodes.size).toBe(0);
		expect(fixture.imports.size).toBe(1);
		expect([...fixture.imports.values()][0].status).toBe("queued");
		expect(fixture.book().tocStatus).toBe("pending");
		expect(fixture.calls).not.toContain("paragraphs");
	});

	test("rejects non-root and wrong-book URLs before queuing", async () => {
		for (const [finalUrl, html] of [
			[`${rootUrl}/106`, treeHtml],
			["https://shamela.ws/book/99", treeHtml],
			["https://example.com/book/23833", treeHtml],
		]) {
			const fixture = database();
			fixture.pages.set(106, { id: 106, status: "fetched" });
			await expect(
				fixture.caller.captureShamelaChapters({
					bookId: 1,
					finalUrl: finalUrl!,
					html: html!,
				}),
			).rejects.toThrow();
			expect(fixture.calls).toEqual([]);
			expect(fixture.book().tocStatus).toBe("pending");
		}
	});

	test("requires a saved page before accepting a chapter capture", async () => {
		const fixture = database(true, "complete");
		await expect(
			fixture.caller.captureShamelaChapters({
				bookId: 1,
				finalUrl: rootUrl,
				html: treeHtml,
			}),
		).rejects.toThrow("Save a book page");
		expect(fixture.book().tocStatus).toBe("complete");
		expect(fixture.imports.size).toBe(0);
		expect(fixture.nodes.size).toBe(0);
	});
});
