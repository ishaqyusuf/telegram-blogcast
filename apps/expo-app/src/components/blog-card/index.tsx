import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { useCallback, useMemo, useRef } from "react";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useRecentlyViewedStore } from "@/store/recently-viewed-store";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

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
  const colors = useColors();
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
  const colors = useColors();
  const destructive = colors.destructive;
  const transparentDestructive = useMemo(
    () => withAlpha(destructive, 0),
    [destructive],
  );
  const subtleDestructive = useMemo(
    () => withAlpha(destructive, 0.1),
    [destructive],
  );
  const softDestructive = useMemo(
    () => withAlpha(destructive, 0.18),
    [destructive],
  );
  const strongDestructive = useMemo(
    () => withAlpha(destructive, 0.82),
    [destructive],
  );

  const actionStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translation.value);

    return {
      opacity: progress.value === 0 ? 0 : 1,
      backgroundColor: interpolateColor(
        drag,
        [0, fullSwipeThreshold * 0.6, fullSwipeThreshold],
        [transparentDestructive, subtleDestructive, softDestructive],
      ),
    };
  });

  const triggerThresholdHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  useAnimatedReaction(
    () => Math.abs(translation.value) >= fullSwipeThreshold,
    (isPastThreshold, wasPastThreshold) => {
      if (isPastThreshold && !wasPastThreshold) {
        runOnJS(triggerThresholdHaptic)();
      }
    },
    [fullSwipeThreshold, triggerThresholdHaptic],
  );

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
            [28, 0, -Math.min(actionWidth * 0.14, 56)],
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

  const iconShellStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translation.value);

    return {
      backgroundColor: interpolateColor(
        drag,
        [0, fullSwipeThreshold * 0.72, fullSwipeThreshold],
        [strongDestructive, destructive, destructive],
      ),
      transform: [
        {
          scale: interpolate(
            drag,
            [0, fullSwipeThreshold * 0.72, fullSwipeThreshold],
            [0.92, 1, 1.05],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const deleteLabelStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translation.value);

    return {
      opacity: interpolate(
        drag,
        [0, fullSwipeThreshold * 0.74, fullSwipeThreshold * 0.9],
        [1, 1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            drag,
            [fullSwipeThreshold * 0.74, fullSwipeThreshold],
            [0, -4],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const releaseLabelStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translation.value);

    return {
      opacity: interpolate(
        drag,
        [fullSwipeThreshold * 0.78, fullSwipeThreshold],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            drag,
            [fullSwipeThreshold * 0.78, fullSwipeThreshold],
            [4, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      className="h-full items-end justify-center px-4"
      style={[{ width: actionWidth }, actionStyle]}
    >
      <Animated.View
        className="min-h-16 min-w-20 items-center justify-center gap-1"
        style={contentStyle}
      >
        <Animated.View
          className="h-12 w-12 items-center justify-center rounded-full shadow-sm"
          style={iconShellStyle}
        >
          <Icon name="Trash2" className="size-md text-destructive-foreground" />
        </Animated.View>
        <View className="h-4 w-20 items-center justify-center">
          <Animated.Text
            className="absolute text-[11px] font-semibold uppercase text-destructive"
            style={[{ color: destructive }, deleteLabelStyle]}
          >
            Delete
          </Animated.Text>
          <Animated.Text
            className="absolute text-[11px] font-semibold uppercase text-destructive"
            style={[{ color: destructive }, releaseLabelStyle]}
          >
            Release
          </Animated.Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
