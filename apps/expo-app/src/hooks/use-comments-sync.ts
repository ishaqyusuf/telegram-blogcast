import { useCallback, useEffect, useState } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { initLocalDb, localDb, withLocalDbRetry } from "@/db/local-db";
import { localComments, type LocalComment } from "@/db/local-schema";
import { vanillaTrpc } from "@/trpc/vanilla-client";

type Comment = LocalComment;

function makeLocalId() {
  return `cm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDate(value: Date | number | string | null | undefined) {
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") return new Date(value);
  return new Date();
}

async function upsertLocalComment(row: LocalComment) {
  await initLocalDb();
  await withLocalDbRetry(() =>
    localDb
      .insert(localComments)
      .values(row)
      .onConflictDoUpdate({
        target: localComments.localId,
        set: {
          serverId: row.serverId,
          pageId: row.pageId,
          paragraphId: row.paragraphId,
          content: row.content,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
          syncStatus: row.syncStatus,
        },
      }),
  );
}

export function useCommentsSync(bookId: number, pageId: number) {
  const [comments, setComments] = useState<Comment[]>([]);

  const load = useCallback(async () => {
    await initLocalDb();
    const rows = await withLocalDbRetry(() =>
      localDb
        .select()
        .from(localComments)
        .where(
          and(
            eq(localComments.bookId, bookId),
            eq(localComments.pageId, pageId),
            isNull(localComments.deletedAt),
          ),
        ),
    );
    setComments(
      rows.sort(
        (a, b) =>
          +(a.createdAt ? new Date(a.createdAt) : 0) -
          +(b.createdAt ? new Date(b.createdAt) : 0),
      ),
    );
  }, [bookId, pageId]);

  useEffect(() => {
    pullServerComments(bookId)
      .catch((error) => console.warn("[Comments] pull failed", error))
      .then(load)
      .catch((error) => console.warn("[Comments] load failed", error));
  }, [bookId, load]);

  const addComment = useCallback(
    async (content: string, paragraphId?: number) => {
      const now = new Date();
      await upsertLocalComment({
        localId: makeLocalId(),
        serverId: null,
        bookId,
        pageId,
        paragraphId: paragraphId ?? null,
        content,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: "pending_create",
      });
      await load();
      await syncPendingComments(bookId).catch((error) =>
        console.warn("[Comments] sync failed", error),
      );
      await load();
    },
    [bookId, load, pageId],
  );

  const deleteComment = useCallback(
    async (localId: string) => {
      await initLocalDb();
      const now = new Date();
      const rows = await withLocalDbRetry(() =>
        localDb.select().from(localComments).where(eq(localComments.localId, localId)),
      );
      const row = rows[0];
      if (!row) return;

      if (!row.serverId) {
        await withLocalDbRetry(() =>
          localDb.delete(localComments).where(eq(localComments.localId, localId)),
        );
      } else {
        await withLocalDbRetry(() =>
          localDb
            .update(localComments)
            .set({ deletedAt: now, updatedAt: now, syncStatus: "pending_delete" })
            .where(eq(localComments.localId, localId)),
        );
      }
      await load();
      await syncPendingComments(bookId).catch((error) =>
        console.warn("[Comments] delete sync failed", error),
      );
      await load();
    },
    [bookId, load],
  );

  return { comments, addComment, deleteComment, reload: load };
}

export async function pullServerComments(bookId: number) {
  const rows = await vanillaTrpc.book.getCommentsForBook.query({ bookId });
  const now = new Date();
  for (const row of rows) {
    await upsertLocalComment({
      localId: `server-${row.id}`,
      serverId: row.id,
      bookId,
      pageId: row.pageId,
      paragraphId: row.paragraphId ?? null,
      content: row.content,
      createdAt: toDate(row.createdAt ?? now),
      updatedAt: toDate(row.updatedAt ?? row.createdAt ?? now),
      deletedAt: null,
      syncStatus: "synced",
    });
  }
}

export async function syncPendingComments(bookId: number) {
  await initLocalDb();
  const pendingCreates = await withLocalDbRetry(() =>
    localDb
      .select()
      .from(localComments)
      .where(
        and(
          eq(localComments.bookId, bookId),
          eq(localComments.syncStatus, "pending_create"),
          isNull(localComments.deletedAt),
        ),
      ),
  );

  if (pendingCreates.length > 0) {
    const results = await vanillaTrpc.book.syncComments.mutate({
      comments: pendingCreates.map((comment) => ({
        localId: comment.localId,
        pageId: comment.pageId,
        paragraphId: comment.paragraphId ?? undefined,
        content: comment.content,
      })),
    });

    for (const result of results) {
      const serverLocalId = `server-${result.serverId}`;
      await withLocalDbRetry(() =>
        localDb.delete(localComments).where(eq(localComments.localId, serverLocalId)),
      );
      await withLocalDbRetry(() =>
        localDb
          .update(localComments)
          .set({
            serverId: result.serverId,
            localId: serverLocalId,
            syncStatus: "synced",
            updatedAt: new Date(),
          } as Partial<LocalComment>)
          .where(eq(localComments.localId, result.localId)),
      );
    }
  }

  const pendingDeletes = await withLocalDbRetry(() =>
    localDb
      .select()
      .from(localComments)
      .where(
        and(
          eq(localComments.bookId, bookId),
          eq(localComments.syncStatus, "pending_delete"),
        ),
      ),
  );

  for (const row of pendingDeletes) {
    if (row.serverId) {
      await vanillaTrpc.book.deletePageComment.mutate({ id: row.serverId });
    }
    await withLocalDbRetry(() =>
      localDb.delete(localComments).where(eq(localComments.localId, row.localId)),
    );
  }
}
