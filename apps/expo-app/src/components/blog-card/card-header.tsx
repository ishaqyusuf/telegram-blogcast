import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";

import type { BlogCardVariant, BlogItem } from "./types";
import {
  getChannelHandle,
  getChannelName,
  getInitials,
  getPostDateLabel,
} from "./utils";

export function CardHeader({
  post,
  variant,
  onOpenOptions,
}: {
  post: BlogItem;
  variant: BlogCardVariant;
  onOpenOptions?: () => void;
}) {
  const channelName = getChannelName(post);
  const channelHandle = getChannelHandle(post);
  const subtitle = [channelHandle, getPostDateLabel(post)]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="mb-3 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <View className="size-10 items-center justify-center rounded-full bg-muted">
          <Text className="text-sm font-bold text-foreground">
            {getInitials(channelName)}
          </Text>
        </View>
        <View className="max-w-[180px]">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {channelName}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <View className="rounded-full border border-border bg-muted px-2.5 py-1">
          <Text className="text-[10px] font-semibold uppercase text-muted-foreground">
            {variant}
          </Text>
        </View>
        <Pressable
          className="rounded-full p-1"
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
