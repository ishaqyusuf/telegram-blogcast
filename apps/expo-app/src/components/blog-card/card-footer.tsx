import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

import type { BlogItem } from "./types";

export function CardFooter({ post }: { post: BlogItem }) {
  const tags = post.tags?.slice(0, 2) ?? [];
  const colors = useColors();

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
          <Icon name="Share2" className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
