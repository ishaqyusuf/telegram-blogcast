import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createBookAnnotationRepository } from "./book-annotation-repository";
import { createBookCacheRepository, type CacheSqlite, type CacheTransaction } from "./book-cache-repository";
import { syncDeviceAnnotations, type AnnotationTransport } from "./book-annotation-sync";
import { anchorBookAnnotation } from "./book-annotation-anchor";
import type { CachedPageFile } from "./book-cache-format";

const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function fixture() {
  const sqlite = new Database(":memory:"); databases.push(sqlite);
  const db: CacheSqlite = {
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, ...params) { return sqlite.query(sql).run(...params); },
    async getFirstAsync<T>(sql: string, ...params: any[]) { return sqlite.query(sql).get(...params) as T | null; },
    async getAllAsync<T>(sql: string, ...params: any[]) { return sqlite.query(sql).all(...params) as T[]; },
  };
  const transaction: CacheTransaction = async (work) => {
    sqlite.exec("BEGIN IMMEDIATE");
    try { const result = await work(db); sqlite.exec("COMMIT"); return result; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  };
  return { sqlite, repository: createBookAnnotationRepository(db, transaction), reopen: () => createBookAnnotationRepository(db, transaction), cache: createBookCacheRepository(db, transaction) };
}
const annotation = (localId = "hl-12") => ({ localId, pageId: 12, deleted: false, payload: { kind: "highlight" as const, paragraphId: 19, paragraphPid: 1, quoteText: "Text", startOffset: 0, endOffset: 4, color: "#ffff00", note: null } });

