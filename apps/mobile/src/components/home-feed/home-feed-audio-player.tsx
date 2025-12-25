
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function HomeFeedAudioPlayer({ duration }: { duration: string }) {
  // A fake waveform for display purposes
  const waveform = [4, 5, 4, 2, 3, 5, 2, 4, 3, 2, 5, 3];
  return (
    <View className="bg-slate-50 dark:bg-[#111422] rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-800">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-primary items-center justify-center">
          <MaterialIcons name="play-arrow" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1 flex-col gap-1.5">
          <View className="flex-row items-center gap-px h-6">
            {waveform.map((h, i) => (
              <View
                key={i}
                className={`w-1 rounded-full ${
                  i < 4 ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
                }`}
                style={{ height: h * 2 + 4 }}
              />
            ))}
            <View className="flex-1 flex-row items-center gap-px h-6">
              {Array.from({ length: 20 }).map((_, i) => (
                <View
                  key={i}
                  className="w-1 h-2 bg-slate-300 dark:bg-slate-600 rounded-full"
                />
              ))}
            </View>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              00:00
            </Text>
            <Text className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              {duration}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
