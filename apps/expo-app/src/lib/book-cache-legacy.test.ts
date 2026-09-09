import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createBookCacheRepository, type CacheSqlite, type CacheTransaction } from "./book-cache-repository";
import { findLegacyBookPage, listLegacyBooks, readLegacyBookPage, readLegacyChapters } from "./book-cache-legacy";
import { encodeReaderPage } from "./book-cache-page";

const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
async function fixture() {
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
  const cache = createBookCacheRepository(db, transaction); await cache.initialize();
  sqlite.exec(`CREATE TABLE local_books(id INTEGER PRIMARY KEY,name_ar TEXT,name_en TEXT,shamela_id INTEGER,source_type TEXT,owner_user_id INTEGER);
 CREATE TABLE local_pages(id INTEGER PRIMARY KEY,book_id INTEGER,shamela_page_no INTEGER,status TEXT,printed_page_no INTEGER,chapter_title TEXT,previous_shamela_page_no INTEGER,next_shamela_page_no INTEGER);
 CREATE TABLE local_paragraphs(id INTEGER PRIMARY KEY,page_id INTEGER,pid INTEGER,text TEXT,footnote_ids TEXT,source_marks TEXT);
 CREATE TABLE local_footnotes(id INTEGER PRIMARY KEY,page_id INTEGER,marker TEXT,type TEXT,content TEXT);
 CREATE TABLE local_toc_nodes(id INTEGER PRIMARY KEY,book_id INTEGER,parent_id INTEGER,title TEXT,sort_order INTEGER,shamela_page_no INTEGER);
 CREATE TABLE local_highlights(book_id INTEGER,page_id INTEGER,deleted_at INTEGER,sync_status TEXT);
 CREATE TABLE local_comments(book_id INTEGER,page_id INTEGER,deleted_at INTEGER,sync_status TEXT);
 CREATE TABLE local_page_drafts(book_id INTEGER,page_id INTEGER);
 INSERT INTO local_books VALUES(3,NULL,'Legacy book',23833,'shamela',NULL);
 INSERT INTO local_pages VALUES(12,3,106,'fetched',83,'Chapter',105,107),(13,3,107,'fetched',84,'Next',106,108),(14,3,108,'pending',NULL,NULL,107,NULL);
 INSERT INTO local_paragraphs VALUES(19,12,1,'Formatted text','1','[{"kind":"c5","start":0,"end":9}]');
 INSERT INTO local_footnotes VALUES(20,12,'1',NULL,'Preserved note');
 INSERT INTO local_toc_nodes VALUES(30,3,NULL,'Parent',0,106),(31,3,30,'Child',0,107);`);
  return { db, sqlite, cache };
}

