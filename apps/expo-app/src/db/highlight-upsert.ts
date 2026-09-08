import { eq } from "drizzle-orm";
import { localHighlights, type LocalHighlight } from "./local-schema";

export function highlightConflictUpdate(
	row: LocalHighlight,
	fromServer: boolean,
) {
	return {
		target: localHighlights.localId,
		// Preserve pending local edits even if a stale pull finishes after them.
		setWhere: fromServer ? eq(localHighlights.syncStatus, "synced") : undefined,
		set: {
			serverId: row.serverId,
			pageId: row.pageId,
			paragraphId: row.paragraphId,
			startOffset: row.startOffset,
			endOffset: row.endOffset,
			color: row.color,
			note: row.note,
			quoteText: row.quoteText,
			updatedAt: row.updatedAt,
			deletedAt: row.deletedAt,
			syncStatus: row.syncStatus,
		},
	};
}
