import { useCallback, useEffect, useState } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { initLocalDb, localDb, withLocalDbRetry } from "@/db/local-db";
import { localHighlights, type LocalHighlight } from "@/db/local-schema";
import { vanillaTrpc } from "@/trpc/vanilla-client";

type Highlight = LocalHighlight;

function makeLocalId() {
  return `hl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDate(value: Date | number | string | null | undefined) {
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") return new Date(value);
  return new Date();
}

async function upsertLocalHighlight(row: LocalHighlight) {
  await initLocalDb();
  await withLocalDbRetry(() =>
    localDb
      .insert(localHighlights)
      .values(row)
      .onConflictDoUpdate({
        target: localHighlights.localId,
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
      }),
  );
}

export function useHighlightsSync(bookId: number, pageId: number) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const load = useCallback(async () => {
    await initLocalDb();
    const rows = await withLocalDbRetry(() =>
      localDb
        .select()
        .from(localHighlights)
        .where(
          and(
            eq(localHighlights.bookId, bookId),
            eq(localHighlights.pageId, pageId),
            isNull(localHighlights.deletedAt),
          ),
        ),
    );
    setHighlights(rows);
  }, [bookId, pageId]);

  useEffect(() => {
    pullServerHighlights(bookId)
      .catch((error) => console.warn("[Highlights] pull failed", error))
      .then(load)
      .catch((error) => console.warn("[Highlights] load failed", error));
  }, [bookId, load]);

  const addHighlight = useCallback(
    async (
      paragraphId: number,
      color: string,
      options?: {
        note?: string;
        startOffset?: number | null;
        endOffset?: number | null;
        quoteText?: string | null;
      },
    ) => {
      const now = new Date();
      await upsertLocalHighlight({
        localId: makeLocalId(),
        serverId: null,
        bookId,
        pageId,
        paragraphId,
        startOffset: options?.startOffset ?? 0,
        endOffset: options?.endOffset ?? 0,
        color,
        note: options?.note ?? null,
        quoteText: options?.quoteText ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: "pending_create",
      });
      await load();
      await syncPendingHighlights(bookId).catch((error) =>
        console.warn("[Highlights] sync failed", error),
      );
      await load();
    },
    [bookId, load, pageId],
  );

  const deleteHighlight = useCallback(
    async (localId: string) => {
      await initLocalDb();
      const now = new Date();
      const rows = await withLocalDbRetry(() =>
        localDb
          .select()
          .from(localHighlights)
          .where(eq(localHighlights.localId, localId)),
      );
      const row = rows[0];
      if (!row) return;

      if (!row.serverId) {
        await withLocalDbRetry(() =>
          localDb.delete(localHighlights).where(eq(localHighlights.localId, localId)),
        );
      } else {
        await withLocalDbRetry(() =>
          localDb
            .update(localHighlights)
            .set({ deletedAt: now, updatedAt: now, syncStatus: "pending_delete" })
            .where(eq(localHighlights.localId, localId)),
        );
      }
      await load();
      await syncPendingHighlights(bookId).catch((error) =>
        console.warn("[Highlights] delete sync failed", error),
      );
      await load();
    },
    [bookId, load],
  );

  return { highlights, addHighlight, deleteHighlight, reload: load };
}

export async function pullServerHighlights(bookId: number) {
  const rows = await vanillaTrpc.book.getHighlightsForBook.query({ bookId });
  const now = new Date();
  for (const row of rows) {
    await upsertLocalHighlight({
      localId: `server-${row.id}`,
      serverId: row.id,
      bookId,
      pageId: row.pageId,
      paragraphId: row.paragraphId ?? null,
      startOffset: row.startOffset ?? 0,
      endOffset: row.endOffset ?? 0,
      color: row.color,
      note: row.note ?? null,
      quoteText: row.quoteText ?? null,
      createdAt: toDate(row.createdAt ?? now),
      updatedAt: toDate(row.updatedAt ?? row.createdAt ?? now),
      deletedAt: null,
      syncStatus: "synced",
    });
  }
}

export async function syncPendingHighlights(bookId: number) {
  await initLocalDb();
  const pendingCreates = await withLocalDbRetry(() =>
    localDb
      .select()
      .from(localHighlights)
      .where(
        and(
          eq(localHighlights.bookId, bookId),
          eq(localHighlights.syncStatus, "pending_create"),
          isNull(localHighlights.deletedAt),
        ),
      ),
  );

  if (pendingCreates.length > 0) {
    const results = await vanillaTrpc.book.syncHighlights.mutate({
      highlights: pendingCreates.map((h) => ({
        localId: h.localId,
        pageId: h.pageId,
        paragraphId: h.paragraphId ?? undefined,
        startOffset: h.startOffset ?? undefined,
        endOffset: h.endOffset ?? undefined,
        color: h.color,
        note: h.note ?? undefined,
        quoteText: h.quoteText ?? undefined,
      })),
    });

    for (const result of results) {
      const serverLocalId = `server-${result.serverId}`;
      await withLocalDbRetry(() =>
        localDb.delete(localHighlights).where(eq(localHighlights.localId, serverLocalId)),
      );
      await withLocalDbRetry(() =>
        localDb
          .update(localHighlights)
          .set({
            serverId: result.serverId,
            localId: serverLocalId,
            syncStatus: "synced",
            updatedAt: new Date(),
          } as Partial<LocalHighlight>)
          .where(eq(localHighlights.localId, result.localId)),
      );
    }
  }

  const pendingDeletes = await withLocalDbRetry(() =>
    localDb
      .select()
      .from(localHighlights)
      .where(
        and(
          eq(localHighlights.bookId, bookId),
          eq(localHighlights.syncStatus, "pending_delete"),
        ),
      ),
  );

  for (const row of pendingDeletes) {
    if (row.serverId) {
      await vanillaTrpc.book.deleteHighlight.mutate({ id: row.serverId });
    }
    await withLocalDbRetry(() =>
      localDb.delete(localHighlights).where(eq(localHighlights.localId, row.localId)),
    );
  }
}
