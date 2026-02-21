import { View, Text } from "react-native";
import { Music } from "lucide-react-native";
import { DUMMY_AUDIO_CONTEXT } from "./__mocks__/data";

export function CommentsAudioContext() {
  const { title, currentTime, progress } = DUMMY_AUDIO_CONTEXT;
  return (
    <View className="px-6 pb-6 pt-1 bg-background shrink-0 border-b border-border z-30">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2 overflow-hidden">
          <View className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center shrink-0">
            <Music size={14} className="text-primary" />
          </View>
          <Text
            className="text-muted-foreground text-xs font-medium truncate"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <Text className="text-primary text-xs font-bold">{currentTime}</Text>
      </View>
      {/* Progress Bar with Comment Markers */}
      <View className="relative h-6 flex items-center group">
        {/* Track */}
        <View className="absolute w-full h-1.5 bg-primary/20 rounded-full overflow-hidden">
          {/* Progress Fill */}
          <View
            className="h-full bg-primary"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
        {/* Comment Markers (Ticks) */}
        <View
          className="absolute h-2.5 w-0.5 bg-muted-foreground rounded-full top-1/2 -translate-y-1/2"
          style={{ left: "15%" }}
        />
        <View
          className="absolute h-4 w-4 bg-foreground border-2 border-primary rounded-full shadow-lg z-10 top-1/2 -translate-y-1/2"
          style={{ left: `${progress * 100}%` }}
        />
        <View
          className="absolute h-2.5 w-0.5 bg-muted-foreground rounded-full top-1/2 -translate-y-1/2"
          style={{ left: "70%" }}
        />
      </View>
    </View>
  );
}
