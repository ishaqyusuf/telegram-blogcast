import { useCallback, useEffect, useState } from "react";
import { vanillaTrpc } from "@/trpc/vanilla-client";

type Comment = {
  localId: string;
  serverId: number | null;
  pageId: number;
  paragraphId: number | null;
  content: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  deletedAt: Date | null;
  syncStatus: "synced";
};

function toComment(row: {
  id: number;
  pageId: number;
  paragraphId: number | null;
  content: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}): Comment {
  return {
    localId: String(row.id),
    serverId: row.id,
    pageId: row.pageId,
    paragraphId: row.paragraphId ?? null,
    content: row.content,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    deletedAt: null,
    syncStatus: "synced",
  };
}

export function useCommentsSync(bookId: number, pageId: number) {
  const [comments, setComments] = useState<Comment[]>([]);

  const load = useCallback(async () => {
    const rows = await vanillaTrpc.book.getCommentsForBook.query({ bookId });
    const next = rows
      .filter((row) => row.pageId === pageId)
      .map(toComment)
      .sort(
        (a, b) =>
          +(a.createdAt ? new Date(a.createdAt) : 0) -
          +(b.createdAt ? new Date(b.createdAt) : 0),
      );
    setComments(next);
  }, [bookId, pageId]);

  useEffect(() => {
    load().catch((error) => console.warn("[Comments] load failed", error));
  }, [load]);

  const addComment = useCallback(
    async (content: string, paragraphId?: number) => {
      await vanillaTrpc.book.addPageComment.mutate({
        pageId,
        paragraphId,
        content,
      });
      await load();
    },
    [load, pageId],
  );

  const deleteComment = useCallback(
    async (localId: string) => {
      const id = Number(localId);
      if (!Number.isFinite(id)) return;
      await vanillaTrpc.book.deletePageComment.mutate({ id });
      await load();
    },
    [load],
  );

  return { comments, addComment, deleteComment, reload: load };
}

export async function pullServerComments(_bookId: number) {}

export async function syncPendingComments(_bookId: number) {}
