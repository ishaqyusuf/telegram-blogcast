// Arguments are internal SQL expressions, never user-supplied values.
export function protectedBookPageSql(scope: string, bookId: string, pageId: string) {
  return `(EXISTS(SELECT 1 FROM local_highlights h WHERE h.book_id=${bookId} AND h.page_id=${pageId} AND (h.deleted_at IS NULL OR h.sync_status!='synced'))
 OR EXISTS(SELECT 1 FROM local_comments c WHERE c.book_id=${bookId} AND c.page_id=${pageId} AND (c.deleted_at IS NULL OR c.sync_status!='synced'))
 OR EXISTS(SELECT 1 FROM local_page_drafts d WHERE d.book_id=${bookId} AND d.page_id=${pageId})
 OR EXISTS(SELECT 1 FROM local_book_cache_drafts d WHERE d.scope=${scope} AND d.book_id=${bookId} AND d.page_id=${pageId})
 OR EXISTS(SELECT 1 FROM local_book_annotations a WHERE a.scope=${scope} AND a.book_id=${bookId} AND a.page_id=${pageId} AND (a.deleted=0 OR a.dirty=1)))`;
}
