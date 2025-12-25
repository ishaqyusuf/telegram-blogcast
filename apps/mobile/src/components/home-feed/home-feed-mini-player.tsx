
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { DUMMY_NOW_PLAYING } from "./__mocks__/data";

export function HomeFeedMiniPlayer() {
  const { title, artist, artwork, progress } = DUMMY_NOW_PLAYING;
  return (
    <View className="absolute bottom-24 left-4 right-4 z-40">
      <View className="bg-popover/95 rounded-xl shadow-lg border border-border p-2 pr-4 flex-row items-center gap-3">
        <Image source={{ uri: artwork }} className="w-10 h-10 rounded-lg" />
        <View className="flex-1 min-w-0">
          <Text
            className="text-popover-foreground text-xs font-bold"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            className="text-muted-foreground text-[10px]"
            numberOfLines={1}
          >
            {artist}
          </Text>
          <View className="w-full bg-muted rounded-full h-1 mt-1.5">
            <View
              className="bg-primary h-1 rounded-full"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity>
            <MaterialIcons
              name="play-arrow"
              size={24}
              className="text-popover-foreground"
            />
          </TouchableOpacity>
          <TouchableOpacity>
            <MaterialIcons
              name="close"
              size={20}
              className="text-muted-foreground"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