test("legacy pages recover by application IDs with formatting, footnotes and adjacency", async () => {
  const { db } = await fixture();
  const result = await readLegacyBookPage(db, "guest", 3, 12);
  expect(result?.reader).toMatchObject({ id: 12, bookId: 3, shamelaPageNo: 106, printedPageNo: 83, localCache: { legacy: true }, book: { editable: false } });
  expect(result?.reader.nextShamelaUrl).toBe("https://shamela.ws/book/23833/107");
  expect(result?.reader.paragraphs[0]?.sourceMarks).toEqual([{ kind: "c5", start: 0, end: 9 }]);
  expect(result?.reader.footnotes[0]?.content).toBe("Preserved note");
  expect(encodeReaderPage(result!.reader).exportable).toBe(false);
  expect(await readLegacyBookPage(db, "guest", 4, 12)).toBeNull();
  expect(await readLegacyBookPage(db, "guest", 3, 14)).toBeNull();
  expect(await readLegacyBookPage(db, "user:1", 3, 12)).toBeNull();
});
test("source resolution and the offline shelf find legacy pages without double-counting recovered pages", async () => {
  const { db, cache } = await fixture();
  expect(await findLegacyBookPage(db, "guest", 106, { sourceBookId: 23833 })).toEqual({ bookId: 3, pageId: 12 });
  expect(await findLegacyBookPage(db, "guest", 108, { bookId: 3 })).toBeNull();
  expect((await listLegacyBooks(db, "guest"))[0]).toMatchObject({ nameEn: "Legacy book", firstPageId: 12, pageCount: 2 });
  await cache.savePage("guest", (await readLegacyBookPage(db, "guest", 3, 12))!.file, 0);
  expect((await listLegacyBooks(db, "guest"))[0]?.pageCount).toBe(1);
  expect(await listLegacyBooks(db, "user:1")).toEqual([]);
});
test("old chapter hierarchy is validated but never labelled complete", async () => {
  const { db, sqlite, cache } = await fixture();
  const chapters = await readLegacyChapters(db, "guest", 3);
  expect(chapters?.cache).toMatchObject({ complete: false, exportable: false });
  expect(chapters?.items[1]).toMatchObject({ id: 31, parentId: 30, sourcePageNo: 107 });
  expect(await cache.readChapters("guest", 3)).toBeNull();
  sqlite.exec("UPDATE local_toc_nodes SET parent_id=99 WHERE id=31");
  await expect(readLegacyChapters(db, "guest", 3)).rejects.toThrow();
});
test("explicit cache removal suppresses legacy rehydration without deleting original data", async () => {
  const { db, sqlite, cache } = await fixture();
  await cache.removeCachedPages("guest", 3);
  expect(await readLegacyBookPage(db, "guest", 3, 12)).toBeNull();
  expect(await findLegacyBookPage(db, "guest", 106, { bookId: 3 })).toBeNull();
  expect(await listLegacyBooks(db, "guest")).toEqual([]);
  expect(sqlite.query("SELECT COUNT(*) AS count FROM local_pages").get()).toEqual({ count: 3 });
});

test("cleanup keeps legacy-only annotated pages discoverable without resurrecting other pages", async () => {
  const { db, sqlite, cache } = await fixture();
  sqlite.exec("INSERT INTO local_highlights VALUES(3,13,NULL,'synced')");
  await cache.removeCachedPages("guest", 3);
  expect(await readLegacyBookPage(db, "guest", 3, 12)).toBeNull();
  expect((await readLegacyBookPage(db, "guest", 3, 13))?.reader.id).toBe(13);
  expect((await readLegacyBookPage(db, "guest", 3, 13))?.pinned).toBe(false);
  expect(await findLegacyBookPage(db, "guest", 107, { sourceBookId: 23833 })).toEqual({ bookId: 3, pageId: 13 });
  expect((await listLegacyBooks(db, "guest"))[0]).toMatchObject({ pageCount: 1, firstPageId: 13, pinned: 0 });
  expect((await readLegacyChapters(db, "guest", 3))?.items).toHaveLength(2);
  expect(await readLegacyBookPage(db, "user:1", 3, 13)).toBeNull();
});

test("private guest annotations protect legacy pages but another profile does not expose them", async () => {
  const { db, sqlite, cache } = await fixture();
  sqlite.exec(`INSERT INTO local_book_annotations(scope,local_id,book_id,page_id,revision,deleted,payload,dirty,updated_at)
 VALUES('guest','guest-note',3,12,1,0,'{}',0,1),('user:1','private-note',3,13,1,0,'{}',0,1)`);
  await cache.removeCachedPages("guest", 3);
  expect((await listLegacyBooks(db, "guest"))[0]).toMatchObject({ pageCount: 1, firstPageId: 12 });
  expect(await readLegacyBookPage(db, "guest", 3, 13)).toBeNull();
});

test("legacy drafts and pending deletions protect pages until their work is resolved", async () => {
  const { db, sqlite, cache } = await fixture();
  sqlite.exec("INSERT INTO local_page_drafts VALUES(3,12); INSERT INTO local_comments VALUES(3,13,1,'pending')");
  await cache.removeCachedPages("guest", 3);
  expect((await listLegacyBooks(db, "guest"))[0]?.pageCount).toBe(2);
  sqlite.exec("DELETE FROM local_page_drafts; UPDATE local_comments SET sync_status='synced'");
  expect(await listLegacyBooks(db, "guest")).toEqual([]);
});
