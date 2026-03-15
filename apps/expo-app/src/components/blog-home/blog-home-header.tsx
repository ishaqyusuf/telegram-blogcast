import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function BlogHomeHeader() {
  const greeting = getGreeting();

  return (
    <View className="px-4 pt-3 pb-4 bg-background">
      <View className="flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text className="text-2xl font-bold text-foreground tracking-tight">
            {greeting}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Icon name="AudioWaveform" size={14} className="text-primary" />
            <Text className="text-sm text-muted-foreground font-medium">
              Alghurobaa
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
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
