import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "expo-router";
import { Text, useWindowDimensions, View } from "react-native";
import { useCallback, useMemo, useRef } from "react";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useRecentlyViewedStore } from "@/store/recently-viewed-store";

import { CardFooter } from "./card-footer";
import { CardHeader } from "./card-header";
import { CardMedia } from "./card-media";
import type { BlogItem } from "./types";
import { getBlogHref, resolveVariant } from "./utils";

export type { BlogItem } from "./types";

const MAX_FULL_SWIPE_THRESHOLD = 300;
const MIN_FULL_SWIPE_THRESHOLD = 176;

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
  const swipeRef = useRef<any>(null);
  const isDeletingRef = useRef(false);
  const variant = resolveVariant(post);
  const href = getBlogHref(post);
  const fullSwipeThreshold = useMemo(
    () =>
      Math.min(
        Math.max(width * 0.58, MIN_FULL_SWIPE_THRESHOLD),
        MAX_FULL_SWIPE_THRESHOLD,
      ),
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

function SwipeDeleteAction({
  progress,
  translation,
  actionWidth,
  fullSwipeThreshold,
}: {
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  actionWidth: number;
  fullSwipeThreshold: number;
}) {
  const actionStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value === 0 ? 0 : 1,
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translation.value);

    return {
      opacity: interpolate(
        drag,
        [24, fullSwipeThreshold * 0.42, fullSwipeThreshold],
        [0, 0.85, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            drag,
            [0, fullSwipeThreshold * 0.45, fullSwipeThreshold],
            [36, 0, -Math.min(actionWidth * 0.18, 76)],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            drag,
            [0, fullSwipeThreshold * 0.64, fullSwipeThreshold],
            [0.88, 1, 1.14],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      className="h-full items-end justify-center bg-destructive px-6"
      style={[{ width: actionWidth }, actionStyle]}
    >
      <Animated.View className="items-center gap-1" style={contentStyle}>
        <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <Icon name="Trash2" size={24} className="text-white" />
        </View>
        <Text className="text-xs font-semibold uppercase text-white">
          Delete
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
