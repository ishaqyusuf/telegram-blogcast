import { useCallback, useEffect, useState } from "react";
import { vanillaTrpc } from "@/trpc/vanilla-client";

type Highlight = {
  localId: string;
  serverId: number | null;
  pageId: number;
  paragraphId: number | null;
  startOffset: number | null;
  endOffset: number | null;
  color: string;
  note: string | null;
  quoteText: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  deletedAt: Date | null;
  syncStatus: "synced";
};

function toHighlight(row: {
  id: number;
  pageId: number;
  paragraphId: number | null;
  startOffset: number;
  endOffset: number;
  color: string;
  note: string | null;
  quoteText: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): Highlight {
  return {
    localId: String(row.id),
    serverId: row.id,
    pageId: row.pageId,
    paragraphId: row.paragraphId ?? null,
    startOffset: row.startOffset ?? null,
    endOffset: row.endOffset ?? null,
    color: row.color,
    note: row.note ?? null,
    quoteText: row.quoteText ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    deletedAt: null,
    syncStatus: "synced",
  };
}

export function useHighlightsSync(bookId: number, pageId: number) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const load = useCallback(async () => {
    const rows = await vanillaTrpc.book.getHighlightsForBook.query({ bookId });
    setHighlights(
      rows
        .filter((row) => row.pageId === pageId)
        .map(toHighlight),
    );
  }, [bookId, pageId]);

  useEffect(() => {
    load().catch((error) => console.warn("[Highlights] load failed", error));
  }, [load]);

  const addHighlight = useCallback(
    async (
      paragraphId: number,
      color: string,
      options?: {
        note?: string;
        startOffset?: number | null;
        endOffset?: number | null;
      },
    ) => {
      await vanillaTrpc.book.addHighlight.mutate({
        pageId,
        paragraphId,
        startOffset: options?.startOffset ?? 0,
        endOffset: options?.endOffset ?? 0,
        color,
        note: options?.note,
      });
      await load();
    },
    [load, pageId],
  );

  const deleteHighlight = useCallback(
    async (localId: string) => {
      const id = Number(localId);
      if (!Number.isFinite(id)) return;
      await vanillaTrpc.book.deleteHighlight.mutate({ id });
      await load();
    },
    [load],
  );

  return { highlights, addHighlight, deleteHighlight, reload: load };
}

export async function pullServerHighlights(_bookId: number) {}

export async function syncPendingHighlights(_bookId: number) {}
