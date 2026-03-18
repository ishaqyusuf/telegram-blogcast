/**
 * use-highlights-sync.ts
 * Offline-first highlights: write to SQLite immediately, sync to server in background.
 */
import { useCallback, useEffect, useState } from "react";
import { localDb } from "@/db/local-db";
import { localHighlights, LocalHighlight } from "@/db/local-schema";
import { eq, and, isNull } from "drizzle-orm";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import NetInfo from "@react-native-community/netinfo";

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHighlightsSync(bookId: number, pageId: number) {
  const [highlights, setHighlights] = useState<LocalHighlight[]>([]);

  const load = useCallback(async () => {
    const rows = await localDb
      .select()
      .from(localHighlights)
      .where(
        and(
          eq(localHighlights.pageId, pageId),
          isNull(localHighlights.deletedAt)
        )
      );
    setHighlights(rows);
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  // ─── Add highlight ────────────────────────────────────────────────────────

  const addHighlight = useCallback(
    async (paragraphId: number, color: string, note?: string) => {
      const now = new Date();
      const localId = uuid();
      await localDb.insert(localHighlights).values({
        localId,
        bookId,
        pageId,
        paragraphId,
        color,
        note: note ?? null,
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending_create",
      });
      await load();

      // Try to sync immediately if online
      syncPendingHighlights(bookId).catch(() => {});
    },
    [bookId, pageId, load]
  );

  // ─── Delete highlight ─────────────────────────────────────────────────────

  const deleteHighlight = useCallback(
    async (localId: string) => {
      const [row] = await localDb
        .select()
        .from(localHighlights)
        .where(eq(localHighlights.localId, localId));

      if (!row) return;

      if (row.serverId) {
        // Already on server → mark pending_delete, attempt sync
        const now = new Date();
        await localDb
          .update(localHighlights)
          .set({ deletedAt: now, syncStatus: "pending_delete" })
          .where(eq(localHighlights.localId, localId));
        syncPendingHighlights(bookId).catch(() => {});
      } else {
        // Never reached server → just delete locally
        await localDb
          .delete(localHighlights)
          .where(eq(localHighlights.localId, localId));
      }
      await load();
    },
    [bookId, load]
  );

  return { highlights, addHighlight, deleteHighlight, reload: load };
}

// ─── Pull server highlights into SQLite (on book open) ────────────────────────

export async function pullServerHighlights(bookId: number) {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  try {
    const serverHls = await vanillaTrpc.book.getHighlightsForBook.query({ bookId });

    for (const sh of serverHls) {
      // Check if we already have this server record
      const existing = await localDb
        .select()
        .from(localHighlights)
        .where(eq(localHighlights.serverId, sh.id));

      if (existing.length === 0) {
        // New from server — insert as synced
        await localDb.insert(localHighlights).values({
          localId: uuid(),
          serverId: sh.id,
          bookId,
          pageId: sh.pageId,
          paragraphId: sh.paragraphId ?? null,
          color: sh.color,
          note: sh.note ?? null,
          createdAt: sh.createdAt ?? new Date(),
          updatedAt: sh.updatedAt ?? new Date(),
          syncStatus: "synced",
        }).onConflictDoNothing();
      }
    }
  } catch {}
}

// ─── Push pending highlights to server ────────────────────────────────────────

export async function syncPendingHighlights(bookId: number) {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  // Push pending_create
  const toCreate = await localDb
    .select()
    .from(localHighlights)
    .where(
      and(
        eq(localHighlights.bookId, bookId),
        eq(localHighlights.syncStatus, "pending_create")
      )
    );

  if (toCreate.length > 0) {
    try {
      const results = await vanillaTrpc.book.syncHighlights.mutate({
        highlights: toCreate.map((h) => ({
          localId: h.localId,
          pageId: h.pageId,
          paragraphId: h.paragraphId ?? undefined,
          color: h.color,
          note: h.note ?? undefined,
        })),
      });

      for (const r of results) {
        await localDb
          .update(localHighlights)
          .set({ serverId: r.serverId, syncStatus: "synced" })
          .where(eq(localHighlights.localId, r.localId));
      }
    } catch {}
  }

  // Push pending_delete
  const toDelete = await localDb
    .select()
    .from(localHighlights)
    .where(
      and(
        eq(localHighlights.bookId, bookId),
        eq(localHighlights.syncStatus, "pending_delete")
      )
    );

  for (const h of toDelete) {
    if (!h.serverId) {
      await localDb.delete(localHighlights).where(eq(localHighlights.localId, h.localId));
      continue;
    }
    try {
      await vanillaTrpc.book.deleteHighlight.mutate({ id: h.serverId });
      await localDb.delete(localHighlights).where(eq(localHighlights.localId, h.localId));
    } catch {}
  }
}
