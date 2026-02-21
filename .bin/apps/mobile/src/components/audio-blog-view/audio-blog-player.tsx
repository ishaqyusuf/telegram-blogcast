import { View, Text, TouchableOpacity, Image } from "react-native";
import {
  Headphones,
  Rewind,
  Play,
  FastForward,
  Volume2,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DUMMY_AUDIO_BLOG } from "./__mocks__/data";
import { useState } from "react";

function PlayerScrubber() {
  const { progress, currentTime, remainingTime } = DUMMY_AUDIO_BLOG;
  return (
    <View className="py-2">
      <View className="relative h-10 flex items-center">
        {/* Background Track */}
        <View className="absolute w-full h-1.5 bg-muted rounded-full overflow-hidden">
          {/* Progress */}
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
        {/* Comment Markers */}
        <View
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-foreground rounded-full ring-2 ring-background z-10"
          style={{ left: "20%" }}
        />
        <View
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary/40 rounded-full z-0"
          style={{ left: "65%" }}
        />
        {/* Knob */}
        <View
          className="absolute w-4 h-4 bg-white rounded-full shadow-md border-2 border-primary z-20"
          style={{ left: `${progress * 100}%` }}
        />
      </View>
      {/* Time Labels */}
      <View className="flex-row justify-between text-xs font-medium text-muted-foreground mt-[-8px]">
        <Text className="text-xs font-medium text-muted-foreground">
          {currentTime}
        </Text>
        <Text className="text-xs font-medium text-muted-foreground">
          {remainingTime}
        </Text>
      </View>
    </View>
  );
}

function PlayerControls() {
  const [isPlaying, setIsPlaying] = useState(true);
  return (
    <View className="flex items-center justify-between mt-2 flex-row">
      <TouchableOpacity className="text-xs font-bold text-muted-foreground px-2 py-1 rounded-md bg-muted">
        <Text className="text-xs font-bold text-muted-foreground">1.0x</Text>
      </TouchableOpacity>
      <View className="flex-row items-center gap-6">
        <TouchableOpacity className="p-2">
          <Rewind size={32} className="text-foreground" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setIsPlaying(!isPlaying)}
          className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg"
        >
          <Play
            size={40}
            color="white"
            fill="white"
            style={{ marginLeft: isPlaying ? 0 : 4 }}
          />
        </TouchableOpacity>
        <TouchableOpacity className="p-2">
          <FastForward size={32} className="text-foreground" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity className="p-2">
        <Volume2 size={20} className="text-muted-foreground" />
      </TouchableOpacity>
    </View>
  );
}

export function AudioBlogPlayer() {
  const { image, category, listenCount } = DUMMY_AUDIO_BLOG;
  return (
    <View className="flex flex-col gap-6">
      <View className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl">
        <Image
          source={{ uri: image }}
          className="w-full h-full object-cover"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          className="absolute inset-0"
        />
        <View className="absolute top-4 right-4 z-20">
          <View className="px-3 py-1 bg-black/40 rounded-full border border-white/10">
            <Text className="text-white text-xs font-medium">Audio Blog</Text>
          </View>
        </View>
      </View>

      <View className="flex flex-col gap-2">
        <View className="flex justify-between items-center text-xs font-semibold tracking-wide text-primary uppercase">
          <Text className="text-xs font-semibold tracking-wide text-primary uppercase">
            {category}
          </Text>
          <View className="flex-row items-center gap-1 opacity-80">
            <Headphones size={16} className="text-primary" />
            <Text className="text-xs font-semibold tracking-wide text-primary uppercase">
              {listenCount}
            </Text>
          </View>
        </View>
        <PlayerScrubber />
        <PlayerControls />
      </View>
    </View>
  );
}
