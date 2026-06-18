import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

// ─── Book content (mirrors server, read-only after download) ─────────────────

export const localBooks = sqliteTable("local_books", {
  id: integer("id").primaryKey(), // server Book.id
  nameAr: text("name_ar"),
  nameEn: text("name_en"),
  coverColor: text("cover_color"),
  shamelaId: integer("shamela_id"),
  shamelaUrl: text("shamela_url"),
  firstShamelaPageNo: integer("first_shamela_page_no"),
  firstShamelaUrl: text("first_shamela_url"),
  lastShamelaPageNo: integer("last_shamela_page_no"),
  lastShamelaUrl: text("last_shamela_url"),
  sourceType: text("source_type"),
  editable: integer("editable", { mode: "boolean" }),
  ownerUserId: integer("owner_user_id"),
  contentHash: text("content_hash"),
  downloadedAt: integer("downloaded_at", { mode: "timestamp" }),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
});

export const localVolumes = sqliteTable("local_volumes", {
  id: integer("id").primaryKey(), // server BookVolume.id
  bookId: integer("book_id").notNull(),
  number: integer("number").notNull(),
  title: text("title"),
});

export const localPages = sqliteTable("local_pages", {
  id: integer("id").primaryKey(), // server BookPage.id
  bookId: integer("book_id").notNull(),
  volumeId: integer("volume_id"),
  shamelaPageNo: integer("shamela_page_no").notNull(),
  shamelaUrl: text("shamela_url"),
  printedPageNo: integer("printed_page_no"),
  chapterTitle: text("chapter_title"),
  topicTitle: text("topic_title"),
  previousShamelaPageNo: integer("previous_shamela_page_no"),
  previousShamelaUrl: text("previous_shamela_url"),
  nextShamelaPageNo: integer("next_shamela_page_no"),
  nextShamelaUrl: text("next_shamela_url"),
  status: text("status").notNull().default("pending"),
});

export const localTocNodes = sqliteTable("local_toc_nodes", {
  id: integer("id").primaryKey(), // server BookTocNode.id
  bookId: integer("book_id").notNull(),
  parentId: integer("parent_id"),
  pageId: integer("page_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  shamelaPath: text("shamela_path"),
  shamelaPageNo: integer("shamela_page_no"),
  volumeNumber: integer("volume_number"),
  depth: integer("depth").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  treePath: text("tree_path").notNull(),
  isCurrent: integer("is_current", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const localParagraphs = sqliteTable("local_paragraphs", {
  id: integer("id").primaryKey(), // server BookPageParagraph.id
  pageId: integer("page_id").notNull(),
  pid: integer("pid").notNull(),
  text: text("text").notNull(),
  footnoteIds: text("footnote_ids"),
});

export const localFootnotes = sqliteTable("local_footnotes", {
  id: integer("id").primaryKey(), // server BookPageFootnote.id
  pageId: integer("page_id").notNull(),
  marker: text("marker").notNull(),
  type: text("type"),
  content: text("content").notNull(),
});

// ─── User data (offline-first, bidirectional sync) ────────────────────────────

export const localHighlights = sqliteTable("local_highlights", {
  localId: text("local_id").primaryKey(), // uuid generated on client
  serverId: integer("server_id"), // BookPageHighlight.id once synced
  bookId: integer("book_id").notNull(),
  pageId: integer("page_id").notNull(),
  paragraphId: integer("paragraph_id"),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  color: text("color").notNull().default("#FFD700"),
  note: text("note"),
  quoteText: text("quote_text"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  // "synced" | "pending_create" | "pending_delete"
  syncStatus: text("sync_status").notNull().default("pending_create"),
});

export const localComments = sqliteTable("local_comments", {
  localId: text("local_id").primaryKey(), // uuid generated on client
  serverId: integer("server_id"), // BookPageComment.id once synced
  bookId: integer("book_id").notNull(),
  pageId: integer("page_id").notNull(),
  paragraphId: integer("paragraph_id"),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  // "synced" | "pending_create" | "pending_delete"
  syncStatus: text("sync_status").notNull().default("pending_create"),
});

export const localPageDrafts = sqliteTable("local_page_drafts", {
  pageId: integer("page_id").primaryKey(),
  bookId: integer("book_id").notNull(),
  contentJson: text("content_json").notNull(),
  contentHtml: text("content_html"),
  plainText: text("plain_text").notNull(),
  baseVersion: integer("base_version"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  syncStatus: text("sync_status").notNull().default("pending_update"),
});

export const localTranscriptionJobs = sqliteTable("local_transcription_jobs", {
  localId: text("local_id").primaryKey(),
  mediaId: integer("media_id").notNull(),
  telegramFileId: text("telegram_file_id"),
  audioUrl: text("audio_url"),
  fromSec: integer("from_sec"),
  toSec: integer("to_sec"),
  language: text("language").notNull().default("ar"),
  transcriberUrl: text("transcriber_url"),
  status: text("status").notNull().default("queued"),
  retryCount: integer("retry_count").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export type LocalHighlight = typeof localHighlights.$inferSelect;
export type LocalComment = typeof localComments.$inferSelect;
export type LocalPageDraft = typeof localPageDrafts.$inferSelect;
export type LocalPage = typeof localPages.$inferSelect;
export type LocalTocNode = typeof localTocNodes.$inferSelect;
export type LocalParagraph = typeof localParagraphs.$inferSelect;
export type LocalFootnote = typeof localFootnotes.$inferSelect;
export type LocalTranscriptionJob = typeof localTranscriptionJobs.$inferSelect;
