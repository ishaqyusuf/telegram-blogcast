import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createBookCacheRepository, type CacheSqlite, type CacheTransaction } from "./book-cache-repository";
import type { CachedChapterFile, CachedPageFile } from "./book-cache-format";
import { mirrorBookCache } from "./book-cache-mirror";
import type { BookFileAccess } from "./book-cache-files";
import type { BookDownload } from "./book-cache-download";
import { restoreBookFiles } from "./book-cache-restore";

const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

function fixture() {
	const sqlite = new Database(":memory:");
	databases.push(sqlite);
	const db: CacheSqlite = {
		async execAsync(sql) { sqlite.exec(sql); },
		async runAsync(sql, ...params) { return sqlite.query(sql).run(...params); },
		async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]) { return sqlite.query(sql).get(...params) as T | null; },
		async getAllAsync<T>(sql: string, ...params: (string | number | null)[]) { return sqlite.query(sql).all(...params) as T[]; },
	};
	const transaction: CacheTransaction = async (work) => {
		sqlite.exec("BEGIN IMMEDIATE");
		try { const result = await work(db); sqlite.exec("COMMIT"); return result; }
		catch (error) { sqlite.exec("ROLLBACK"); throw error; }
	};
	return { sqlite, repository: createBookCacheRepository(db, transaction), reopen: () => createBookCacheRepository(db, transaction) };
}

const page = (pageId = 12, contentVersion = 1): CachedPageFile => ({
	formatVersion: 1, bookId: 3, pageId, contentVersion,
	sourceBookId: 23833, sourcePageNo: pageId + 94,
	chapterTitle: null, printedPageNo: null, previousSourcePageNo: null, nextSourcePageNo: null,
	paragraphs: [{ id: pageId * 10, pid: 1, text: `Version ${contentVersion}` }], footnotes: [], document: null, contentHtml: null,
});
const tree = (): CachedChapterFile => ({
	formatVersion: 1, bookId: 3, sourceBookId: 23833, complete: true, revision: "r1", nodeCount: 1,
	nodes: [{ id: 10, title: "Root", parentId: null, sortOrder: 0, sourcePageNo: 106 }],
});

