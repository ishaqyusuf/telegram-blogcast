import { useRouter } from "expo-router";
import { Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColorScheme } from "@/hooks/use-color";

export function BlogHomeFab() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add new blog"
      onPress={() => router.push("/blog-form" as any)}
      className="absolute bottom-24 right-5 h-14 w-14 items-center justify-center rounded-full shadow-lg active:opacity-80"
      style={{
        backgroundColor: isDark ? "rgb(191, 219, 254)" : "rgb(30, 64, 175)",
        shadowColor: isDark ? "rgb(96, 165, 250)" : "rgb(15, 23, 42)",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.28 : 0.2,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <Icon
        name="Plus"
        className={
          isDark ? "size-lg text-background" : "size-lg text-primary-foreground"
        }
      />
    </Pressable>
  );
}
