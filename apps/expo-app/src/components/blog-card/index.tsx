import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useRef } from "react";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { useRecentlyViewedStore } from "@/store/recently-viewed-store";

import { CardFooter } from "./card-footer";
import { CardHeader } from "./card-header";
import { CardMedia } from "./card-media";
import type { BlogItem } from "./types";
import { getBlogHref, resolveVariant } from "./utils";

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
  const isDeletingRef = useRef(false);
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

  const handleSwipeWillOpen = async (direction: "left" | "right") => {
    if (direction !== "left" || isDeletingRef.current) return;

    isDeletingRef.current = true;
    swipeRef.current?.close();

    try {
      await onDelete?.(post);
    } finally {
      isDeletingRef.current = false;
    }
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      overshootRight={false}
      rightThreshold={72}
      onSwipeableWillOpen={handleSwipeWillOpen}
      renderRightActions={() => <View className="ml-2 h-full w-1" />}
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
