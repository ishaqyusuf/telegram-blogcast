import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";

import type { BlogCardVariant, BlogItem } from "./types";
import {
  getChannelHandle,
  getChannelName,
  getInitials,
  getPostDateLabel,
} from "./utils";

const VARIANT_LABELS: Record<BlogCardVariant, string> = {
  audio: "Audio",
  "text+image": "Text + image",
  image: "Image",
  text: "Text",
  video: "Video",
  unknown: "Post",
};

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
  const channelHandle = getChannelHandle(post);
  const subtitle = [channelHandle, getPostDateLabel(post)]
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
        <View
          className="rounded-full border border-border bg-muted px-2.5 py-1"
          style={{ backgroundColor: colors.muted, borderColor: colors.border }}
        >
          <Text
            className="text-[11px] font-semibold text-muted-foreground"
            style={{ color: colors.mutedForeground }}
          >
            {VARIANT_LABELS[variant]}
          </Text>
        </View>
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
