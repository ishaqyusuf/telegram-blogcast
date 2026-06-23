import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { minuteToString } from "@/lib/utils";

import type { BlogCardVariant, BlogItem } from "./types";
import {
  getChannelName,
  getInitials,
  getPostDateLabel,
} from "./utils";

function formatMediaSizeMb(size?: number | null) {
  if (!size || !Number.isFinite(size) || size <= 0) return null;

  const mb = size / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export function CardHeader({
  post,
  variant,
  onOpenOptions,
}: {
  post: BlogItem;
  variant: BlogCardVariant;
  onOpenOptions?: () => void;
}) {
  const colors = useColors();
  const channelName = getChannelName(post);
  const durationLabel = post.audio?.duration
    ? minuteToString(post.audio.duration)
    : null;
  const mediaSize = formatMediaSizeMb(post.audio?.size);
  const subtitle = [getPostDateLabel(post), durationLabel, mediaSize]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="mb-3 flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <View
          className="size-10 items-center justify-center rounded-full bg-muted"
          style={{ backgroundColor: colors.muted }}
        >
          <Text
            className="text-sm font-bold text-foreground"
            style={{ color: colors.foreground }}
          >
            {getInitials(channelName)}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className="text-[15px] font-semibold text-foreground"
            numberOfLines={1}
            style={{ color: colors.foreground }}
          >
            {channelName}
          </Text>
          <Text
            className="mt-0.5 text-xs text-muted-foreground"
            numberOfLines={1}
            style={{ color: colors.mutedForeground }}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <Pressable
          className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted"
          onPress={(e) => {
            e.stopPropagation();
            onOpenOptions?.();
          }}
        >
          <Icon name="MoreHorizontal" className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
