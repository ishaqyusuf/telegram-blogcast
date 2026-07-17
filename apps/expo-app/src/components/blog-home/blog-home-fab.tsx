import { useRouter } from "expo-router";
import { Animated, Pressable } from "react-native";

import { useAnimatedFloatingFooterBottom } from "@/components/floating-footer";
import { Icon } from "@/components/ui/icon";
import { useColorScheme } from "@/hooks/use-color";

export function BlogHomeFab() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const bottom = useAnimatedFloatingFooterBottom();

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        bottom,
        position: "absolute",
        right: 20,
        zIndex: 70,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add new blog"
        onPress={() => router.push("/blog-form" as any)}
        className="h-14 w-14 items-center justify-center rounded-full shadow-lg active:opacity-80"
        style={{
          backgroundColor: isDark ? "rgb(34, 197, 94)" : "rgb(30, 64, 175)",
          shadowColor: isDark ? "rgb(34, 197, 94)" : "rgb(15, 23, 42)",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0.28 : 0.2,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <Icon name="Plus" className="size-lg text-primary-foreground" />
      </Pressable>
    </Animated.View>
  );
}
