import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";

export function BlogHomeHeader() {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-background/95 border-b border-border">
      <View className="flex-row items-center gap-3">
        <View className="bg-accent rounded-lg p-1.5 items-center justify-center">
          <Icon name="AudioWaveform" className="text-accent-foreground" />
        </View>
        <Text className="text-xl font-bold tracking-tight text-foreground">
          Alghurobaa
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable className="relative p-2 rounded-full active:bg-muted">
          <Icon name="Bell" className="text-muted-foreground" />
          <View className="absolute top-2 right-2 size-2 bg-destructive rounded-full border-2 border-background" />
        </Pressable>
        <View className="size-9 rounded-full bg-muted border border-border items-center justify-center">
          <Text className="text-sm font-bold text-muted-foreground">ME</Text>
        </View>
      </View>
    </View>
  );
}
