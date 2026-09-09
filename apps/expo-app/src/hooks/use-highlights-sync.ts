import { useCallback } from "react";
import { annotationAnchor, readerHighlight, syncBookAnnotations } from "@/lib/book-annotation-service";
import { useBookAnnotations } from "./use-book-annotations";

export function useHighlightsSync(bookId: number, pageId: number) {
  const annotations = useBookAnnotations(bookId, pageId);
  const { scope, save } = annotations;
  const addHighlight = useCallback(async (paragraphId: number, color: string, options?: { note?: string; startOffset?: number | null; endOffset?: number | null; quoteText?: string | null }) => {
    const anchor = await annotationAnchor(scope, bookId, pageId, paragraphId);
    await save({ kind: "highlight", ...anchor, quoteText: options?.quoteText ?? anchor.quoteText, color, note: options?.note ?? null, startOffset: options?.startOffset ?? 0, endOffset: options?.endOffset ?? 0 });
  }, [bookId, pageId, scope, save]);
  return { bookAnnotations: annotations.rows.filter((row) => row.payload.kind === "highlight"), highlights: annotations.rows.filter((row) => row.pageId === pageId).flatMap((row) => { const highlight = readerHighlight(row); return highlight ? [highlight] : []; }), addHighlight, deleteHighlight: annotations.remove, reload: annotations.reload };
}
export const pullServerHighlights = syncBookAnnotations;
export const syncPendingHighlights = syncBookAnnotations;
