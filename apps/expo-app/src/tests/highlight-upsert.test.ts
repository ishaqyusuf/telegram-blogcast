import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { localHighlights, type LocalHighlight } from "../db/local-schema";
import { highlightConflictUpdate } from "../db/highlight-upsert";

test("server refresh preserves a pending offline deletion and saved colors", () => {
	const sqlite = new Database(":memory:");
	try {
		sqlite.exec(`CREATE TABLE local_highlights (
      local_id TEXT PRIMARY KEY, server_id INTEGER, book_id INTEGER, page_id INTEGER,
      paragraph_id INTEGER, start_offset INTEGER, end_offset INTEGER, color TEXT,
      note TEXT, quote_text TEXT, created_at INTEGER, updated_at INTEGER,
      deleted_at INTEGER, sync_status TEXT)`);
		const db = drizzle(sqlite);
		const row: LocalHighlight = {
			localId: "server-1",
			serverId: 1,
			bookId: 3,
			pageId: 170,
			paragraphId: 9,
			startOffset: 0,
			endOffset: 5,
			color: "#22c55e",
			quoteText: "Quote",
			note: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: new Date(),
			syncStatus: "pending_delete",
		};
		db.insert(localHighlights).values(row).run();
		const stale = {
			...row,
			deletedAt: null,
			syncStatus: "synced",
			color: "#8b5cf6",
		};
		db.insert(localHighlights)
			.values(stale)
			.onConflictDoUpdate(highlightConflictUpdate(stale, true))
			.run();
		expect(db.select().from(localHighlights).all()[0]).toMatchObject({
			color: "#22c55e",
			syncStatus: "pending_delete",
			deletedAt: expect.any(Date),
		});
		const local = {
			...row,
			deletedAt: null,
			syncStatus: "synced",
			color: "#facc15",
		};
		db.insert(localHighlights)
			.values(local)
			.onConflictDoUpdate(highlightConflictUpdate(local, false))
			.run();
		expect(db.select().from(localHighlights).all()[0]?.color).toBe("#facc15");
	} finally {
		sqlite.close();
	}
});
