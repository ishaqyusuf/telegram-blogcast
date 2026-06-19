import { Pressable } from "@/components/ui/pressable";
import {
  getSwipeDeleteThreshold,
  SwipeDeleteAction,
} from "@/components/ui/swipe-delete-action";
import { useRouter } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useCallback, useMemo, useRef } from "react";
import ReanimatedSwipeable, {
  SwipeDirection,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";

import { useRecentlyViewedStore } from "@/store/recently-viewed-store";
import { useColors } from "@/hooks/use-color";

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
  const { width } = useWindowDimensions();
  const markViewed = useRecentlyViewedStore((state) => state.markViewed);
  const colors = useColors();
  const swipeRef = useRef<any>(null);
  const isDeletingRef = useRef(false);
  const variant = resolveVariant(post);
  const href = getBlogHref(post);
  const fullSwipeThreshold = useMemo(
    () => getSwipeDeleteThreshold(width),
    [width],
  );

  const handlePress = () => {
    markViewed({
      id: post.id,
      title: post.caption || post.audio?.title || "Untitled",
      type: post.type ?? "text",
      date: post.date ? post.date.toISOString() : null,
    });
    router.push(href as any);
  };

  const handleSwipeWillOpen = async (direction: SwipeDirection) => {
    if (direction !== SwipeDirection.LEFT || isDeletingRef.current) return;

    isDeletingRef.current = true;
    swipeRef.current?.close();

    try {
      await onDelete?.(post);
    } finally {
      isDeletingRef.current = false;
    }
  };

  const renderRightActions = useCallback(
    (progress: SharedValue<number>, translation: SharedValue<number>) => (
      <SwipeDeleteAction
        progress={progress}
        translation={translation}
        actionWidth={width}
        fullSwipeThreshold={fullSwipeThreshold}
      />
    ),
    [fullSwipeThreshold, width],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={1.15}
      overshootFriction={8}
      overshootRight
      rightThreshold={fullSwipeThreshold}
      onSwipeableWillOpen={handleSwipeWillOpen}
      renderRightActions={renderRightActions}
    >
      <Pressable
        onPress={handlePress}
        className="border-b border-border bg-background px-4 py-4 active:bg-muted/40"
        style={{
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        }}
      >
        <CardHeader
          post={post}
          variant={variant}
          onOpenOptions={() => router.push(`/blog-options/${post.id}`)}
        />
        <CardMedia post={post} variant={variant} />
        <CardFooter post={post} />
      </Pressable>
    </ReanimatedSwipeable>
  );
}
