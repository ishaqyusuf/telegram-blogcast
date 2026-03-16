import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";

export function BlogHomeMiniPlayer() {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border">
      <View className="w-full h-0.5 bg-muted">
        <View className="h-full bg-primary w-[30%]" />
      </View>
      <View className="flex-row items-center px-3 h-16 gap-3">
        <View className="size-11 rounded-md bg-muted shrink-0" />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            Episode 4: The Journey Begins
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            Daily Reflections
          </Text>
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable className="active:opacity-70">
            <Icon name="Heart" size={20} className="text-muted-foreground" />
          </Pressable>
          <Pressable className="active:opacity-70">
            <Icon name="Play" size={24} className="text-foreground" />
          </Pressable>
          <Pressable className="active:opacity-70">
            <Icon name="SkipForward" size={20} className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
