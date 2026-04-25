import { View, Text } from "react-native";
import { DUMMY_AUDIO_CONTEXT } from "./__mocks__/data";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";

export function CommentsAudioContext() {
  const { title, currentTime, progress } = DUMMY_AUDIO_CONTEXT;
  const colors = useColors();
  return (
    <View className="px-6 pb-6 pt-1 bg-background shrink-0 border-b border-border z-30">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2 overflow-hidden">
          <View className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center shrink-0">
            <Icon name="Music" size={14} className="text-primary" />
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
            style={{ height: "100%", backgroundColor: colors.primary, width: `${progress * 100}%` }}
          />
        </View>
        {/* Comment Markers (Ticks) */}
        <View
          className="absolute h-2.5 w-0.5 bg-muted-foreground rounded-full top-1/2 -translate-y-1/2 left-[15%]"
        />
        <View
          style={{
            position: "absolute",
            height: 16,
            width: 16,
            backgroundColor: colors.background,
            borderWidth: 2,
            borderColor: colors.primary,
            borderRadius: 9999,
            zIndex: 10,
            top: "50%",
            marginTop: -8,
            left: `${progress * 100}%`,
          }}
        />
        <View
          className="absolute h-2.5 w-0.5 bg-muted-foreground rounded-full top-1/2 -translate-y-1/2 left-[70%]"
        />
      </View>
    </View>
  );
}
