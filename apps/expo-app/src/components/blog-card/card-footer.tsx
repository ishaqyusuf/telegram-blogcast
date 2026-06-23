import { Pressable } from "@/components/ui/pressable";
import { useCallback } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import { useAudioStore } from "@/store/audio-store";

import type { BlogItem } from "./types";

export function CardFooter({
  post,
  onAddToAlbum,
}: {
  post: BlogItem;
  onAddToAlbum?: (post: BlogItem) => void;
}) {
  const tags = post.tags?.slice(0, 2) ?? [];
  const colors = useColors();
  const loadedBlogId = useAudioStore((s) => s.blog?.id);
  const globalIsPlaying = useAudioStore((s) => s.isPlaying);
  const globalIsLoading = useAudioStore((s) => s.isLoading);
  const pauseAudio = useAudioStore((s) => s.pause);
  const playAudio = useAudioStore((s) => s.play);
  const loadAudio = useAudioStore((s) => s.loadAudio);
  const hasAudioSource = !!(
    post.audio?.telegramFileId || (post.audio as any)?.url
  );
  const isCurrent = loadedBlogId === post.id;
  const isPlaying = isCurrent && globalIsPlaying;
  const isLoading = isCurrent && globalIsLoading;
  const albumName = (post.audio as any)?.albumName as string | null | undefined;
  const albumId = (post.audio as any)?.albumId as number | null | undefined;
  const transcriptStatus = (post.audio as any)?.transcriptStatus as
    | string
    | null
    | undefined;
  const isFullyTranscribed = Boolean((post.audio as any)?.isTranscribed);
  const isPartlyTranscribed =
    !isFullyTranscribed &&
    (transcriptStatus === "processing" || transcriptStatus === "done");
  const showTranscriptBadge = isFullyTranscribed || isPartlyTranscribed;
  const transcriptColor = isFullyTranscribed ? colors.success : colors.warn;
  const canAddToAlbum = Boolean(
    post.audio?.mediaId && !albumName && !albumId && onAddToAlbum,
  );

  const playPause = useCallback(async () => {
    if (isPlaying) {
      await pauseAudio();
      return;
    }

    if (isCurrent) {
      await playAudio();
      return;
    }

    await loadAudio(post as any);
    if (!useAudioStore.getState().error) {
      await useAudioStore.getState().play();
    }
  }, [isCurrent, isPlaying, loadAudio, pauseAudio, playAudio, post]);

  if (hasAudioSource) {
    return (
      <View className="mt-3 flex-row items-center gap-1">
        {showTranscriptBadge ? (
          <View
            className="size-7 items-center justify-center rounded-full"
            style={{ backgroundColor: withAlpha(transcriptColor, 0.14) }}
          >
            <Icon name="FileText" size={14} color={transcriptColor} />
          </View>
        ) : null}
        {albumName ? (
          <View
            className="max-w-[108px] rounded-full bg-primary/10 px-2 py-0.5"
            style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
          >
            <Text
              className="text-[10px] font-semibold text-primary"
              numberOfLines={1}
              style={{
                color: colors.primary,
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
            >
              {albumName}
            </Text>
          </View>
        ) : null}
        {canAddToAlbum ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onAddToAlbum?.(post);
            }}
            className="size-7 items-center justify-center rounded-full bg-primary/10 active:opacity-70"
            style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
          >
            <Icon name="Plus" size={14} className="text-primary" />
          </Pressable>
        ) : null}
        <View className="flex-1" />
        <Pressable className="min-h-11 flex-row items-center gap-1 rounded-full px-2 active:bg-muted">
          <Icon name="Heart" className="text-muted-foreground" />
          <Text
            className="text-xs font-medium text-muted-foreground"
            style={{
              color: colors.mutedForeground,
              includeFontPadding: false,
              textAlignVertical: "center",
            }}
          >
            {post.likes ?? 0}
          </Text>
        </Pressable>
        <Pressable className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted">
          <Icon name="Bookmark" className="text-muted-foreground" />
        </Pressable>
        <Pressable className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted">
          <Icon name="Share" className="text-muted-foreground" />
        </Pressable>
        <Pressable
          className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted"
          disabled={isLoading}
          onPress={(e) => {
            e.stopPropagation();
            void playPause();
          }}
          style={{
            backgroundColor: withAlpha(
              colors.primary,
              isCurrent ? 0.18 : 0.1,
            ),
          }}
        >
          <Icon
            name={isPlaying ? "Pause" : isLoading ? "Loader" : "Play"}
            className="text-primary"
          />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="mt-3 flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 flex-row gap-2">
        {tags.map((tag, idx) => (
          <View
            key={`${tag}-${idx}`}
            className="max-w-[46%] rounded-full bg-accent/10 px-2.5 py-1"
            style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
          >
            <Text
              className="text-xs font-medium text-accent"
              numberOfLines={1}
              style={{ color: colors.primary }}
            >
              #{tag}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-center gap-1">
        <Pressable className="min-h-11 flex-row items-center gap-1 rounded-full px-2 active:bg-muted">
          <Icon name="Heart" className="text-muted-foreground" />
          <Text
            className="text-xs font-medium text-muted-foreground"
            style={{ color: colors.mutedForeground }}
          >
            {post.likes ?? 0}
          </Text>
        </Pressable>
        <Pressable className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted">
          <Icon name="Bookmark" className="text-muted-foreground" />
        </Pressable>
        <Pressable className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted">
          <Icon name="Share" className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
