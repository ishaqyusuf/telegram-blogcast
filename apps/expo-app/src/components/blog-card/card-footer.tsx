import { Pressable } from "@/components/ui/pressable";
import { useCallback } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import { minuteToString } from "@/lib/utils";
import { useAudioStore } from "@/store/audio-store";

import type { BlogItem } from "./types";

function formatMediaSizeMb(size?: number | null) {
  if (!size || !Number.isFinite(size) || size <= 0) return null;

  const mb = size / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export function CardFooter({ post }: { post: BlogItem }) {
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
  const durationLabel = post.audio?.duration
    ? minuteToString(post.audio.duration)
    : null;
  const mediaSize = formatMediaSizeMb(post.audio?.size);
  const albumName = (post.audio as any)?.albumName as string | null | undefined;

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
        {durationLabel ? (
          <Text
            className="text-xs font-medium text-muted-foreground"
            numberOfLines={1}
            style={{
              color: colors.mutedForeground,
              includeFontPadding: false,
              textAlignVertical: "center",
            }}
          >
            {durationLabel}
          </Text>
        ) : null}
        {mediaSize ? (
          <Text
            className="text-xs font-medium text-muted-foreground"
            numberOfLines={1}
            style={{
              color: colors.mutedForeground,
              includeFontPadding: false,
              textAlignVertical: "center",
            }}
          >
            {mediaSize}
          </Text>
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
