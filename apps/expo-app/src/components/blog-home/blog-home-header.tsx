import { LocalServicesConnectionButton } from "@/components/local-services";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

export function BlogHomeHeader() {
  const router = useRouter();

  return (
    <View className="bg-background px-5 pb-3 pt-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => router.push("/settings" as any)}
          className="size-11 items-center justify-center rounded-full bg-primary active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text className="text-xs font-bold text-primary-foreground">
            ME
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <LocalServicesConnectionButton />
          <Pressable
            onPress={() => router.push("/search" as any)}
            className="size-11 items-center justify-center rounded-full border border-border bg-card active:bg-muted"
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Icon name="Search" className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
