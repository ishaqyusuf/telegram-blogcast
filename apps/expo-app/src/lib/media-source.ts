import { getWebUrl } from "@/lib/base-url";

type MediaFile = {
  source?: string | null;
  fileId?: string | number | null;
  blobUrl?: string | null;
  blobDownloadUrl?: string | null;
};

export function buildTelegramFileProxy(fileId?: string | number | null) {
  if (!fileId) return null;
  try {
    return `${getWebUrl()}/api/telegram/file/${encodeURIComponent(fileId)}`;
  } catch {
    return null;
  }
}

export function getMediaFileUrl(file?: MediaFile | null) {
  if (!file) return null;
  if (file.source === "vercel_blob") {
    return file.blobDownloadUrl || file.blobUrl || null;
  }
  return buildTelegramFileProxy(file.fileId);
}
