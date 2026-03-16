import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { Alert, Text, View } from "react-native";
import { useRef } from "react";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { useRecentlyViewedStore } from "@/store/recently-viewed-store";

import { CardFooter } from "./card-footer";
import { CardHeader } from "./card-header";
import { CardMedia } from "./card-media";
import type { BlogItem } from "./types";
import { getBlogHref, resolveVariant } from "./utils";
import { Icon } from "@/components/ui/icon";

export type { BlogItem } from "./types";

export function BlogCard({
  post,
  onDelete,
}: {
  post: BlogItem;
  onDelete?: (post: BlogItem) => Promise<void> | void;
}) {
  const router = useRouter();
  const markViewed = useRecentlyViewedStore((state) => state.markViewed);
  const swipeRef = useRef<any>(null);
  const variant = resolveVariant(post);
  const href = getBlogHref(post);

  const handlePress = () => {
    markViewed({
      id: post.id,
      title: post.caption || post.audio?.title || "Untitled",
      type: post.type ?? "text",
      date: post.date ?? null,
    });
    router.push(href as any);
  };

  const confirmDelete = () => {
    Alert.alert("Delete post?", "This will remove the post from your feed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          swipeRef.current?.close();
          await onDelete?.(post);
        },
      },
    ]);
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      overshootRight={false}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable
          onPress={confirmDelete}
          className="ml-2 h-full w-20 items-center justify-center rounded-2xl bg-destructive"
        >
          <Icon name="Trash2" className="text-destructive-foreground" />
          <Text className="mt-1 text-xs font-semibold text-destructive-foreground">
            Delete
          </Text>
        </Pressable>
      )}
    >
      <View className="overflow-hidden rounded-2xl">
        <Pressable
          onPress={handlePress}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <CardHeader
            post={post}
            variant={variant}
            onOpenOptions={() => router.push(`/blog-options/${post.id}`)}
          />
          <CardMedia post={post} variant={variant} />
          <CardFooter post={post} />
        </Pressable>
      </View>
    </ReanimatedSwipeable>
  );
}
