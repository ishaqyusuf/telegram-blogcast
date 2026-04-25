import { buildRenderBlocks } from "../render";
import { createDocumentFromParagraphs } from "../document";
import { createDocumentFromHtml } from "../html";
import type { RangeAnnotation, RenderBlock, RichDocument, RichBlockType } from "../types";

export function createBookDocumentFromParagraphs(
  paragraphs: Array<{
    id: string | number;
    text: string;
    type?: RichBlockType;
    attrs?: Record<string, string | number | boolean | null | undefined>;
  }>,
): RichDocument {
  return createDocumentFromParagraphs(paragraphs);
}

export function createBookDocumentFromHtml(html: string): RichDocument {
  return createDocumentFromHtml(html);
}

export function buildBookRenderBlocks(
  document: RichDocument,
  options?: {
    annotations?: RangeAnnotation[];
  },
): RenderBlock[] {
  return buildRenderBlocks(document, {
    annotations: options?.annotations,
    enableTelegramParsing: false,
  });
}
