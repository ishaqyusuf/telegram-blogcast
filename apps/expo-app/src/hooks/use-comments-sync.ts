/**
 * use-comments-sync.ts
 * Offline-first comments: write to SQLite immediately, sync to server in background.
 */
import { useCallback, useEffect, useState } from "react";
import { localDb, withLocalDb } from "@/db/local-db";
import { localComments, LocalComment } from "@/db/local-schema";
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

export function useCommentsSync(bookId: number, pageId: number) {
  const [comments, setComments] = useState<LocalComment[]>([]);

  const load = useCallback(async () => {
    const rows = await withLocalDb(() =>
      localDb
        .select()
        .from(localComments)
        .where(
          and(
            eq(localComments.pageId, pageId),
            isNull(localComments.deletedAt)
          )
        )
    );
    // Sort by createdAt asc
    rows.sort((a, b) => +a.createdAt - +b.createdAt);
    setComments(rows);
  }, [pageId]);

  useEffect(() => {
    load().catch((error) => console.warn("[Comments] load failed", error));
  }, [load]);

  // ─── Add comment ──────────────────────────────────────────────────────────

  const addComment = useCallback(
    async (content: string, paragraphId?: number) => {
      const now = new Date();
      const localId = uuid();
      await withLocalDb(() =>
        localDb.insert(localComments).values({
          localId,
          bookId,
          pageId,
          paragraphId: paragraphId ?? null,
          content,
          createdAt: now,
          updatedAt: now,
          syncStatus: "pending_create",
        })
      );
      await load();
      syncPendingComments(bookId).catch(() => {});
    },
    [bookId, pageId, load]
  );

  // ─── Delete comment ───────────────────────────────────────────────────────

  const deleteComment = useCallback(
    async (localId: string) => {
      const shouldSync = await withLocalDb(async () => {
        const [row] = await localDb
          .select()
          .from(localComments)
          .where(eq(localComments.localId, localId));

        if (!row) return false;

        if (row.serverId) {
          const now = new Date();
          await localDb
            .update(localComments)
            .set({ deletedAt: now, syncStatus: "pending_delete" })
            .where(eq(localComments.localId, localId));
          return true;
        }

        await localDb
          .delete(localComments)
          .where(eq(localComments.localId, localId));
        return false;
      });
      if (shouldSync) syncPendingComments(bookId).catch(() => {});
      await load();
    },
    [bookId, load]
  );

  return { comments, addComment, deleteComment, reload: load };
}

// ─── Pull server comments into SQLite (on book open) ──────────────────────────

export async function pullServerComments(bookId: number) {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  try {
    const serverComments = await vanillaTrpc.book.getCommentsForBook.query({ bookId });

    await withLocalDb(async () => {
      for (const sc of serverComments) {
        const existing = await localDb
          .select()
          .from(localComments)
          .where(eq(localComments.serverId, sc.id));

        if (existing.length === 0) {
          await localDb.insert(localComments).values({
            localId: uuid(),
            serverId: sc.id,
            bookId,
            pageId: sc.pageId,
            paragraphId: sc.paragraphId ?? null,
            content: sc.content,
            createdAt: sc.createdAt ?? new Date(),
            updatedAt: sc.updatedAt ?? new Date(),
            syncStatus: "synced",
          }).onConflictDoNothing();
        }
      }
    });
  } catch {}
}

// ─── Push pending comments to server ──────────────────────────────────────────

export async function syncPendingComments(bookId: number) {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  // Push pending_create
  const toCreate = await withLocalDb(() =>
    localDb
      .select()
      .from(localComments)
      .where(
        and(
          eq(localComments.bookId, bookId),
          eq(localComments.syncStatus, "pending_create")
        )
      )
  );

  if (toCreate.length > 0) {
    try {
      const results = await vanillaTrpc.book.syncComments.mutate({
        comments: toCreate.map((c) => ({
          localId: c.localId,
          pageId: c.pageId,
          paragraphId: c.paragraphId ?? undefined,
          content: c.content,
        })),
      });

      await withLocalDb(async () => {
        for (const r of results) {
          await localDb
            .update(localComments)
            .set({ serverId: r.serverId, syncStatus: "synced" })
            .where(eq(localComments.localId, r.localId));
        }
      });
    } catch {}
  }

  // Push pending_delete
  const toDelete = await withLocalDb(() =>
    localDb
      .select()
      .from(localComments)
      .where(
        and(
          eq(localComments.bookId, bookId),
          eq(localComments.syncStatus, "pending_delete")
        )
      )
  );

  for (const c of toDelete) {
    if (!c.serverId) {
      await withLocalDb(() =>
        localDb.delete(localComments).where(eq(localComments.localId, c.localId))
      );
      continue;
    }
    try {
      await vanillaTrpc.book.deletePageComment.mutate({ id: c.serverId });
      await withLocalDb(() =>
        localDb.delete(localComments).where(eq(localComments.localId, c.localId))
      );
    } catch {}
  }
}
