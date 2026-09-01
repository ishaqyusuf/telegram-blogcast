export type { RangeAnnotation } from "../types";
export type { BookHighlightInput } from "./highlights";
export {
  buildBookRenderBlocks,
  createBookDocumentFromParagraphs,
} from "./document";
export {
  createBookHighlightAnnotation,
  createBookHighlightAnnotations,
} from "./highlights";
export { resolveBookTextSegments, SHAMELA_C5_COLOR } from "./reader";
export type { BookHighlightRange, BookSourceMark } from "./reader";
export { getSwipeBookDirection, resolveAdjacentPageAction } from "./navigation";
export type { AdjacentPageAction, AdjacentPageTarget } from "./navigation";
export {
  normalizeBookmarkedPageIds,
  toggleBookmarkedPageId,
} from "./bookmarks";
export { hydrateShamelaTocHtml, parseShamelaOpenPage } from "./shamela";
export type {
  ParseDiagnostic,
  ShamelaBookMetadata,
  ShamelaOpenPageFacts,
  ShamelaOpenPageParseResult,
  ShamelaTocNode,
  TenTapPageDocumentV1,
  TenTapBreadcrumbItem,
} from "./shamela";
