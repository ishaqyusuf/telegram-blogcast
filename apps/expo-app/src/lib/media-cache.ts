import * as LegacyFileSystem from "expo-file-system/legacy";
import { NativeModules, Platform } from "react-native";

export type MediaCacheKind = "audio" | "video" | "image" | "document";

type AndroidMediaStorageModule = {
  getMediaDirectory(mediaType: MediaCacheKind): Promise<string>;
};

type CacheMediaOptions = {
  cacheKey?: number | string | null;
  fileName: string;
  kind: MediaCacheKind;
  onProgress?: (progress: number) => void;
  url: string;
};

const androidMediaStorage = NativeModules.AndroidMediaStorage as
  | AndroidMediaStorageModule
  | undefined;
const pendingDownloads = new Map<string, Promise<string>>();

function joinFileUri(root: string, ...parts: string[]) {
  return `${root.replace(/\/+$/g, "")}/${parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

export function sanitizeMediaFileName(fileName: string, fallback: string) {
  const sanitized = fileName
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (sanitized || fallback).slice(0, 180);
}

async function getMediaDirectoryUri(kind: MediaCacheKind) {
  if (Platform.OS === "android") {
    if (!androidMediaStorage) {
      throw new Error(
        "Android media storage is unavailable. Rebuild the app and try again.",
      );
    }
    return androidMediaStorage.getMediaDirectory(kind);
  }

  if (!LegacyFileSystem.documentDirectory) {
    throw new Error("Media storage is not available on this device.");
  }
  const directoryUri = joinFileUri(
    LegacyFileSystem.documentDirectory,
    "al-ghurobaa",
    "media",
    kind,
  );
  await LegacyFileSystem.makeDirectoryAsync(directoryUri, {
    intermediates: true,
  });
  return directoryUri;
}

export async function getMediaTargetUri({
  cacheKey,
  fileName,
  kind,
}: Pick<CacheMediaOptions, "cacheKey" | "fileName" | "kind">) {
  const directoryUri = await getMediaDirectoryUri(kind);
  const safeFileName = sanitizeMediaFileName(
    fileName,
    `${kind}-${cacheKey ?? Date.now()}`,
  );
  const prefix =
    cacheKey === null || cacheKey === undefined || cacheKey === ""
      ? ""
      : `${sanitizeMediaFileName(String(cacheKey), kind)}-`;
  return joinFileUri(directoryUri, `${prefix}${safeFileName}`);
}

export async function getUsableCachedMediaUri(uri: string) {
  const info = await LegacyFileSystem.getInfoAsync(uri).catch(() => null);
  if (!info?.exists || (typeof info.size === "number" && info.size <= 0)) {
    if (info?.exists) {
      await LegacyFileSystem.deleteAsync(uri, { idempotent: true }).catch(
        () => undefined,
      );
    }
    return null;
  }
  return uri;
}

async function downloadMedia(options: CacheMediaOptions) {
  const targetUri = await getMediaTargetUri(options);
  const cachedUri = await getUsableCachedMediaUri(targetUri);
  if (cachedUri) {
    options.onProgress?.(1);
    return cachedUri;
  }

  const download = LegacyFileSystem.createDownloadResumable(
    options.url,
    targetUri,
    {},
    (progress) => {
      const expected = progress.totalBytesExpectedToWrite;
      if (expected <= 0) return;
      options.onProgress?.(
        Math.max(0, Math.min(1, progress.totalBytesWritten / expected)),
      );
    },
  );

  try {
    const result = await download.downloadAsync();
    const downloadedUri = result?.uri
      ? await getUsableCachedMediaUri(result.uri)
      : null;
    if (!downloadedUri) {
      throw new Error("The media download did not produce a readable file.");
    }
    options.onProgress?.(1);
    return downloadedUri;
  } catch (error) {
    await LegacyFileSystem.deleteAsync(targetUri, { idempotent: true }).catch(
      () => undefined,
    );
    throw error;
  }
}

export function cacheMedia(options: CacheMediaOptions) {
  const key = `${options.kind}:${options.cacheKey ?? ""}:${options.url}`;
  const pending = pendingDownloads.get(key);
  if (pending) return pending;

  const task = downloadMedia(options).finally(() => {
    pendingDownloads.delete(key);
  });
  pendingDownloads.set(key, task);
  return task;
}
