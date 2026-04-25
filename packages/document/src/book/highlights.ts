import type { RangeAnnotation } from "../types";

export type BookHighlightInput = {
  id: string;
  blockId: string | number;
  startOffset: number;
  endOffset: number;
  color?: string | null;
  note?: string | null;
  quoteText?: string | null;
};

export function createBookHighlightAnnotation(
  highlight: BookHighlightInput,
): RangeAnnotation {
  return {
    id: highlight.id,
    blockId: String(highlight.blockId),
    startOffset: highlight.startOffset,
    endOffset: highlight.endOffset,
    kind: "highlight",
    color: highlight.color ?? null,
    note: highlight.note ?? null,
    quoteText: highlight.quoteText ?? null,
  };
}

export function createBookHighlightAnnotations(
  highlights: BookHighlightInput[],
): RangeAnnotation[] {
  return highlights.map(createBookHighlightAnnotation);
}
