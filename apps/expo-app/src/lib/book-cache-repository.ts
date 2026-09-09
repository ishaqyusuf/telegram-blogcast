import { parseChapterFile, parsePageFile, serializePageFile, type CachedChapterFile, type CachedPageFile } from "./book-cache-format";
import type { BookDownload } from "./book-cache-download";
import { bookAnnotationMigration } from "./book-annotation-repository";
import { protectedBookPageSql } from "./book-cache-protection";

type Value = string | number | null;
export interface CacheSqlite {
	execAsync(sql: string): Promise<unknown>;
	runAsync(sql: string, ...params: Value[]): Promise<unknown>;
	getFirstAsync<T>(sql: string, ...params: Value[]): Promise<T | null>;
	getAllAsync<T>(sql: string, ...params: Value[]): Promise<T[]>;
}
export type CacheTransaction = <T>(work: (db: CacheSqlite) => Promise<T>) => Promise<T>;
type CacheRow = { payload: string; generation: number; observed_at: number; content_version: number };
export type CachedBookDraft = {
	bookId: number; pageId: number; contentJson: string; contentHtml: string | null;
	plainText: string; baseVersion: number | null; updatedAt: number;
};
export type BookMirrorJob = {
	scope: string; kind: "page" | "chapters"; entity_id: number; book_id: number;
	generation: number; attempts: number; error: string | null;
};

const migration = `
CREATE TABLE IF NOT EXISTS local_book_cache_migrations (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS local_book_cache_pages (
 scope TEXT NOT NULL, page_id INTEGER NOT NULL, book_id INTEGER NOT NULL,
 source_book_id INTEGER, source_page_no INTEGER, payload TEXT NOT NULL,
 content_version INTEGER NOT NULL, generation INTEGER NOT NULL,
 observed_at INTEGER NOT NULL, accessed_at INTEGER NOT NULL,
 PRIMARY KEY(scope, page_id)
);
CREATE INDEX IF NOT EXISTS local_book_cache_source ON local_book_cache_pages(scope, book_id, source_page_no);
CREATE INDEX IF NOT EXISTS local_book_cache_source_book ON local_book_cache_pages(scope, source_book_id, source_page_no);
CREATE TABLE IF NOT EXISTS local_book_cache_trees (
 scope TEXT NOT NULL, book_id INTEGER NOT NULL, payload TEXT NOT NULL,
 generation INTEGER NOT NULL, observed_at INTEGER NOT NULL,
 PRIMARY KEY(scope, book_id)
);
CREATE TABLE IF NOT EXISTS local_book_cache_reader_meta (
 scope TEXT NOT NULL, page_id INTEGER NOT NULL, payload TEXT NOT NULL,
 PRIMARY KEY(scope, page_id)
);
CREATE TABLE IF NOT EXISTS local_book_cache_library (
 scope TEXT NOT NULL, book_id INTEGER NOT NULL, name_ar TEXT, name_en TEXT,
 source_book_id INTEGER, pinned INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(scope, book_id)
);
CREATE TABLE IF NOT EXISTS local_book_downloads (
 scope TEXT NOT NULL, book_id INTEGER NOT NULL, status TEXT NOT NULL,
 payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(scope, book_id)
);
INSERT OR IGNORE INTO local_book_cache_library(scope,book_id,source_book_id)
 SELECT scope,book_id,source_book_id FROM local_book_cache_pages;
CREATE TABLE IF NOT EXISTS local_book_mirror_jobs (
 scope TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('page', 'chapters')),
 entity_id INTEGER NOT NULL, book_id INTEGER NOT NULL, generation INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, error TEXT,
 PRIMARY KEY(scope, kind, entity_id)
);
INSERT OR IGNORE INTO local_book_cache_migrations(version) VALUES (1);
INSERT OR IGNORE INTO local_book_cache_migrations(version) VALUES (2);
INSERT OR IGNORE INTO local_book_cache_migrations(version) VALUES (3);
CREATE TABLE IF NOT EXISTS local_book_exportable_content (
 scope TEXT NOT NULL, kind TEXT NOT NULL, entity_id INTEGER NOT NULL,
 PRIMARY KEY(scope,kind,entity_id)
);
CREATE TABLE IF NOT EXISTS local_book_mirror_destinations (
 scope TEXT PRIMARY KEY, destination TEXT NOT NULL
);
INSERT OR IGNORE INTO local_book_exportable_content(scope,kind,entity_id)
 SELECT scope,kind,entity_id FROM local_book_mirror_jobs;
INSERT OR IGNORE INTO local_book_cache_migrations(version) VALUES (4);
CREATE TABLE IF NOT EXISTS local_book_cache_drafts (
 scope TEXT NOT NULL, page_id INTEGER NOT NULL, book_id INTEGER NOT NULL,
 payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(scope,page_id)
);
INSERT OR IGNORE INTO local_book_cache_migrations(version) VALUES (5);
CREATE TABLE IF NOT EXISTS local_book_legacy_draft_imports (page_id INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS local_book_legacy_hidden (book_id INTEGER PRIMARY KEY);
`;

