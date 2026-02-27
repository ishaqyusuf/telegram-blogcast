import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";

import type { BlogItem } from "./types";

export function CardFooter({ post }: { post: BlogItem }) {
  const tags = post.tags?.slice(0, 2) ?? [];

  return (
    <View className="mt-3 flex-row items-center justify-between">
      <View className="flex-row gap-2">
        {tags.map((tag, idx) => (
          <View
            key={`${tag}-${idx}`}
            className="rounded-md bg-accent/10 px-2.5 py-1"
          >
            <Text className="text-xs font-medium text-accent">#{tag}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-center gap-4">
        <Pressable className="flex-row items-center gap-1">
          <Icon name="Heart" className="text-muted-foreground" />
          <Text className="text-xs font-medium text-muted-foreground">
            {post.likes ?? 0}
          </Text>
        </Pressable>
        <Pressable>
          <Icon name="Bookmark" className="text-muted-foreground" />
        </Pressable>
        <Pressable>
          <Icon name="Share2" className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
