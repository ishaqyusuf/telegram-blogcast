import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";

export function BlogHomeMiniPlayer() {
  return (
    <View className="absolute bottom-20 left-4 right-4 bg-card/95 border border-border rounded-xl p-2 pr-4 flex-row items-center gap-3 shadow-lg">
      <View className="size-10 rounded-lg bg-muted" />
      <View className="flex-1">
        <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
          Episode 4: The Journey Begins
        </Text>
        <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
          Daily Reflections
        </Text>
        <View className="w-full h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
          <View className="h-full bg-accent w-[30%]" />
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable className="active:opacity-70">
          <Icon name="Play" className="text-foreground" />
        </Pressable>
        <Pressable className="active:opacity-70">
          <Icon name="X" className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
