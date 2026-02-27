import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";

import { Icon } from "@/components/ui/icon";

export default function BlogImageViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string; title?: string }>();
  const translateY = useRef(new Animated.Value(0)).current;

  const rawUri = typeof params.uri === "string" ? params.uri : "";
  const uri = (() => {
    if (!rawUri) return "";
    try {
      return decodeURIComponent(rawUri);
    } catch {
      return rawUri;
    }
  })();
  const title = typeof params.title === "string" ? params.title : "Image";
  const backdropOpacity = translateY.interpolate({
    inputRange: [-280, 0, 280],
    outputRange: [0.6, 1, 0.6],
    extrapolate: "clamp",
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > Math.abs(gesture.dx) &&
          Math.abs(gesture.dy) > 4,
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dy) > 140 || Math.abs(gesture.vy) > 1.2) {
            router.back();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        },
      }),
    [router, translateY],
  );

  return (
    <Animated.View className="flex-1 bg-black" style={{ opacity: backdropOpacity }}>
      <View className="absolute left-0 right-0 top-0 z-20 flex-row items-center justify-between px-4 pb-3 pt-14">
        <Text className="flex-1 pr-4 text-sm font-semibold text-white" numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="size-10 items-center justify-center rounded-full bg-black/50"
        >
          <Icon name="X" className="text-white" />
        </Pressable>
      </View>

      <Animated.View
        className="flex-1 items-center justify-center"
        style={{ transform: [{ translateY }] }}
        {...panResponder.panHandlers}
      >
        {uri ? (
          <Image
            source={{ uri }}
            className="h-full w-full"
            resizeMode="contain"
          />
        ) : (
          <Text className="text-sm text-zinc-300">Image not available.</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}