function checkContext(scope: string, observedAt?: number) {
	if (!scope.trim()) throw new Error("Cache account scope is required");
	if (observedAt !== undefined && (!Number.isSafeInteger(observedAt) || observedAt < 0))
		throw new Error("Invalid cache observation time");
}

export function createBookCacheRepository(db: CacheSqlite, transaction: CacheTransaction) {
	let initialization: Promise<void> | undefined;
	const initialize = () => initialization ??= transaction(async (tx) => {
		await tx.execAsync(migration);
		await tx.execAsync(bookAnnotationMigration);
	}).catch((error) => { initialization = undefined; throw error; });

	async function enqueue(tx: CacheSqlite, scope: string, kind: BookMirrorJob["kind"], entityId: number, bookId: number, generation: number) {
		await tx.runAsync(`INSERT INTO local_book_mirror_jobs(scope,kind,entity_id,book_id,generation)
 VALUES (?,?,?,?,?) ON CONFLICT(scope,kind,entity_id) DO UPDATE SET
 book_id=excluded.book_id,generation=excluded.generation,attempts=0,error=NULL`, scope, kind, entityId, bookId, generation);
	}
	async function setExportable(tx: CacheSqlite, scope: string, kind: BookMirrorJob["kind"], entityId: number, exportable: boolean) {
		if (exportable) await tx.runAsync("INSERT OR IGNORE INTO local_book_exportable_content(scope,kind,entity_id) VALUES (?,?,?)", scope, kind, entityId);
		else await tx.runAsync("DELETE FROM local_book_exportable_content WHERE scope=? AND kind=? AND entity_id=?", scope, kind, entityId);
	}
	async function validateRestoreIdentity(tx: CacheSqlite, scope: string, bookId: number, sourceBookId: number | null) {
		const conflict = await tx.getFirstAsync(`SELECT source_book_id FROM local_book_cache_pages
 WHERE scope=? AND book_id=? AND source_book_id IS NOT NULL AND source_book_id IS NOT ?
 UNION ALL SELECT source_book_id FROM local_book_cache_library
 WHERE scope=? AND book_id=? AND source_book_id IS NOT NULL AND source_book_id IS NOT ? LIMIT 1`,
			scope, bookId, sourceBookId, scope, bookId, sourceBookId);
		const tree = await tx.getFirstAsync<{ payload: string }>("SELECT payload FROM local_book_cache_trees WHERE scope=? AND book_id=?", scope, bookId);
		const treeSource = tree ? parseChapterFile(tree.payload, bookId).sourceBookId : null;
		if (conflict || (treeSource !== null && treeSource !== sourceBookId))
			throw new Error("Restored book source identity conflicts with the existing cache.");
	}

	return {
		initialize,
		async readDraft(scope: string, bookId: number, pageId: number): Promise<CachedBookDraft | null> {
			checkContext(scope);
			await initialize();
			return transaction(async (tx) => {
				const row = await tx.getFirstAsync<{ payload: string }>("SELECT payload FROM local_book_cache_drafts WHERE scope=? AND book_id=? AND page_id=?", scope, bookId, pageId);
				if (row) {
					if (scope === "guest") await tx.runAsync("INSERT OR IGNORE INTO local_book_legacy_draft_imports(page_id) VALUES (?)", pageId);
					return JSON.parse(row.payload);
				}
				if (scope !== "guest" || await tx.getFirstAsync("SELECT page_id FROM local_book_legacy_draft_imports WHERE page_id=?", pageId)) return null;
				const legacyTable = await tx.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='local_page_drafts'");
				const legacy = legacyTable ? await tx.getFirstAsync<{ content_json: string; content_html: string | null; plain_text: string; base_version: number | null; updated_at: number }>("SELECT * FROM local_page_drafts WHERE book_id=? AND page_id=?", bookId, pageId) : null;
				if (!legacy) return null;
				const draft: CachedBookDraft = { bookId, pageId, contentJson: legacy.content_json, contentHtml: legacy.content_html, plainText: legacy.plain_text, baseVersion: legacy.base_version, updatedAt: legacy.updated_at * 1000 };
				await tx.runAsync("INSERT OR IGNORE INTO local_book_cache_drafts(scope,page_id,book_id,payload,updated_at) VALUES ('guest',?,?,?,?)", pageId, bookId, JSON.stringify(draft), draft.updatedAt);
				await tx.runAsync("INSERT OR IGNORE INTO local_book_legacy_draft_imports(page_id) VALUES (?)", pageId);
				return draft;
			});
		},
		async saveDraft(scope: string, draft: CachedBookDraft) {
			checkContext(scope, draft.updatedAt);
			await initialize();
			await transaction(async (tx) => {
				const old = await tx.getFirstAsync<{ book_id: number }>("SELECT book_id FROM local_book_cache_drafts WHERE scope=? AND page_id=?", scope, draft.pageId);
				if (old && old.book_id !== draft.bookId) throw new Error("Draft cannot move between books");
				await tx.runAsync(`INSERT INTO local_book_cache_drafts(scope,page_id,book_id,payload,updated_at) VALUES (?,?,?,?,?)
 ON CONFLICT(scope,page_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at
 WHERE excluded.updated_at >= local_book_cache_drafts.updated_at`, scope, draft.pageId, draft.bookId, JSON.stringify(draft), draft.updatedAt);
				if (scope === "guest") await tx.runAsync("INSERT OR IGNORE INTO local_book_legacy_draft_imports(page_id) VALUES (?)", draft.pageId);
			});
		},
		async clearDraft(scope: string, bookId: number, pageId: number, expectedUpdatedAt: number) {
			checkContext(scope, expectedUpdatedAt);
			await initialize();
			await transaction((tx) => tx.runAsync("DELETE FROM local_book_cache_drafts WHERE scope=? AND book_id=? AND page_id=? AND updated_at=?", scope, bookId, pageId, expectedUpdatedAt));
		},
		async savePage(scope: string, input: CachedPageFile, observedAt: number, mirror = false, readerMetadata?: string, onlyIfMissing = false) {
			checkContext(scope, observedAt);
			const payload = serializePageFile(input);
			await initialize();
			return transaction(async (tx) => {
				const old = await tx.getFirstAsync<CacheRow>("SELECT * FROM local_book_cache_pages WHERE scope=? AND page_id=?", scope, input.pageId);
				if (old && onlyIfMissing) return false;
				if (onlyIfMissing) await validateRestoreIdentity(tx, scope, input.bookId, input.sourceBookId);
				if (old && !(old.observed_at === 0 && observedAt > 0) && (old.content_version > input.contentVersion || (old.content_version === input.contentVersion && old.observed_at > observedAt))) return false;
				if (old && parsePageFile(old.payload, { bookId: input.bookId, pageId: input.pageId }).bookId !== input.bookId)
					throw new Error("Page cannot move between books");
				const generation = (old?.generation ?? 0) + 1;
				await tx.runAsync("INSERT OR IGNORE INTO local_book_cache_library(scope,book_id,source_book_id) VALUES (?,?,?)", scope, input.bookId, input.sourceBookId);
				await tx.runAsync(`INSERT INTO local_book_cache_pages
 (scope,page_id,book_id,source_book_id,source_page_no,payload,content_version,generation,observed_at,accessed_at)
 VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scope,page_id) DO UPDATE SET
 source_book_id=excluded.source_book_id,source_page_no=excluded.source_page_no,payload=excluded.payload,
 content_version=excluded.content_version,generation=excluded.generation,observed_at=excluded.observed_at,accessed_at=excluded.accessed_at`,
					scope, input.pageId, input.bookId, input.sourceBookId, input.sourcePageNo, payload, input.contentVersion, generation, observedAt, Date.now());
				if (readerMetadata !== undefined) await tx.runAsync(`INSERT INTO local_book_cache_reader_meta(scope,page_id,payload) VALUES (?,?,?) ON CONFLICT(scope,page_id) DO UPDATE SET payload=excluded.payload`, scope, input.pageId, readerMetadata);
				await setExportable(tx, scope, "page", input.pageId, mirror);
				if (mirror) await enqueue(tx, scope, "page", input.pageId, input.bookId, generation);
				else await tx.runAsync("DELETE FROM local_book_mirror_jobs WHERE scope=? AND kind='page' AND entity_id=?", scope, input.pageId);
				return true;
			});
		},
		async readPage(scope: string, bookId: number, pageId: number) {
			checkContext(scope);
			await initialize();
			const row = await db.getFirstAsync<CacheRow>("SELECT payload FROM local_book_cache_pages WHERE scope=? AND book_id=? AND page_id=?", scope, bookId, pageId);
			return row ? parsePageFile(row.payload, { bookId, pageId }) : null;
		},
		async readReaderPage(scope: string, bookId: number, pageId: number) {
			checkContext(scope);
			await initialize();
			const row = await db.getFirstAsync<{ payload: string; metadata: string | null }>(`SELECT p.payload,m.payload AS metadata FROM local_book_cache_pages p LEFT JOIN local_book_cache_reader_meta m ON p.scope=m.scope AND p.page_id=m.page_id WHERE p.scope=? AND p.book_id=? AND p.page_id=?`, scope, bookId, pageId);
			return row ? { page: parsePageFile(row.payload, { bookId, pageId }), metadata: row.metadata } : null;
		},
		async findSourcePage(scope: string, sourceBookId: number, sourcePageNo: number) {
			checkContext(scope);
			await initialize();
			return db.getFirstAsync<{ bookId: number; pageId: number }>("SELECT book_id AS bookId,page_id AS pageId FROM local_book_cache_pages WHERE scope=? AND source_book_id=? AND source_page_no=? ORDER BY observed_at DESC LIMIT 1", scope, sourceBookId, sourcePageNo);
		},
		async findPage(scope: string, bookId: number, sourcePageNo: number) {
			checkContext(scope);
			await initialize();
			const row = await db.getFirstAsync<{ page_id: number }>("SELECT page_id FROM local_book_cache_pages WHERE scope=? AND book_id=? AND source_page_no=? ORDER BY observed_at DESC LIMIT 1", scope, bookId, sourcePageNo);
			return row?.page_id ?? null;
		},
		async saveChapters(scope: string, input: CachedChapterFile, observedAt: number, mirror = false, onlyIfMissing = false) {
			checkContext(scope, observedAt);
			const payload = JSON.stringify(parseChapterFile(JSON.stringify(input), input.bookId));
			await initialize();
			return transaction(async (tx) => {
				const old = await tx.getFirstAsync<CacheRow>("SELECT generation,observed_at FROM local_book_cache_trees WHERE scope=? AND book_id=?", scope, input.bookId);
				if (old && onlyIfMissing) return false;
				if (onlyIfMissing) await validateRestoreIdentity(tx, scope, input.bookId, input.sourceBookId);
				if (old && old.observed_at > observedAt) return false;
				const generation = (old?.generation ?? 0) + 1;
				await tx.runAsync(`INSERT INTO local_book_cache_trees(scope,book_id,payload,generation,observed_at) VALUES (?,?,?,?,?)
 ON CONFLICT(scope,book_id) DO UPDATE SET payload=excluded.payload,generation=excluded.generation,observed_at=excluded.observed_at`, scope, input.bookId, payload, generation, observedAt);
				await setExportable(tx, scope, "chapters", input.bookId, mirror);
				if (mirror) await enqueue(tx, scope, "chapters", input.bookId, input.bookId, generation);
				else await tx.runAsync("DELETE FROM local_book_mirror_jobs WHERE scope=? AND kind='chapters' AND entity_id=?", scope, input.bookId);
				return true;
			});
		},
		async readChapters(scope: string, bookId: number) {
			checkContext(scope);
			await initialize();
			const row = await db.getFirstAsync<CacheRow>("SELECT payload FROM local_book_cache_trees WHERE scope=? AND book_id=?", scope, bookId);
			return row ? parseChapterFile(row.payload, bookId) : null;
		},
		async prepareMirrorDestination(scope: string, destination: string) {
			checkContext(scope);
			if (!destination.trim()) throw new Error("Mirror destination is required");
			await initialize();
			await transaction(async (tx) => {
				const current = await tx.getFirstAsync<{ destination: string }>("SELECT destination FROM local_book_mirror_destinations WHERE scope=?", scope);
				if (current?.destination === destination) return;
				// Only server-verified public content is eligible, never private or restored files.
				for (const [kind, table, id] of [["page", "local_book_cache_pages", "page_id"], ["chapters", "local_book_cache_trees", "book_id"]] as const) {
					await tx.runAsync(`INSERT INTO local_book_mirror_jobs(scope,kind,entity_id,book_id,generation)
 SELECT c.scope,?,c.${id},c.book_id,c.generation FROM ${table} c
 JOIN local_book_exportable_content e ON e.scope=c.scope AND e.kind=? AND e.entity_id=c.${id}
 WHERE c.scope=? ON CONFLICT(scope,kind,entity_id) DO UPDATE SET
 book_id=excluded.book_id,generation=excluded.generation,attempts=0,error=NULL`, kind, kind, scope);
				}
				await tx.runAsync("INSERT INTO local_book_mirror_destinations(scope,destination) VALUES (?,?) ON CONFLICT(scope) DO UPDATE SET destination=excluded.destination", scope, destination);
			});
		},
		async pendingMirrors(scope: string) {
			checkContext(scope);
			await initialize();
			return db.getAllAsync<BookMirrorJob>("SELECT * FROM local_book_mirror_jobs WHERE scope=? ORDER BY attempts,book_id,entity_id LIMIT 20", scope);
		},
		async mirrorPayload(job: BookMirrorJob) {
			await initialize();
			const row = job.kind === "page"
				? await db.getFirstAsync<{ payload: string }>("SELECT payload FROM local_book_cache_pages WHERE scope=? AND page_id=? AND book_id=? AND generation=?", job.scope, job.entity_id, job.book_id, job.generation)
				: await db.getFirstAsync<{ payload: string }>("SELECT payload FROM local_book_cache_trees WHERE scope=? AND book_id=? AND generation=?", job.scope, job.book_id, job.generation);
			return row?.payload ?? null;
		},
		async storageSummary(scope: string) {
			checkContext(scope);
			await initialize();
			const pages = await db.getFirstAsync<{ count: number; bytes: number }>("SELECT COUNT(*) AS count,COALESCE(SUM(LENGTH(CAST(payload AS BLOB))),0) AS bytes FROM local_book_cache_pages WHERE scope=?", scope);
			const trees = await db.getFirstAsync<{ count: number; bytes: number }>("SELECT COUNT(*) AS count,COALESCE(SUM(LENGTH(CAST(payload AS BLOB))),0) AS bytes FROM local_book_cache_trees WHERE scope=?", scope);
			const jobs = await db.getFirstAsync<{ count: number; failed: number }>("SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END),0) AS failed FROM local_book_mirror_jobs WHERE scope=?", scope);
			return { pages: pages?.count ?? 0, trees: trees?.count ?? 0, bytes: (pages?.bytes ?? 0) + (trees?.bytes ?? 0), pending: jobs?.count ?? 0, failed: jobs?.failed ?? 0 };
		},
		async saveDownload(job: BookDownload) {
			checkContext(job.scope);
			if (job.bookId !== job.manifest.bookId || job.completed < 0 || job.cursor < 0 || job.cursor > job.manifest.maxPageId)
				throw new Error("Invalid download checkpoint.");
			await initialize();
			await transaction(async (tx) => {
				await tx.runAsync(`INSERT INTO local_book_downloads(scope,book_id,status,payload,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(scope,book_id) DO UPDATE SET status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at`, job.scope, job.bookId, job.status, JSON.stringify(job), Date.now());
				await tx.runAsync(`INSERT INTO local_book_cache_library(scope,book_id,name_ar,name_en,source_book_id,pinned) VALUES (?,?,?,?,?,1) ON CONFLICT(scope,book_id) DO UPDATE SET name_ar=excluded.name_ar,name_en=excluded.name_en,source_book_id=excluded.source_book_id,pinned=1`, job.scope, job.bookId, job.manifest.nameAr, job.manifest.nameEn, job.manifest.sourceBookId);
			});
		},
		async readDownload(scope: string, bookId: number): Promise<BookDownload | null> {
			checkContext(scope);
			await initialize();
			const row = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM local_book_downloads WHERE scope=? AND book_id=?", scope, bookId);
			return row ? JSON.parse(row.payload) : null;
		},
		async listDownloads(scope: string): Promise<BookDownload[]> {
			checkContext(scope);
			await initialize();
			const rows = await db.getAllAsync<{ payload: string }>("SELECT payload FROM local_book_downloads WHERE scope=? ORDER BY updated_at DESC", scope);
			return rows.map((row) => JSON.parse(row.payload));
		},
		async listCachedBooks(scope: string) {
			checkContext(scope);
			await initialize();
			return db.getAllAsync<{ id: number; nameAr: string | null; nameEn: string | null; pageCount: number; firstPageId: number | null; pinned: number }>(`SELECT b.book_id AS id,b.name_ar AS nameAr,b.name_en AS nameEn,b.pinned,
 (SELECT COUNT(*) FROM local_book_cache_pages p WHERE p.scope=b.scope AND p.book_id=b.book_id) AS pageCount,
 (SELECT page_id FROM local_book_cache_pages p WHERE p.scope=b.scope AND p.book_id=b.book_id ORDER BY source_page_no,page_id LIMIT 1) AS firstPageId
 FROM local_book_cache_library b WHERE b.scope=? ORDER BY COALESCE(b.name_ar,b.name_en),b.book_id`, scope);
		},
		async rememberBook(scope: string, book: { id: number; nameAr: string | null; nameEn: string | null; sourceBookId: number | null; pinned: boolean }) {
			checkContext(scope); await initialize();
			await transaction((tx) => tx.runAsync(`INSERT INTO local_book_cache_library(scope,book_id,name_ar,name_en,source_book_id,pinned) VALUES (?,?,?,?,?,?)
 ON CONFLICT(scope,book_id) DO UPDATE SET name_ar=COALESCE(local_book_cache_library.name_ar,excluded.name_ar),name_en=COALESCE(local_book_cache_library.name_en,excluded.name_en),pinned=MAX(local_book_cache_library.pinned,excluded.pinned)`, scope, book.id, book.nameAr, book.nameEn, book.sourceBookId, Number(book.pinned)));
		},
		async removeCachedPages(scope: string, bookId?: number) {
			checkContext(scope);
			await initialize();
			return transaction(async (tx) => {
				const bookFilter = bookId === undefined
					? "AND NOT EXISTS(SELECT 1 FROM local_book_cache_library b WHERE b.scope=p.scope AND b.book_id=p.book_id AND b.pinned=1)"
					: "AND p.book_id=?";
				const params: Value[] = bookId === undefined ? [scope] : [scope, bookId];
				// Legacy annotations have no reliable account attribution. Protect matching pages conservatively.
				const eligible = `SELECT p.page_id FROM local_book_cache_pages p WHERE p.scope=? ${bookFilter}
 AND NOT ${protectedBookPageSql("p.scope", "p.book_id", "p.page_id")}`;
				const selected = await tx.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM (${eligible})`, ...params);
				await tx.runAsync(`DELETE FROM local_book_mirror_jobs WHERE scope=? AND kind='page' AND entity_id IN (${eligible})`, scope, ...params);
				await tx.runAsync(`DELETE FROM local_book_exportable_content WHERE scope=? AND kind='page' AND entity_id IN (${eligible})`, scope, ...params);
				await tx.runAsync(`DELETE FROM local_book_cache_reader_meta WHERE scope=? AND page_id IN (${eligible})`, scope, ...params);
				await tx.runAsync(`DELETE FROM local_book_cache_pages WHERE scope=? AND page_id IN (${eligible})`, scope, ...params);
				if (bookId !== undefined) {
					if (scope === "guest") await tx.runAsync("INSERT OR IGNORE INTO local_book_legacy_hidden(book_id) VALUES (?)", bookId);
					await tx.runAsync("UPDATE local_book_cache_library SET pinned=0 WHERE scope=? AND book_id=?", scope, bookId);
					await tx.runAsync("DELETE FROM local_book_downloads WHERE scope=? AND book_id=?", scope, bookId);
				}
				const remaining = await tx.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM local_book_cache_pages WHERE scope=? ${bookId === undefined ? "" : "AND book_id=?"}`, ...params);
				return { removed: selected?.count ?? 0, retained: remaining?.count ?? 0 };
			});
		},
		async acknowledgeMirror(job: BookMirrorJob) {
			await initialize();
			await db.runAsync("DELETE FROM local_book_mirror_jobs WHERE scope=? AND kind=? AND entity_id=? AND generation=?", job.scope, job.kind, job.entity_id, job.generation);
		},
		async failMirror(job: BookMirrorJob, message: string) {
			await initialize();
			await db.runAsync("UPDATE local_book_mirror_jobs SET attempts=attempts+1,error=? WHERE scope=? AND kind=? AND entity_id=? AND generation=?", message.slice(0, 500), job.scope, job.kind, job.entity_id, job.generation);
		},
	};
}
