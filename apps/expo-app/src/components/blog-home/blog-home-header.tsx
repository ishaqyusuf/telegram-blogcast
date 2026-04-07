import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Path, Rect, Svg } from "react-native-svg";

import { Icon } from "@/components/ui/icon";
import { useColorScheme } from "nativewind";
import * as Haptics from "expo-haptics";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function BlogHomeHeader() {
  const greeting = getGreeting();
  const router = useRouter();
  const { colorScheme, setColorScheme } = useColorScheme();

  function toggleColorScheme() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setColorScheme(colorScheme === "dark" ? "light" : "dark");
  }

  return (
    <View className="bg-background px-4 pb-4 pt-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="items-center justify-center rounded-lg bg-accent p-1.5">
            <Logo className="text-accent-foreground" />
          </View>
          <View className="gap-0.5">
            <Text className="text-2xl font-bold tracking-tight text-foreground">
              {greeting}
            </Text>
            <Text className="text-sm font-medium text-muted-foreground">
              Alghurobaa
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push("/search" as any)}
            className="p-2 rounded-full active:bg-muted"
          >
            <Icon name="Search" className="text-muted-foreground" />
          </Pressable>
          <Pressable
            onPress={toggleColorScheme}
            className="p-2 rounded-full active:bg-muted"
          >
            <Icon
              name={colorScheme === "dark" ? "Sun" : "Moon"}
              className="text-muted-foreground"
            />
          </Pressable>
          <View className="size-9 rounded-full bg-primary items-center justify-center">
            <Text className="text-xs font-bold text-primary-foreground">
              ME
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <Svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="Alghurobaa logo"
    >
      <Rect
        x={2.75}
        y={2.75}
        width={18.5}
        height={18.5}
        rx={6}
        stroke="currentColor"
        strokeWidth={1.7}
        opacity={0.32}
      />
      <Path
        d="M12 5.2L15.9 9.2H13.9V16.7H10.1V9.2H8.1L12 5.2Z"
        fill="currentColor"
        opacity={0.98}
      />
      <Path
        d="M16.15 5.35A2.15 2.15 0 1 1 16.15 9.65A1.35 1.35 0 1 0 16.15 5.35Z"
        fill="currentColor"
        opacity={0.9}
      />
      <Path
        d="M6.05 9.05C4.92 10 4.2 11.35 4.2 12.9C4.2 14.45 4.92 15.8 6.05 16.75"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        opacity={0.86}
      />
      <Path
        d="M17.95 9.05C19.08 10 19.8 11.35 19.8 12.9C19.8 14.45 19.08 15.8 17.95 16.75"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        opacity={0.86}
      />
      <Path
        d="M6.2 17.8C7.65 16.82 9.38 16.3 11.2 16.3H12.8C14.62 16.3 16.35 16.82 17.8 17.8V18.85C16.35 17.92 14.62 17.4 12.8 17.4H11.2C9.38 17.4 7.65 17.92 6.2 18.85V17.8Z"
        fill="currentColor"
        opacity={0.9}
      />
    </Svg>
  );
}
