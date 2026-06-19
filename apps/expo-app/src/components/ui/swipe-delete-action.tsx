import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";

export function getSwipeDeleteThreshold(width: number) {
  return Math.min(Math.max(width * 0.58, 176), 300);
}

export function SwipeDeleteAction({
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
  const deleteColors = useMemo(
    () => ({
      transparent: withAlpha(destructive, 0),
      subtle: withAlpha(destructive, 0.1),
      soft: withAlpha(destructive, 0.18),
    }),
    [destructive],
  );

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

  const actionStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translation.value);

    return {
      opacity: progress.value === 0 ? 0 : 1,
      backgroundColor: interpolateColor(
        drag,
        [0, fullSwipeThreshold * 0.6, fullSwipeThreshold],
        [deleteColors.transparent, deleteColors.subtle, deleteColors.soft],
      ),
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
            [28, 0, -Math.min(actionWidth * 0.14, 56)],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            drag,
            [0, fullSwipeThreshold * 0.64, fullSwipeThreshold],
            [0.88, 1, 1.12],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const iconShellStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translation.value);

    return {
      backgroundColor: destructive,
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
            className="text-[11px] font-semibold uppercase text-destructive"
            style={{ color: destructive }}
          >
            Delete
          </Animated.Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
