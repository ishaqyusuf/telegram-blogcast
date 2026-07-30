import { cacheMedia, sanitizeMediaFileName } from "@/lib/media-cache";

type DownloadPdfOptions = {
  documentId: number;
  fileName?: string | null;
  onProgress?: (progress: number) => void;
  url: string;
};

export type StoredPdf = {
  fileName: string;
  localUri: string;
};

function getPdfFileName(
  fileName: string | null | undefined,
  documentId: number,
) {
  const safeFileName = sanitizeMediaFileName(
    fileName ?? "",
    `document-${documentId}.pdf`,
  );
  return safeFileName.toLowerCase().endsWith(".pdf")
    ? safeFileName
    : `${safeFileName}.pdf`;
}

export async function storePdf({
  documentId,
  fileName,
  onProgress,
  url,
}: DownloadPdfOptions): Promise<StoredPdf> {
  const safeFileName = getPdfFileName(fileName, documentId);
  const localUri = await cacheMedia({
    cacheKey: documentId,
    fileName: safeFileName,
    kind: "document",
    onProgress,
    url,
  });
  return { fileName: safeFileName, localUri };
}