describe("transactional book cache", () => {
	test("restoration cannot mix a different source book into existing cached identity", async () => {
		const { repository } = fixture();
		await repository.savePage("guest", page(12), 100, true);
		const wrongPage = { ...page(13), sourceBookId: 999 };
		const wrongTree = { ...tree(), sourceBookId: 999 };
		await expect(repository.savePage("guest", wrongPage, 0, false, undefined, true)).rejects.toThrow("source identity");
		await expect(repository.saveChapters("guest", wrongTree, 0, false, true)).rejects.toThrow("source identity");
		expect(await repository.readPage("guest", 3, 13)).toBeNull();
		expect(await repository.readChapters("guest", 3)).toBeNull();
		expect(await repository.readPage("guest", 3, 12)).toEqual(page(12));
		expect(await repository.pendingMirrors("guest")).toHaveLength(1);
	});
	test("restoration respects a chapter-only identity without crossing profiles", async () => {
		const { repository } = fixture();
		await repository.saveChapters("guest", tree(), 100);
		await expect(repository.savePage("guest", { ...page(), sourceBookId: 999 }, 0, false, undefined, true)).rejects.toThrow("source identity");
		expect(await repository.savePage("user:2", { ...page(), sourceBookId: 999 }, 0, false, undefined, true)).toBe(true);
		expect(await repository.readPage("guest", 3, 12)).toBeNull();
	});
	test("legacy drafts recover only into guest storage and never resurrect after clearing", async () => {
		const { repository, sqlite, reopen } = fixture();
		sqlite.exec(`CREATE TABLE local_page_drafts(book_id INTEGER,page_id INTEGER,content_json TEXT,content_html TEXT,plain_text TEXT,base_version INTEGER,updated_at INTEGER);
 INSERT INTO local_page_drafts VALUES(3,12,'{"type":"doc","version":1,"blocks":[]}','<p>Old draft</p>','Old draft',4,100);`);
		expect(await repository.readDraft("user:1", 3, 12)).toBeNull();
		const recovered = await repository.readDraft("guest", 3, 12);
		expect(recovered).toMatchObject({ plainText: "Old draft", contentHtml: "<p>Old draft</p>", baseVersion: 4, updatedAt: 100_000 });
		await repository.clearDraft("guest", 3, 12, recovered!.updatedAt);
		expect(await reopen().readDraft("guest", 3, 12)).toBeNull();
		expect(sqlite.query("SELECT COUNT(*) AS count FROM local_page_drafts").get()).toEqual({ count: 1 });
	});
	test("drafts are account-scoped, survive reopening, and protect their cached page", async () => {
		const { repository, sqlite, reopen } = fixture();
		sqlite.exec(`CREATE TABLE local_highlights(book_id INTEGER,page_id INTEGER,deleted_at INTEGER,sync_status TEXT);
 CREATE TABLE local_comments(book_id INTEGER,page_id INTEGER,deleted_at INTEGER,sync_status TEXT);
 CREATE TABLE local_page_drafts(book_id INTEGER,page_id INTEGER); INSERT INTO local_page_drafts VALUES(8,99);`);
		const draft = { bookId: 3, pageId: 12, contentJson: "{}", contentHtml: "<p>Private draft</p>", plainText: "Private draft", baseVersion: 2, updatedAt: 100 };
		await repository.savePage("user:1", page(), 100, true);
		await repository.saveDraft("user:1", draft);
		await repository.saveDraft("user:2", { ...draft, plainText: "Another account" });
		await repository.saveDraft("user:1", { ...draft, updatedAt: 99, plainText: "Delayed old save" });
		expect(await reopen().readDraft("user:1", 3, 12)).toEqual(draft);
		expect((await repository.readDraft("user:2", 3, 12))?.plainText).toBe("Another account");
		expect(await repository.readDraft("user:1", 4, 12)).toBeNull();
		expect(await repository.removeCachedPages("user:1", 3)).toEqual({ removed: 0, retained: 1 });
		await repository.clearDraft("user:1", 3, 12, 99);
		expect(await repository.readDraft("user:1", 3, 12)).toEqual(draft);
		await repository.clearDraft("user:1", 3, 12, 100);
		expect(await repository.readDraft("user:1", 3, 12)).toBeNull();
		expect(await repository.readDraft("user:2", 3, 12)).not.toBeNull();
		expect(sqlite.query("SELECT COUNT(*) AS count FROM local_page_drafts").get()).toEqual({ count: 1 });
	});
	test("folder changes republish eligible content after acknowledgement and reopening", async () => {
		const { repository, reopen } = fixture();
		await repository.savePage("user:1", page(), 100, true);
		await repository.saveChapters("user:1", tree(), 100, true);
		await repository.savePage("user:1", page(13), 0, false);
		await repository.savePage("user:2", page(14), 100, true);
		await repository.prepareMirrorDestination("user:1", "folder-a");
		for (const job of await repository.pendingMirrors("user:1")) await repository.acknowledgeMirror(job);
		const restarted = reopen();
		await restarted.prepareMirrorDestination("user:1", "folder-a");
		expect(await restarted.pendingMirrors("user:1")).toHaveLength(0);
		await restarted.prepareMirrorDestination("user:1", "folder-b");
		expect((await restarted.pendingMirrors("user:1")).map((job) => [job.kind, job.entity_id])).toEqual([["chapters", 3], ["page", 12]]);
		for (const job of await restarted.pendingMirrors("user:1")) await restarted.acknowledgeMirror(job);
		await restarted.savePage("user:1", page(12, 2), 200, false);
		await restarted.saveChapters("user:1", tree(), 200, false);
		await restarted.prepareMirrorDestination("user:1", "folder-c");
		expect(await restarted.pendingMirrors("user:1")).toHaveLength(0);
		expect(await restarted.pendingMirrors("user:2")).toHaveLength(1);
	});

	test("a failed destination switch rolls back its marker and remains retryable", async () => {
		const { repository, sqlite } = fixture();
		await repository.savePage("user:1", page(), 100, true);
		await repository.prepareMirrorDestination("user:1", "folder-a");
		for (const job of await repository.pendingMirrors("user:1")) await repository.acknowledgeMirror(job);
		sqlite.exec("CREATE TRIGGER reject_destination BEFORE UPDATE ON local_book_mirror_destinations BEGIN SELECT RAISE(ABORT,'disk failure'); END;");
		await expect(repository.prepareMirrorDestination("user:1", "folder-b")).rejects.toThrow("disk failure");
		expect(await repository.pendingMirrors("user:1")).toHaveLength(0);
		expect(sqlite.query("SELECT destination FROM local_book_mirror_destinations").get()).toEqual({ destination: "folder-a" });
		sqlite.exec("DROP TRIGGER reject_destination;");
		await repository.prepareMirrorDestination("user:1", "folder-b");
		expect(await repository.pendingMirrors("user:1")).toHaveLength(1);
	});

	test("eligibility migration trusts pending exports but not unclassified cached files", async () => {
		const { repository, sqlite, reopen } = fixture();
		await repository.savePage("user:1", page(), 100, true);
		await repository.savePage("user:1", page(13), 100, false);
		sqlite.exec("DROP TABLE local_book_exportable_content; DROP TABLE local_book_mirror_destinations; DELETE FROM local_book_cache_migrations WHERE version=4;");
		const migrated = reopen();
		await migrated.initialize();
		for (const job of await migrated.pendingMirrors("user:1")) await migrated.acknowledgeMirror(job);
		await migrated.prepareMirrorDestination("user:1", "folder-a");
		expect((await migrated.pendingMirrors("user:1")).map((job) => job.entity_id)).toEqual([12]);
	});

	test("migrations repeat safely and preserve unrelated user tables", async () => {
		const { sqlite, repository, reopen } = fixture();
		sqlite.exec("CREATE TABLE local_highlights(id INTEGER PRIMARY KEY, color TEXT); INSERT INTO local_highlights VALUES(1,'purple');");
		await repository.savePage("user:1", page(), 100);
		const reopened = reopen();
		await reopened.initialize();
		expect(await reopened.readPage("user:1", 3, 12)).toEqual(page());
		expect(sqlite.query("SELECT color FROM local_highlights").get()).toEqual({ color: "purple" });
		expect(sqlite.query("SELECT COUNT(*) AS count FROM local_book_cache_migrations").get()).toEqual({ count: 5 });
	});

	test("incremental upserts preserve other pages and separate accounts", async () => {
		const { repository } = fixture();
		await repository.savePage("user:1", page(12), 100);
		await repository.savePage("user:1", page(13), 100);
		await repository.savePage("user:1", page(12, 2), 200);
		expect(await repository.readPage("user:1", 3, 13)).toEqual(page(13));
		expect(await repository.readPage("user:1", 3, 12)).toEqual(page(12, 2));
		expect(await repository.readPage("user:2", 3, 12)).toBeNull();
		expect(await repository.findPage("user:1", 3, 106)).toBe(12);
		expect(await repository.findPage("user:2", 3, 106)).toBeNull();
	});

	test("reader metadata is private, paired with content and excluded from folder payloads", async () => {
		const { repository } = fixture();
		await repository.savePage("user:1", page(), 100, true, "private-reader-metadata");
		expect(await repository.readReaderPage("user:1", 3, 12)).toEqual({ page: page(), metadata: "private-reader-metadata" });
		expect(await repository.readReaderPage("user:2", 3, 12)).toBeNull();
		const job = (await repository.pendingMirrors("user:1"))[0]!;
		expect(await repository.mirrorPayload(job)).not.toContain("private-reader-metadata");
		expect(await repository.findSourcePage("user:1", 23833, 106)).toEqual({ bookId: 3, pageId: 12 });
		expect(await repository.findSourcePage("user:2", 23833, 106)).toBeNull();
	});

	test("download checkpoints and library entries survive reopening without mixing accounts", async () => {
		const { repository, reopen } = fixture();
		const job: BookDownload = { scope: "user:1", bookId: 3, cursor: 12, completed: 1, chaptersSaved: false, status: "paused", error: null, manifest: { bookId: 3, nameAr: null, nameEn: "My Book", sourceBookId: 23833, maxPageId: 13, totalPages: 2, revision: "r1" } };
		await repository.savePage("user:1", page(), 100);
		await repository.saveDownload(job);
		expect(await reopen().readDownload("user:1", 3)).toEqual(job);
		expect(await repository.listDownloads("user:2")).toEqual([]);
		expect(await repository.listCachedBooks("user:1")).toEqual([{ id: 3, nameAr: null, nameEn: "My Book", pageCount: 1, firstPageId: 12, pinned: 1 }]);
		expect(await repository.listCachedBooks("user:2")).toEqual([]);
	});

	test("cleanup protects notes, pending deletions, drafts, pinned books and other accounts", async () => {
		const { sqlite, repository } = fixture();
		sqlite.exec(`CREATE TABLE local_highlights(book_id INTEGER,page_id INTEGER,deleted_at INTEGER,sync_status TEXT);
 CREATE TABLE local_comments(book_id INTEGER,page_id INTEGER,deleted_at INTEGER,sync_status TEXT);
 CREATE TABLE local_page_drafts(book_id INTEGER,page_id INTEGER);
 INSERT INTO local_highlights VALUES(3,12,NULL,'synced');
 INSERT INTO local_comments VALUES(3,13,1,'pending_delete');
 INSERT INTO local_page_drafts VALUES(3,14);`);
		for (const id of [12,13,14,15]) await repository.savePage("user:1", page(id), 100, true, "metadata");
		await repository.savePage("user:2", page(15), 100);
		expect(await repository.removeCachedPages("user:1", 3)).toEqual({ removed: 1, retained: 3 });
		expect(await repository.readPage("user:1", 3, 15)).toBeNull();
		expect(await repository.readPage("user:2", 3, 15)).not.toBeNull();
		expect(sqlite.query("SELECT COUNT(*) AS count FROM local_comments").get()).toEqual({ count: 1 });
		await repository.savePage("user:1", page(15), 100);
		sqlite.exec("UPDATE local_book_cache_library SET pinned=1 WHERE scope='user:1'");
		expect(await repository.removeCachedPages("user:1")).toEqual({ removed: 0, retained: 4 });
	});

	test("folder restore fills missing pages, recovers previous copies and never overwrites saved content", async () => {
		const { repository } = fixture();
		await repository.savePage("user:1", page(12, 2), 100);
		const rows = new Map([
			["book-3/manifest.json", JSON.stringify({ formatVersion: 1, bookId: 3, sourceBookId: 23833 })],
			["book-3/chapters.json", JSON.stringify(tree())],
			["book-3/pages/page-12.json", JSON.stringify(page(12, 99))],
			["book-3/pages/page-13.json", "{broken"],
			["book-3/pages/page-13.json.previous", JSON.stringify(page(13, 99))],
			["book-3/pages/page-14.json.pending", JSON.stringify(page(14))],
		]);
		const files: BookFileAccess = { async read(path) { return rows.get(path) ?? null; }, async write() { throw new Error("Restore must not write source files"); }, async list() { return [...rows.keys()].filter((key) => key.includes("/pages/")).map((key) => key.split("/").at(-1)!); } };
		const restored = await restoreBookFiles(files, repository, "user:1", 3);
		expect(restored).toMatchObject({ restored: 1, skipped: 1, failed: 0, chaptersRestored: true });
		expect(await repository.readPage("user:1", 3, 12)).toEqual(page(12, 2));
		expect((await repository.readReaderPage("user:1", 3, 13))?.metadata).toBeNull();
		expect(await repository.readPage("user:1", 3, 14)).toBeNull();
		expect(await repository.pendingMirrors("user:1")).toEqual([]);
		expect(await repository.savePage("user:1", page(13, 1), 200)).toBe(true);
		expect((await repository.readPage("user:1", 3, 13))?.contentVersion).toBe(1);
	});

	test("pausing during chapter file read does not publish the cancelled restore", async () => {
		const { repository } = fixture();
		const controller = new AbortController();
		const files: BookFileAccess = {
			async read(path) {
				if (path === "book-3/manifest.json") return JSON.stringify({ formatVersion: 1, bookId: 3, sourceBookId: 23833 });
				if (path === "book-3/chapters.json") {
					controller.abort();
					return JSON.stringify(tree());
				}
				return null;
			},
			async write() { throw new Error("Restore must not write source files"); },
			async list() { return []; },
		};
		const result = await restoreBookFiles(files, repository, "guest", 3, { signal: controller.signal });
		expect(result).toMatchObject({ cancelled: true, chaptersRestored: false, failed: 0 });
		expect(await repository.readChapters("guest", 3)).toBeNull();
	});

	test("older versions and delayed responses cannot replace newer content", async () => {
		const { repository } = fixture();
		await repository.savePage("user:1", page(12, 2), 200);
		expect(await repository.savePage("user:1", page(12, 1), 300)).toBe(false);
		expect(await repository.savePage("user:1", page(12, 2), 100)).toBe(false);
		expect(await repository.readPage("user:1", 3, 12)).toEqual(page(12, 2));
	});

	test("failure to enqueue a mirror rolls back content replacement", async () => {
		const { sqlite, repository } = fixture();
		await repository.savePage("user:1", page(), 100);
		sqlite.exec("CREATE TRIGGER reject_mirror BEFORE INSERT ON local_book_mirror_jobs BEGIN SELECT RAISE(ABORT,'disk failure'); END;");
		await expect(repository.savePage("user:1", page(12, 2), 200, true)).rejects.toThrow("disk failure");
		expect(await repository.readPage("user:1", 3, 12)).toEqual(page());
	});

	test("mirror errors persist and an old acknowledgement cannot delete new work", async () => {
		const { repository, reopen } = fixture();
		await repository.savePage("user:1", page(), 100, true);
		const oldJob = (await repository.pendingMirrors("user:1"))[0]!;
		await repository.failMirror(oldJob, "Folder permission revoked");
		expect((await reopen().pendingMirrors("user:1"))[0]?.attempts).toBe(1);
		await repository.savePage("user:1", page(12, 2), 200, true);
		await repository.acknowledgeMirror(oldJob);
		const jobs = await repository.pendingMirrors("user:1");
		expect(jobs).toHaveLength(1);
		expect(jobs[0]?.generation).toBe(2);
		await repository.acknowledgeMirror(jobs[0]!);
		expect(await repository.pendingMirrors("user:1")).toEqual([]);
	});

	test("invalid or stale chapters retain the previous complete tree", async () => {
		const { repository } = fixture();
		await repository.saveChapters("user:1", tree(), 200, true);
		await expect(repository.saveChapters("user:1", { ...tree(), nodeCount: 2 }, 300)).rejects.toThrow();
		expect(await repository.saveChapters("user:1", { ...tree(), revision: "old" }, 100)).toBe(false);
		expect(await repository.readChapters("user:1", 3)).toEqual(tree());
		expect(await repository.readChapters("user:2", 3)).toBeNull();
		expect(await repository.pendingMirrors("user:2")).toEqual([]);
	});

	test("mirrors saved pages and chapters into database-ID folders", async () => {
		const { repository } = fixture();
		const rows = new Map<string, string>();
		const files: BookFileAccess = {
			async read(path) { return rows.get(path) ?? null; },
			async write(path, text) { rows.set(path, text); },
		};
		await repository.savePage("user:1", page(), 100, true);
		await repository.saveChapters("user:1", tree(), 100, true);
		expect(await mirrorBookCache(repository, files, "user:1")).toEqual({ saved: 2, failed: 0, cancelled: false });
		expect(JSON.parse(rows.get("book-3/pages/page-12.json")!)).toEqual(page());
		expect(JSON.parse(rows.get("book-3/chapters.json")!)).toEqual(tree());
		expect(JSON.parse(rows.get("book-3/manifest.json")!)).toEqual({ formatVersion: 1, bookId: 3, sourceBookId: 23833 });
		expect((await repository.storageSummary("user:1")).pending).toBe(0);
	});

	test("folder failures retain durable work and do not retry in a tight loop", async () => {
		const { repository } = fixture();
		await repository.savePage("user:1", page(), 100, true);
		let writes = 0;
		const files: BookFileAccess = { async read() { return null; }, async write() { writes++; throw new Error("permission revoked"); } };
		expect(await mirrorBookCache(repository, files, "user:1")).toEqual({ saved: 0, failed: 1, cancelled: false });
		expect(writes).toBe(1);
		expect((await repository.pendingMirrors("user:1"))[0]?.error).toBe("permission revoked");
		expect(await repository.readPage("user:1", 3, 12)).toEqual(page());
	});

	test("cancellation preserves pending jobs and account boundaries", async () => {
		const { repository } = fixture();
		await repository.savePage("user:1", page(), 100, true);
		const controller = new AbortController();
		controller.abort();
		const files: BookFileAccess = { async read() { throw new Error("must not read"); }, async write() { throw new Error("must not write"); } };
		expect((await mirrorBookCache(repository, files, "user:1", { signal: controller.signal })).cancelled).toBe(true);
		expect((await mirrorBookCache(repository, files, "user:2")).saved).toBe(0);
		expect((await repository.pendingMirrors("user:1")).length).toBe(1);
	});
});
