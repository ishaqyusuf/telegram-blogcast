import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";

export function BlogHomeHeader() {
  const router = useRouter();
  const colors = useColors();

  return (
    <View
      className="bg-background px-5 pb-3 pt-3"
      style={{ backgroundColor: colors.background }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => router.push("/settings" as any)}
          className="items-center justify-center bg-primary active:opacity-80"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primary,
          }}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text
            className="text-xs font-bold text-primary-foreground"
            style={{ color: colors.primaryForeground }}
          >
            ME
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/search" as any)}
          className="items-center justify-center active:bg-muted"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Icon name="Search" className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
