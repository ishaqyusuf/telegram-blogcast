import { annotationId, annotationScope, deviceAnnotation, type DeviceAnnotation } from "@acme/utils/book-annotation";
import type { CacheSqlite, CacheTransaction } from "./book-cache-repository";
import { anchorBookAnnotation } from "./book-annotation-anchor";
import type { CachedPageFile } from "./book-cache-format";

export const bookAnnotationMigration = `CREATE TABLE IF NOT EXISTS local_book_annotations (
 scope TEXT NOT NULL, local_id TEXT NOT NULL, book_id INTEGER NOT NULL, page_id INTEGER NOT NULL,
 revision INTEGER NOT NULL, deleted INTEGER NOT NULL, payload TEXT NOT NULL, dirty INTEGER NOT NULL,
 updated_at INTEGER NOT NULL, error TEXT, PRIMARY KEY(scope,local_id)
);
CREATE INDEX IF NOT EXISTS local_book_annotations_page ON local_book_annotations(scope,book_id,page_id);
CREATE INDEX IF NOT EXISTS local_book_annotations_outbox ON local_book_annotations(scope,book_id,dirty);
CREATE TABLE IF NOT EXISTS local_book_annotation_legacy (book_id INTEGER PRIMARY KEY);
`;
type Row = { scope: string; local_id: string; book_id: number; page_id: number; revision: number; deleted: number; payload: string; dirty: number; updated_at: number; error: string | null };
export type LocalDeviceAnnotation = DeviceAnnotation & { bookId: number; updatedAt: number; dirty: boolean; error: string | null };
function decode(row: Row): LocalDeviceAnnotation {
  return { ...deviceAnnotation.parse({ localId: row.local_id, pageId: row.page_id, revision: row.revision, deleted: Boolean(row.deleted), payload: JSON.parse(row.payload) }), bookId: row.book_id, updatedAt: row.updated_at, dirty: Boolean(row.dirty), error: row.error };
}
function same(row: Row, incoming: DeviceAnnotation) {
  return row.page_id === incoming.pageId && row.revision === incoming.revision && Boolean(row.deleted) === incoming.deleted && JSON.stringify(decode(row).payload) === JSON.stringify(incoming.payload);
}