describe("private local annotation outbox", () => {
  test("recoloring a reanchored highlight keeps its original identity and note", async () => {
    const { repository } = fixture();
    await repository.save("guest", 3, { ...annotation("original"), payload: { ...annotation().payload, note: "Keep my note" } });
    const paragraphs = [{ id: 99, pid: 1, text: "New prefix Text" }];
    const replacement = { ...annotation("replacement"), payload: { ...annotation().payload, paragraphId: 99, startOffset: 11, endOffset: 15, color: "#38bdf8" } };
    await repository.save("guest", 3, replacement, true, paragraphs);
    expect(await repository.list("guest", 3)).toEqual([
      expect.objectContaining({ localId: "original", revision: 2, payload: { ...replacement.payload, note: "Keep my note" } }),
    ]);
  });
  test("recoloring never replaces an ambiguously anchored saved highlight", async () => {
    const { repository } = fixture();
    await repository.save("guest", 3, annotation("original"));
    const paragraphs = [{ id: 99, pid: 1, text: "Text Text" }];
    await repository.save("guest", 3, { ...annotation("replacement"), payload: { ...annotation().payload, paragraphId: 99, color: "#38bdf8" } }, true, paragraphs);
    const rows = await repository.list("guest", 3);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.localId === "original")).toMatchObject({ revision: 1, payload: annotation().payload });
  });
  test("page and chapter replacements preserve private comments, colors, drafts and outbox revisions", async () => {
    const { repository, cache, reopen } = fixture();
    const page: CachedPageFile = { formatVersion: 1, bookId: 3, pageId: 12, sourceBookId: 23833, sourcePageNo: 106, contentVersion: 1, chapterTitle: null, printedPageNo: null, previousSourcePageNo: null, nextSourcePageNo: null, paragraphs: [{ id: 19, pid: 1, text: "Text" }], footnotes: [], document: null, contentHtml: "<p>Text</p>" };
    await cache.savePage("guest", page, 100);
    await repository.save("guest", 3, annotation());
    await repository.save("guest", 3, { localId: "comment-12", pageId: 12, deleted: false, payload: { kind: "comment", paragraphId: 19, paragraphPid: 1, quoteText: "Text", content: "Keep this private comment" } });
    const draft = { bookId: 3, pageId: 12, contentJson: "{}", contentHtml: "<p>Private draft</p>", plainText: "Private draft", baseVersion: 1, updatedAt: 100 };
    await cache.saveDraft("guest", draft);
    const before = await repository.list("guest", 3);
    const pending = await repository.pending("guest", 3);
    const replacement = { ...page, contentVersion: 2, paragraphs: [{ id: 99, pid: 1, text: "New prefix Text" }], contentHtml: "<p>New prefix <b>Text</b></p>" };
    await cache.savePage("guest", replacement, 200);
    await cache.saveChapters("guest", { formatVersion: 1, bookId: 3, sourceBookId: 23833, complete: true, revision: "new-tree", nodeCount: 1, nodes: [{ id: 5, title: "New chapter", parentId: null, sortOrder: 0, sourcePageNo: 106 }] }, 200);
    const after = await reopen().list("guest", 3);
    expect(after).toEqual(before);
    expect(await reopen().pending("guest", 3)).toEqual(pending);
    expect(await cache.readDraft("guest", 3, 12)).toEqual(draft);
    expect(await reopen().list("user:another", 3)).toEqual([]);
    expect(after.map((row) => anchorBookAnnotation(row, replacement.paragraphs))).toEqual(expect.arrayContaining([
      expect.objectContaining({ anchorStatus: "matched", payload: expect.objectContaining({ kind: "comment", paragraphId: 99, content: "Keep this private comment" }) }),
      expect.objectContaining({ anchorStatus: "matched", payload: expect.objectContaining({ kind: "highlight", paragraphId: 99, color: "#ffff00", startOffset: 11, endOffset: 15 }) }),
    ]));
  });
  test("recoloring is atomic, preserves identity and note, and collapses duplicate ranges", async () => {
    const { repository, sqlite, reopen } = fixture();
    const original = { ...annotation("first"), payload: { ...annotation().payload, note: "Keep this note" } };
    await repository.save("guest", 3, original);
    await repository.save("guest", 3, annotation("second"));
    const replacement = { ...annotation("new"), payload: { ...annotation().payload, color: "#f97316" } };
    sqlite.exec("CREATE TRIGGER fail_recolor BEFORE UPDATE ON local_book_annotations WHEN NEW.local_id='first' BEGIN SELECT RAISE(ABORT,'disk full'); END;");
    await expect(repository.save("guest", 3, replacement, true)).rejects.toThrow("disk full");
    expect(await repository.list("guest", 3)).toHaveLength(2);
    expect((await repository.list("guest", 3))[0]?.payload).toEqual(original.payload);
    sqlite.exec("DROP TRIGGER fail_recolor");
    await repository.save("guest", 3, replacement, true);
    await repository.save("guest", 3, { ...replacement, localId: "another-tap" }, true);
    const rows = await reopen().list("guest", 3);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ localId: "first", payload: { color: "#f97316", note: "Keep this note" } });
    expect((await repository.pending("guest", 3)).find((row) => row.localId === "second")?.deleted).toBe(true);
  });
  test("legacy device annotations are copied once without upload or resurrection", async () => {
    const { repository } = fixture();
    const old = { ...annotation("legacy-hl-server-1"), revision: 1, updatedAt: 100 };
    await repository.importLegacy(3, [old]);
    expect(await repository.hasLegacyImport(3)).toBe(true);
    expect((await repository.list("guest", 3))[0]?.updatedAt).toBe(100);
    expect(await repository.pending("guest", 3)).toEqual([]);
    expect(await repository.list("user:1", 3)).toEqual([]);
    await repository.remove("guest", 3, old.localId);
    await repository.importLegacy(3, [old]);
    expect(await repository.list("guest", 3)).toEqual([]);
    expect(await repository.pendingBooks("guest")).toEqual([3]);
    expect(await repository.pendingBooks("user:1")).toEqual([]);
  });
  test("unsupported servers never receive guest annotations", async () => {
    const { repository } = fixture();
    await repository.save("guest", 3, annotation());
    let pushed = false;
    const transport: AnnotationTransport = { capabilities: async () => ({ protocol: 0, ownership: "shared" }), push: async () => { pushed = true; return []; }, list: async () => ({ items: [], nextCursor: null }) };
    await expect(syncDeviceAnnotations(repository, transport, "guest", 3, new AbortController().signal)).rejects.toThrow("not supported");
    expect(pushed).toBe(false);
    expect(await repository.pending("guest", 3)).toHaveLength(1);
  });
  test("a dropped response retains the outbox and replay uses exactly the same revision", async () => {
    const { repository } = fixture();
    await repository.save("guest", 3, annotation());
    const calls: unknown[] = [];
    const transport: AnnotationTransport = { capabilities: async () => ({ protocol: 1, ownership: "device" }), push: async (items) => { calls.push(items); if (calls.length === 1) throw new Error("Response lost"); return items.map((item) => ({ ...item, bookId: 3 })); }, list: async () => ({ items: [], nextCursor: null }) };
    await expect(syncDeviceAnnotations(repository, transport, "guest", 3, new AbortController().signal)).rejects.toThrow("Response lost");
    expect(await repository.pending("guest", 3)).toHaveLength(1);
    await syncDeviceAnnotations(repository, transport, "guest", 3, new AbortController().signal);
    expect(calls[0]).toEqual(calls[1]);
    expect(await repository.pending("guest", 3)).toHaveLength(0);
  });
  test("cancellation after server receipt leaves work retryable", async () => {
    const { repository } = fixture();
    await repository.save("guest", 3, annotation());
    const controller = new AbortController();
    const transport: AnnotationTransport = { capabilities: async () => ({ protocol: 1, ownership: "device" }), push: async (items) => { controller.abort(); return items.map((item) => ({ ...item, bookId: 3 })); }, list: async () => ({ items: [], nextCursor: null }) };
    await expect(syncDeviceAnnotations(repository, transport, "guest", 3, controller.signal)).rejects.toThrow("paused");
    expect(await repository.pending("guest", 3)).toHaveLength(1);
  });
  test("persists annotations and unsent work across restart without crossing scopes", async () => {
    const { repository, reopen } = fixture();
    await repository.save("guest", 3, annotation());
    expect((await reopen().list("guest", 3, 12))[0]?.payload).toEqual(annotation().payload);
    expect(await repository.list("user:1", 3)).toEqual([]);
    expect(await reopen().pending("guest", 3)).toHaveLength(1);
  });
  test("an old create acknowledgement cannot clear a newer deletion", async () => {
    const { repository } = fixture();
    const submitted = await repository.save("guest", 3, annotation());
    await repository.remove("guest", 3, submitted.localId);
    await repository.acknowledge("guest", 3, [submitted]);
    expect(await repository.list("guest", 3)).toEqual([]);
    const pending = (await repository.pending("guest", 3))[0]!;
    expect(pending).toMatchObject({ revision: 2, deleted: true, dirty: true });
    await repository.acknowledge("guest", 3, [{ ...annotation(), revision: 2, deleted: true }]);
    expect(await repository.pending("guest", 3)).toEqual([]);
    await repository.mergeRemote("guest", 3, [submitted]);
    expect(await repository.list("guest", 3)).toEqual([]);
  });
  test("pulls cannot overwrite unsent edits and acknowledged revisions stay unchanged on replay", async () => {
    const { repository } = fixture();
    await repository.mergeRemote("guest", 3, [{ ...annotation(), revision: 1 }]);
    const edit = await repository.save("guest", 3, { ...annotation(), payload: { ...annotation().payload, color: "#ff0000" } });
    await repository.mergeRemote("guest", 3, [{ ...annotation(), revision: 9 }]);
    expect((await repository.list("guest", 3))[0]?.revision).toBe(2);
    await repository.acknowledge("guest", 3, [{ ...annotation(), revision: 2 }]);
    expect(await repository.pending("guest", 3)).toHaveLength(1);
    await repository.acknowledge("guest", 3, [edit]);
    expect(await repository.pending("guest", 3)).toHaveLength(0);
  });
  test("rejects identity changes and invalid batches without partial writes", async () => {
    const { repository } = fixture();
    await repository.mergeRemote("guest", 3, [{ ...annotation(), revision: 1 }]);
    await expect(repository.save("guest", 4, annotation())).rejects.toThrow("identity");
    await expect(repository.mergeRemote("guest", 3, [{ ...annotation("new"), revision: 1 }, { ...annotation(), pageId: 99, revision: 2 }])).rejects.toThrow("identity");
    expect(await repository.list("guest", 3)).toHaveLength(1);
  });
  test("outbox batches stay bounded and old failure reports do not affect new edits", async () => {
    const { repository } = fixture();
    const submitted = await repository.save("guest", 3, annotation());
    await repository.save("guest", 3, annotation());
    await repository.fail("guest", 3, submitted, "Old failure");
    expect((await repository.list("guest", 3))[0]?.error).toBeNull();
    for (let i = 0; i < 22; i++) await repository.save("guest", 3, annotation(`new-${i}`));
    expect(await repository.pending("guest", 3)).toHaveLength(20);
  });
  test("cache eviction preserves pages with private annotations or unsent deletion tombstones", async () => {
    const { repository, cache, sqlite } = fixture();
    sqlite.exec("CREATE TABLE local_highlights(book_id INTEGER,page_id INTEGER,deleted_at INTEGER,sync_status TEXT); CREATE TABLE local_comments(book_id INTEGER,page_id INTEGER,deleted_at INTEGER,sync_status TEXT); CREATE TABLE local_page_drafts(book_id INTEGER,page_id INTEGER);");
    await cache.savePage("guest", { formatVersion: 1, bookId: 3, pageId: 12, sourceBookId: 23833, sourcePageNo: 106, contentVersion: 1, chapterTitle: null, printedPageNo: null, previousSourcePageNo: null, nextSourcePageNo: null, paragraphs: [], footnotes: [], document: null, contentHtml: null }, 100);
    await repository.save("guest", 3, annotation());
    expect(await cache.removeCachedPages("guest", 3)).toEqual({ removed: 0, retained: 1 });
    await repository.remove("guest", 3, "hl-12");
    expect(await cache.removeCachedPages("guest", 3)).toEqual({ removed: 0, retained: 1 });
    await repository.acknowledge("guest", 3, [{ ...annotation(), revision: 2, deleted: true }]);
    expect(await cache.removeCachedPages("guest", 3)).toEqual({ removed: 1, retained: 0 });
  });
});
