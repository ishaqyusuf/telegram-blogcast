
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function HomeFeedAudioPlayer({ duration }: { duration: string }) {
  // A fake waveform for display purposes
  const waveform = [4, 5, 4, 2, 3, 5, 2, 4, 3, 2, 5, 3];
  return (
    <View className="bg-muted rounded-xl p-3 mb-4 border border-border">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-primary items-center justify-center">
          <MaterialIcons
            name="play-arrow"
            size={24}
            className="text-primary-foreground"
          />
        </TouchableOpacity>
        <View className="flex-1 flex-col gap-1.5">
          <View className="flex-row items-center gap-px h-6">
            {waveform.map((h, i) => (
              <View
                key={i}
                className={`w-1 rounded-full ${
                  i < 4 ? "bg-primary" : "bg-border"
                }`}
                style={{ height: h * 2 + 4 }}
              />
            ))}
            <View className="flex-1 flex-row items-center gap-px h-6">
              {Array.from({ length: 20 }).map((_, i) => (
                <View
                  key={i}
                  className="w-1 h-2 bg-border rounded-full"
                />
              ))}
            </View>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              00:00
            </Text>
            <Text className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {duration}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
