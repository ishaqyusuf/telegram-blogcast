import { createBookDocumentFromParagraphs } from "@acme/document/book";
import { parseChapterFile, parsePageFile, serializePageFile } from "./book-cache-format";
import { decodeReaderPage } from "./book-cache-page";
import type { CacheSqlite } from "./book-cache-repository";
import { protectedBookPageSql } from "./book-cache-protection";

const visiblePage = `(NOT EXISTS(SELECT 1 FROM local_book_legacy_hidden hidden WHERE hidden.book_id=p.book_id)
 OR ${protectedBookPageSql("'guest'", "p.book_id", "p.id")})`;

type LegacyBook = { id: number; name_ar: string | null; name_en: string | null; shamela_id: number | null; source_type: string | null; owner_user_id: number | null };
type LegacyPage = { id: number; book_id: number; volume_id: number | null; shamela_page_no: number; shamela_url: string | null; printed_page_no: number | null; chapter_title: string | null; topic_title: string | null; previous_shamela_page_no: number | null; next_shamela_page_no: number | null; status: string };

async function available(db: CacheSqlite, scope: string, bookId?: number) {
  if (scope !== "guest") return false;
  if (!await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='local_books'")) return false;
  if (bookId !== undefined && !await db.getFirstAsync(`SELECT p.id FROM local_pages p WHERE p.book_id=? AND p.status='fetched' AND ${visiblePage} LIMIT 1`, bookId)) return false;
  return true;
}

export async function readLegacyBookPage(db: CacheSqlite, scope: string, bookId: number, pageId: number) {
  if (!await available(db, scope, bookId)) return null;
  const page = await db.getFirstAsync<LegacyPage>(`SELECT p.* FROM local_pages p WHERE p.id=? AND p.book_id=? AND p.status='fetched' AND ${visiblePage}`, pageId, bookId);
  const book = await db.getFirstAsync<LegacyBook>("SELECT * FROM local_books WHERE id=?", bookId);
  if (!page || !book) return null;
  const paragraphs = (await db.getAllAsync<{ id: number; pid: number; text: string; footnote_ids: string | null; source_marks: string | null }>("SELECT * FROM local_paragraphs WHERE page_id=? ORDER BY pid,id", pageId))
    .map((row) => ({ id: row.id, pid: row.pid, text: row.text, footnoteIds: row.footnote_ids ?? null, sourceMarks: row.source_marks ? JSON.parse(row.source_marks) : null }));
  const footnotes = (await db.getAllAsync<{ id: number; marker: string; type: string | null; content: string }>("SELECT * FROM local_footnotes WHERE page_id=? ORDER BY id", pageId))
    .map(({ id, marker, type, content }) => ({ id, marker, type: type ?? null, content }));
  const file = parsePageFile(serializePageFile({
    formatVersion: 1, bookId, pageId, sourceBookId: book.shamela_id ?? null, sourcePageNo: book.shamela_id ? page.shamela_page_no : null,
    contentVersion: 0, chapterTitle: page.chapter_title ?? null, printedPageNo: page.printed_page_no ?? null,
    previousSourcePageNo: page.previous_shamela_page_no ?? null, nextSourcePageNo: page.next_shamela_page_no ?? null,
    paragraphs, footnotes, document: createBookDocumentFromParagraphs(paragraphs), contentHtml: null,
  }), { bookId, pageId });
  const reader = decodeReaderPage(file, null);
  reader.localCache = { legacy: true };
  reader.book = { ...reader.book, sourceType: book.source_type ?? (book.shamela_id ? "shamela" : "user"), ownerUserId: book.owner_user_id ?? null, editable: false };
  reader.topicTitle = page.topic_title ?? null;
  reader.volumeId = page.volume_id ?? null;
  if (page.volume_id) reader.volume = await db.getFirstAsync<{ id: number; number: number; title: string | null }>("SELECT id,number,title FROM local_volumes WHERE id=? AND book_id=?", page.volume_id, bookId);
  const hidden = await db.getFirstAsync("SELECT book_id FROM local_book_legacy_hidden WHERE book_id=?", bookId);
  return { reader, file, nameAr: book.name_ar, nameEn: book.name_en, pinned: !hidden };
}

export async function findLegacyBookPage(db: CacheSqlite, scope: string, sourcePageNo: number, identity: { bookId: number } | { sourceBookId: number }) {
  if (!await available(db, scope)) return null;
  return db.getFirstAsync<{ bookId: number; pageId: number }>(`SELECT p.book_id AS bookId,p.id AS pageId FROM local_pages p JOIN local_books b ON b.id=p.book_id
 WHERE p.status='fetched' AND p.shamela_page_no=? AND ${"bookId" in identity ? "b.id" : "b.shamela_id"}=?
 AND ${visiblePage} LIMIT 1`, sourcePageNo, "bookId" in identity ? identity.bookId : identity.sourceBookId);
}

export async function readLegacyChapters(db: CacheSqlite, scope: string, bookId: number) {
  if (!await available(db, scope, bookId)) return null;
  const book = await db.getFirstAsync<LegacyBook>("SELECT * FROM local_books WHERE id=?", bookId);
  if (!book) return null;
  const nodes = await db.getAllAsync<{ id: number; parentId: number | null; title: string; sortOrder: number; sourcePageNo: number | null }>("SELECT id,parent_id AS parentId,title,sort_order AS sortOrder,shamela_page_no AS sourcePageNo FROM local_toc_nodes WHERE book_id=? ORDER BY id", bookId);
  if (!nodes.length) return null;
  const checked = parseChapterFile(JSON.stringify({ formatVersion: 1, bookId, sourceBookId: book.shamela_id, complete: true, revision: "legacy-unverified", nodeCount: nodes.length, nodes }), bookId);
  const { nodes: items, ...cache } = checked;
  return { items, cache: { ...cache, complete: false, exportable: false } };
}

export async function listLegacyBooks(db: CacheSqlite, scope: string) {
  if (!await available(db, scope)) return [];
  return db.getAllAsync<{ id: number; nameAr: string | null; nameEn: string | null; pageCount: number; firstPageId: number | null; pinned: number }>(`SELECT b.id,b.name_ar AS nameAr,b.name_en AS nameEn,
 NOT EXISTS(SELECT 1 FROM local_book_legacy_hidden hidden WHERE hidden.book_id=b.id) AS pinned,
 (SELECT COUNT(*) FROM local_pages p WHERE p.book_id=b.id AND p.status='fetched' AND ${visiblePage} AND NOT EXISTS(SELECT 1 FROM local_book_cache_pages c WHERE c.scope='guest' AND c.page_id=p.id)) AS pageCount,
 (SELECT id FROM local_pages p WHERE p.book_id=b.id AND p.status='fetched' AND ${visiblePage} ORDER BY shamela_page_no,id LIMIT 1) AS firstPageId
 FROM local_books b WHERE EXISTS(SELECT 1 FROM local_pages p WHERE p.book_id=b.id AND p.status='fetched' AND ${visiblePage})`);
}