export function createBookAnnotationRepository(db: CacheSqlite, transaction: CacheTransaction) {
  let initialization: Promise<unknown> | undefined;
  const initialize = () => initialization ??= transaction((tx) => tx.execAsync(bookAnnotationMigration)).catch((error) => { initialization = undefined; throw error; });
  async function validate(scope: string, bookId: number) { annotationScope.parse(scope); annotationId.parse(bookId); await initialize(); }
  async function store(tx: CacheSqlite, scope: string, bookId: number, item: DeviceAnnotation, dirty: boolean, now: number) {
    await tx.runAsync(`INSERT INTO local_book_annotations(scope,local_id,book_id,page_id,revision,deleted,payload,dirty,updated_at)
 VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(scope,local_id) DO UPDATE SET revision=excluded.revision,deleted=excluded.deleted,payload=excluded.payload,dirty=excluded.dirty,updated_at=excluded.updated_at,error=NULL`, scope, item.localId, bookId, item.pageId, item.revision, Number(item.deleted), JSON.stringify(item.payload), Number(dirty), now);
  }
  return {
    initialize,
    async hasLegacyImport(bookId: number) {
      await initialize();
      return Boolean(await db.getFirstAsync("SELECT book_id FROM local_book_annotation_legacy WHERE book_id=?", bookId));
    },
    async importLegacy(bookId: number, values: (DeviceAnnotation & { updatedAt: number })[]) {
      await validate("guest", bookId);
      const items = values.map((value) => ({ item: deviceAnnotation.parse({ localId: value.localId, pageId: value.pageId, revision: value.revision, deleted: value.deleted, payload: value.payload }), updatedAt: value.updatedAt }));
      await transaction(async (tx) => {
        if (await tx.getFirstAsync("SELECT book_id FROM local_book_annotation_legacy WHERE book_id=?", bookId)) return;
        for (const { item, updatedAt } of items) {
          const old = await tx.getFirstAsync("SELECT local_id FROM local_book_annotations WHERE scope='guest' AND local_id=?", item.localId);
          if (!old) await store(tx, "guest", bookId, item, false, updatedAt);
        }
        await tx.runAsync("INSERT OR IGNORE INTO local_book_annotation_legacy(book_id) VALUES (?)", bookId);
      });
    },
    async list(scope: string, bookId: number, pageId?: number) {
      await validate(scope, bookId);
      const rows = await db.getAllAsync<Row>(`SELECT * FROM local_book_annotations WHERE scope=? AND book_id=? AND deleted=0 ${pageId === undefined ? "" : "AND page_id=?"} ORDER BY page_id,updated_at,local_id`, ...[scope, bookId, ...(pageId === undefined ? [] : [pageId])]);
      return rows.map(decode);
    },
    async save(scope: string, bookId: number, value: Omit<DeviceAnnotation, "revision">, replaceOverlaps = false, paragraphs?: CachedPageFile["paragraphs"]) {
      await validate(scope, bookId);
      return transaction(async (tx) => {
        if (replaceOverlaps && value.payload.kind === "highlight" && !value.deleted) {
          const payload = value.payload;
          const rows = await tx.getAllAsync<Row>("SELECT * FROM local_book_annotations WHERE scope=? AND book_id=? AND page_id=? AND deleted=0 ORDER BY local_id", scope, bookId, value.pageId);
          const overlaps = rows.filter((row) => {
            const stored = decode(row);
            const old = paragraphs ? anchorBookAnnotation(stored, paragraphs).payload : stored.payload;
            return old.kind === "highlight" && old.paragraphId === payload.paragraphId && old.startOffset !== null && old.endOffset !== null && payload.startOffset !== null && payload.endOffset !== null && old.startOffset < payload.endOffset && old.endOffset > payload.startOffset;
          });
          const first = overlaps[0];
          if (first) {
            const original = decode(first).payload;
            value = { ...value, localId: first.local_id, payload: { ...payload, note: payload.note ?? (original.kind === "highlight" ? original.note : null) } };
            for (const duplicate of overlaps.slice(1)) {
              const previous = decode(duplicate);
              const tombstone = deviceAnnotation.parse({ localId: previous.localId, pageId: previous.pageId, payload: previous.payload, revision: duplicate.revision + 1, deleted: true });
              await store(tx, scope, bookId, tombstone, true, Date.now());
            }
          }
        }
        const old = await tx.getFirstAsync<Row>("SELECT * FROM local_book_annotations WHERE scope=? AND local_id=?", scope, value.localId);
        const incoming = deviceAnnotation.parse({ ...value, revision: (old?.revision ?? 0) + 1 });
        if (old && (old.book_id !== bookId || old.page_id !== incoming.pageId || decode(old).payload.kind !== incoming.payload.kind)) throw new Error("Annotation identity cannot change");
        await store(tx, scope, bookId, incoming, true, Date.now());
        return incoming;
      });
    },
    async remove(scope: string, bookId: number, localId: string) {
      await validate(scope, bookId);
      await transaction(async (tx) => {
        const old = await tx.getFirstAsync<Row>("SELECT * FROM local_book_annotations WHERE scope=? AND book_id=? AND local_id=?", scope, bookId, localId);
        if (!old || old.deleted) return;
        const { payload, pageId } = decode(old);
        const incoming = deviceAnnotation.parse({ localId, pageId, revision: old.revision + 1, deleted: true, payload });
        await store(tx, scope, bookId, incoming, true, Date.now());
      });
    },
    async pending(scope: string, bookId: number) {
      await validate(scope, bookId);
      return (await db.getAllAsync<Row>("SELECT * FROM local_book_annotations WHERE scope=? AND book_id=? AND dirty=1 ORDER BY updated_at,local_id LIMIT 20", scope, bookId)).map(decode);
    },
    async pendingBooks(scope: string) {
      annotationScope.parse(scope); await initialize();
      return (await db.getAllAsync<{ book_id: number }>("SELECT DISTINCT book_id FROM local_book_annotations WHERE scope=? AND dirty=1 ORDER BY book_id LIMIT 100", scope)).map((row) => row.book_id);
    },
    async acknowledge(scope: string, bookId: number, response: DeviceAnnotation[]) {
      await validate(scope, bookId);
      const items = response.map((item) => deviceAnnotation.parse(item));
      await transaction(async (tx) => {
        for (const item of items) {
          const old = await tx.getFirstAsync<Row>("SELECT * FROM local_book_annotations WHERE scope=? AND book_id=? AND local_id=?", scope, bookId, item.localId);
          if (old && same(old, item)) await tx.runAsync("UPDATE local_book_annotations SET dirty=0,error=NULL WHERE scope=? AND local_id=? AND revision=?", scope, item.localId, item.revision);
        }
      });
    },
    async mergeRemote(scope: string, bookId: number, response: DeviceAnnotation[]) {
      await validate(scope, bookId);
      const items = response.map((item) => deviceAnnotation.parse(item));
      await transaction(async (tx) => {
        for (const incoming of items) {
          const old = await tx.getFirstAsync<Row>("SELECT * FROM local_book_annotations WHERE scope=? AND local_id=?", scope, incoming.localId);
          if (old && (old.book_id !== bookId || old.page_id !== incoming.pageId || decode(old).payload.kind !== incoming.payload.kind)) throw new Error("Remote annotation identity mismatch");
          // Pulls never clobber unsent edits, including deletion tombstones.
          if (old && (old.dirty || old.revision >= incoming.revision)) continue;
          await store(tx, scope, bookId, incoming, false, Date.now());
        }
      });
    },
    async fail(scope: string, bookId: number, item: DeviceAnnotation, error: string) {
      await validate(scope, bookId);
      await transaction((tx) => tx.runAsync("UPDATE local_book_annotations SET error=? WHERE scope=? AND book_id=? AND local_id=? AND revision=? AND dirty=1", error.slice(0, 500), scope, bookId, item.localId, item.revision));
    },
  };
}
