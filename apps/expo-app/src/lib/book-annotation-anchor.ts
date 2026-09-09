import type { LocalDeviceAnnotation } from "./book-annotation-repository";

type Paragraph = { id: number; pid?: number; text: string };
export type AnchoredAnnotation = LocalDeviceAnnotation & { anchorStatus: "matched" | "page" | "unmatched" };

export function anchorBookAnnotation(row: LocalDeviceAnnotation, paragraphs: Paragraph[]): AnchoredAnnotation {
  const payload = row.payload;
  if (payload.kind === "comment" && payload.paragraphId === null && !payload.quoteText)
    return { ...row, anchorStatus: "page" };
  const original = paragraphs.find((paragraph) => paragraph.id === payload.paragraphId);
  const quote = payload.quoteText;
  const attach = (paragraph: Paragraph, start?: number): AnchoredAnnotation => ({
    ...row, anchorStatus: "matched",
    payload: payload.kind === "highlight"
      ? { ...payload, paragraphId: paragraph.id, paragraphPid: paragraph.pid ?? null, ...(start === undefined ? {} : { startOffset: start, endOffset: start + quote!.length }) }
      : { ...payload, paragraphId: paragraph.id, paragraphPid: paragraph.pid ?? null },
  });
  if (original && !quote) {
    if (payload.kind === "comment" || (payload.endOffset > payload.startOffset && payload.endOffset <= original.text.length)) return attach(original);
  }
  if (quote) {
    if (original && payload.kind === "highlight" && original.text.slice(payload.startOffset, payload.endOffset) === quote) return attach(original, payload.startOffset);
    if (original) {
      const start = original.text.indexOf(quote);
      if (start >= 0 && original.text.indexOf(quote, start + 1) < 0) return attach(original, start);
    }
    // A replaced paragraph ID needs a unique text match; ordinal position alone is not proof.
    let match: { paragraph: Paragraph; start: number } | undefined;
    for (const paragraph of paragraphs) {
      const start = paragraph.text.indexOf(quote);
      if (start < 0) continue;
      if (match || paragraph.text.indexOf(quote, start + 1) >= 0) { match = undefined; break; }
      match = { paragraph, start };
    }
    if (match) return attach(match.paragraph, match.start);
  }
  return { ...row, anchorStatus: "unmatched", payload: { ...payload, paragraphId: null } };
}
