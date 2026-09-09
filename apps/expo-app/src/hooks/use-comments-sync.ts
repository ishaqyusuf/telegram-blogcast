import { useCallback } from "react";
import { annotationAnchor, readerComment, syncBookAnnotations } from "@/lib/book-annotation-service";
import { useBookAnnotations } from "./use-book-annotations";

export function useCommentsSync(bookId: number, pageId: number) {
  const annotations = useBookAnnotations(bookId, pageId);
  const { scope, save } = annotations;
  const addComment = useCallback(async (content: string, paragraphId?: number) => {
    const anchor = await annotationAnchor(scope, bookId, pageId, paragraphId);
    await save({ kind: "comment", ...anchor, content });
  }, [bookId, pageId, scope, save]);
  return { bookAnnotations: annotations.rows.filter((row) => row.payload.kind === "comment"), comments: annotations.rows.filter((row) => row.pageId === pageId).flatMap((row) => { const comment = readerComment(row); return comment ? [comment] : []; }), addComment, deleteComment: annotations.remove, reload: annotations.reload };
}
export const pullServerComments = syncBookAnnotations;
export const syncPendingComments = syncBookAnnotations;
