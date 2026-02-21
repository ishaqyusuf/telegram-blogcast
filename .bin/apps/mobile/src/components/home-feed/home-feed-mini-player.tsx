import { View, Text, TouchableOpacity, Image } from "react-native";

import { useAudioStore } from "@/store/audio-store";
import { Icon } from "../ui/icon";
import { percent } from "@acme/utils";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export function HomeFeedMiniPlayer() {
  // const { title, artist, artwork, progress } = DUMMY_NOW_PLAYING;
  const { blog, isPlaying, position, duration, togglePlayPause } =
    useAudioStore();
  const percentage = useMemo(() => {
    return percent(position, duration);
  }, [position, duration]);
  if (!blog) return null;
  return (
    <View className="absolute bg-background bottom-24 left-4 right-4 z-40">
      <View className="bg-popover/95 rounded-xl shadow-lg border border-border p-2 pr-4 flex-row items-center gap-3">
        <Image
          source={{ uri: blog.artwork! }}
          className="size-10 border border-muted-dark rounded-lg"
        />
        <View className="flex-1 min-w-0">
          <Text
            className="text-popover-foreground text-xs font-bold"
            numberOfLines={1}
          >
            {blog?.title}
          </Text>
          <Text className="text-muted-foreground text-[10px]" numberOfLines={1}>
            {blog?.audio?.authorName}
          </Text>
          <View className="w-full bg-muted rounded-full h-1 mt-1.5 relative">
            <View
              className={cn(
                "bg-primary z-10 h-1 rounded-full absolute",
                `w-[calc(${percentage}%)]`
              )}
              // style={{ width: `calc(${100}%)` }}
              // style={{ width: "10%" }}
            />
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={togglePlayPause}>
            <Icon
              name={isPlaying ? "Pause" : "Play"}
              className="text-foreground size-16"
            />
          </TouchableOpacity>
          <TouchableOpacity>
            <Icon name={"X"} className="text-foreground size-16" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
