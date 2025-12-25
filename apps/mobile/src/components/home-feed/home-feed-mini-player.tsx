
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { DUMMY_NOW_PLAYING } from "./__mocks__/data";

export function HomeFeedMiniPlayer() {
  const { title, artist, artwork, progress } = DUMMY_NOW_PLAYING;
  return (
    <View className="absolute bottom-24 left-4 right-4 z-40">
      <View className="bg-slate-900/95 dark:bg-[#1E2336]/95 rounded-xl shadow-lg border border-slate-800 p-2 pr-4 flex-row items-center gap-3">
        <Image source={{ uri: artwork }} className="w-10 h-10 rounded-lg" />
        <View className="flex-1 min-w-0">
          <Text className="text-white text-xs font-bold" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-slate-400 text-[10px]" numberOfLines={1}>
            {artist}
          </Text>
          <View className="w-full bg-slate-700 rounded-full h-1 mt-1.5">
            <View
              className="bg-primary h-1 rounded-full"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity>
            <MaterialIcons name="play-arrow" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity>
            <MaterialIcons name="close" size={20} color="gray" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
