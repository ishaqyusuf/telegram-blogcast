import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./local-schema";
import { sql } from "drizzle-orm";

const expo = openDatabaseSync("al_ghurobaa.db", { enableChangeListener: true });

export const localDb = drizzle(expo, { schema });

/** Run once at app start — creates tables if they don't exist. */
export async function initLocalDb() {
  await localDb.run(sql`PRAGMA journal_mode = WAL;`);
  await localDb.run(sql`PRAGMA foreign_keys = ON;`);

  // ── Book content tables ────────────────────────────────────────────────────
  await localDb.run(sql`
    CREATE TABLE IF NOT EXISTS local_books (
      id              INTEGER PRIMARY KEY,
      name_ar         TEXT,
      name_en         TEXT,
      cover_color     TEXT,
      shamela_id      INTEGER,
      content_hash    TEXT,
      downloaded_at   INTEGER,
      last_synced_at  INTEGER
    );
  `);

  await localDb.run(sql`
    CREATE TABLE IF NOT EXISTS local_volumes (
      id      INTEGER PRIMARY KEY,
      book_id INTEGER NOT NULL,
      number  INTEGER NOT NULL,
      title   TEXT
    );
  `);

  await localDb.run(sql`
    CREATE TABLE IF NOT EXISTS local_pages (
      id              INTEGER PRIMARY KEY,
      book_id         INTEGER NOT NULL,
      volume_id       INTEGER,
      shamela_page_no INTEGER NOT NULL,
      shamela_url     TEXT,
      printed_page_no INTEGER,
      chapter_title   TEXT,
      topic_title     TEXT,
      status          TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  await localDb.run(sql`CREATE INDEX IF NOT EXISTS idx_local_pages_book ON local_pages(book_id);`);

  await localDb.run(sql`
    CREATE TABLE IF NOT EXISTS local_paragraphs (
      id           INTEGER PRIMARY KEY,
      page_id      INTEGER NOT NULL,
      pid          INTEGER NOT NULL,
      text         TEXT    NOT NULL,
      footnote_ids TEXT
    );
  `);

  await localDb.run(sql`CREATE INDEX IF NOT EXISTS idx_local_para_page ON local_paragraphs(page_id);`);

  // FTS5 virtual table for full-text search
  await localDb.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS local_paragraphs_fts
    USING fts5(text, content=local_paragraphs, content_rowid=id, tokenize='unicode61');
  `);

  // Triggers to keep FTS in sync
  await localDb.run(sql`
    CREATE TRIGGER IF NOT EXISTS local_paragraphs_ai AFTER INSERT ON local_paragraphs BEGIN
      INSERT INTO local_paragraphs_fts(rowid, text) VALUES (new.id, new.text);
    END;
  `);
  await localDb.run(sql`
    CREATE TRIGGER IF NOT EXISTS local_paragraphs_ad AFTER DELETE ON local_paragraphs BEGIN
      INSERT INTO local_paragraphs_fts(local_paragraphs_fts, rowid, text) VALUES('delete', old.id, old.text);
    END;
  `);
  await localDb.run(sql`
    CREATE TRIGGER IF NOT EXISTS local_paragraphs_au AFTER UPDATE ON local_paragraphs BEGIN
      INSERT INTO local_paragraphs_fts(local_paragraphs_fts, rowid, text) VALUES('delete', old.id, old.text);
      INSERT INTO local_paragraphs_fts(rowid, text) VALUES (new.id, new.text);
    END;
  `);

  await localDb.run(sql`
    CREATE TABLE IF NOT EXISTS local_footnotes (
      id      INTEGER PRIMARY KEY,
      page_id INTEGER NOT NULL,
      marker  TEXT    NOT NULL,
      type    TEXT,
      content TEXT    NOT NULL
    );
  `);

  await localDb.run(sql`CREATE INDEX IF NOT EXISTS idx_local_fn_page ON local_footnotes(page_id);`);

  // ── User data tables ───────────────────────────────────────────────────────
  await localDb.run(sql`
    CREATE TABLE IF NOT EXISTS local_highlights (
      local_id     TEXT    PRIMARY KEY,
      server_id    INTEGER,
      book_id      INTEGER NOT NULL,
      page_id      INTEGER NOT NULL,
      paragraph_id INTEGER,
      color        TEXT    NOT NULL DEFAULT '#FFD700',
      note         TEXT,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      deleted_at   INTEGER,
      sync_status  TEXT    NOT NULL DEFAULT 'pending_create'
    );
  `);

  await localDb.run(sql`CREATE INDEX IF NOT EXISTS idx_local_hl_page ON local_highlights(page_id);`);
  await localDb.run(sql`CREATE INDEX IF NOT EXISTS idx_local_hl_book ON local_highlights(book_id);`);

  await localDb.run(sql`
    CREATE TABLE IF NOT EXISTS local_comments (
      local_id     TEXT    PRIMARY KEY,
      server_id    INTEGER,
      book_id      INTEGER NOT NULL,
      page_id      INTEGER NOT NULL,
      paragraph_id INTEGER,
      content      TEXT    NOT NULL,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      deleted_at   INTEGER,
      sync_status  TEXT    NOT NULL DEFAULT 'pending_create'
    );
  `);

  await localDb.run(sql`CREATE INDEX IF NOT EXISTS idx_local_cm_page ON local_comments(page_id);`);
  await localDb.run(sql`CREATE INDEX IF NOT EXISTS idx_local_cm_book ON local_comments(book_id);`);
}
