import { createDocumentFromPlainText } from "../document";
import { createDocumentFromHtml } from "../html";
import { buildRenderBlocks } from "../render";
import type { RangeAnnotation, RenderBlock, RichDocument } from "../types";

export function createBlogDocumentFromText(text: string): RichDocument {
  return createDocumentFromPlainText(text);
}

export function createBlogDocumentFromHtml(html: string): RichDocument {
  return createDocumentFromHtml(html);
}

export function buildBlogRenderBlocks(
  document: RichDocument,
  options?: {
    annotations?: RangeAnnotation[];
  },
): RenderBlock[] {
  return buildRenderBlocks(document, {
    annotations: options?.annotations,
    enableTelegramParsing: true,
  });
}
