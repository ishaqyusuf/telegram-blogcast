export function canExportBookContent(book: {
  sourceType?: string | null;
  shamelaId?: number | null;
  editable?: boolean | null;
  blog?: { published?: boolean | null } | null;
}) {
  return book.sourceType === "shamela" && book.editable === false &&
    Number.isSafeInteger(book.shamelaId) && (book.shamelaId ?? 0) > 0 && book.blog?.published === true;
}
