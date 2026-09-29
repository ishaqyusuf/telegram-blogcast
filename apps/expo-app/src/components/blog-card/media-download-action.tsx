import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Text } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { cacheMedia, getMediaTargetUri, getUsableCachedMediaUri, type MediaCacheKind } from "@/lib/media-cache";

export function MediaDownloadAction({ kind, cacheKey, fileName, url, expectedSize }: {
  kind: MediaCacheKind;
  cacheKey: number | string;
  fileName: string;
  url?: string | null;
  expectedSize?: number | null;
}) {
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const check = async () => {
      const target = await getMediaTargetUri({ kind, cacheKey, fileName });
      const cached = await getUsableCachedMediaUri(target);
      const info = cached ? await FileSystem.getInfoAsync(cached) : null;
      if (active) setSaved(Boolean(cached && info?.exists && (!expectedSize || info.size === expectedSize)));
    };
    void check().catch(() => undefined);
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") void check(); });
    return () => { active = false; listener.remove(); };
  }, [cacheKey, expectedSize, fileName, kind]);

  const label = kind === "document" ? "PDF" : "video";
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        if (!url || saved || downloading) return;
        setDownloading(true);
        setFailed(false);
        void cacheMedia({ kind, cacheKey, fileName, url, expectedSize, onProgress: setProgress })
          .then(() => setSaved(true))
          .catch(() => setFailed(true))
          .finally(() => setDownloading(false));
      }}
      disabled={!url || saved || downloading}
      accessibilityRole="button"
      accessibilityLabel={saved ? `${label} downloaded` : `Download ${label}`}
      style={{ minHeight: 44, minWidth: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.72)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10 }}
    >
      {downloading ? <ActivityIndicator size="small" color="#fff" /> : <Icon name={saved ? "Check" : "Download"} size={17} color={saved ? "#22c55e" : "#fff"} />}
      <Text style={{ color: saved ? "#22c55e" : "#fff", fontSize: 11, fontWeight: "700" }}>{saved ? "Saved" : downloading ? `${Math.round(progress * 100)}%` : failed ? "Retry" : "Download"}</Text>
    </Pressable>
  );
}
