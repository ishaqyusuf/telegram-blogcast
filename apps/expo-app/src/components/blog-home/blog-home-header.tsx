import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Path, Rect, Svg } from "react-native-svg";

import { Icon } from "@/components/ui/icon";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function BlogHomeHeader() {
  const greeting = getGreeting();
  const router = useRouter();

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
          <Pressable className="relative p-2 rounded-full active:bg-muted">
            <Icon name="Bell" className="text-muted-foreground" />
            <View className="absolute top-2 right-2 size-2 bg-destructive rounded-full border-2 border-background" />
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
      <Path
        d="M12 3.5L14.75 6.25H9.25L12 3.5Z"
        fill="currentColor"
        opacity={0.95}
      />
      <Rect
        x={10.15}
        y={6.7}
        width={3.7}
        height={10.3}
        rx={1.4}
        fill="currentColor"
      />
      <Path
        d="M7.8 8.2C6.4 9.2 5.55 10.8 5.55 12.65C5.55 14.5 6.4 16.05 7.8 17.05"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Path
        d="M16.2 8.2C17.6 9.2 18.45 10.8 18.45 12.65C18.45 14.5 17.6 16.05 16.2 17.05"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Rect
        x={8.3}
        y={17.55}
        width={7.4}
        height={2.25}
        rx={1.1}
        fill="currentColor"
        opacity={0.9}
      />
    </Svg>
  );
}
