// Public/portable export is separate from private offline caching: every readable page may
// be cached privately on the device, but only published read-only Shamela captures may be
// mirrored to a shared folder. Provider imports (e.g. KetabOnline) stay unexportable until
// their redistribution policy is established; a public upstream download is not a licence.
export function canExportBookContent(book: {
  sourceType?: string | null;
  sourceProvider?: string | null;
  shamelaId?: number | null;
  editable?: boolean | null;
  blog?: { published?: boolean | null } | null;
}) {
  return book.sourceType === "shamela" && book.sourceProvider == null && book.editable === false &&
    Number.isSafeInteger(book.shamelaId) && (book.shamelaId ?? 0) > 0 && book.blog?.published === true;
}
