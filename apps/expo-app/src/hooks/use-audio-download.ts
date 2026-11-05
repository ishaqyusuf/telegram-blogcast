import { useAudioStore } from "@/store/audio-store";
import { useCallback, useState } from "react";
import { useDownloadedAudio } from "@/hooks/use-downloaded-audio";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { cacheMedia } from "@/lib/media-cache";
import { notifyAudioDownloadsChanged } from "@/lib/downloaded-audio";

type AudioDownloadOptions = {
  mediaId?: number | null;
  blogId?: number | null;
  fileName?: string | null;
  size?: number | null;
  url?: string | null;
  telegramFileId?: string | null;
};

export function useAudioDownload(options: AudioDownloadOptions) {
  const downloadedUri = useDownloadedAudio(options);
  const matchesActive = (state: ReturnType<typeof useAudioStore.getState>) =>
    options.mediaId ? state.blog?.audio?.mediaId === options.mediaId : Boolean(options.blogId && state.blog?.id === options.blogId);
  const activeDownloading = useAudioStore((state) => matchesActive(state) && state.isDownloading);
  const activeProgress = useAudioStore((state) => matchesActive(state) ? state.downloadProgress : 0);
  const activeError = useAudioStore((state) => matchesActive(state) ? state.downloadError : null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (sourceUrl?: string | null) => {
    if (isDownloading || activeDownloading || downloadedUri) return downloadedUri;
    if (!options.fileName || (!options.mediaId && !options.blogId)) {
      setError("This audio has no downloadable file.");
      return null;
    }
    setIsDownloading(true);
    setProgress(0);
    setError(null);
    try {
      const resolved = sourceUrl || options.url || (options.telegramFileId
        ? (await getTelegramFileUrl(options.telegramFileId))?.url
        : null);
      if (!resolved) throw new Error("Audio download is unavailable.");
      const uri = await cacheMedia({
        kind: "audio",
        cacheKey: options.mediaId ? `media-${options.mediaId}` : options.blogId,
        fileName: options.fileName,
        url: resolved,
        expectedSize: options.size,
        onProgress: setProgress,
      });
      notifyAudioDownloadsChanged();
      setProgress(1);
      return uri;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audio download failed.");
      return null;
    } finally {
      setIsDownloading(false);
    }
  }, [downloadedUri, activeDownloading, isDownloading, options.blogId, options.fileName, options.mediaId, options.size, options.telegramFileId, options.url]);

  return { downloadedUri, isDownloading: isDownloading || activeDownloading, progress: activeDownloading ? activeProgress : progress, error: error || activeError, download };
}
