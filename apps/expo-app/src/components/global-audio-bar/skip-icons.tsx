import { Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";

interface SkipIconProps {
  size?: number;
  color?: string;
}

export function SkipBack5Icon({ size = 24, color = "#ffffff" }: SkipIconProps) {
  const numSize = Math.round(size * 0.32);
  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name="RotateCcw" size={size} color={color} strokeWidth={2} />
      <Text
        style={{
          position: "absolute",
          fontSize: numSize,
          fontWeight: "800",
          color,
          lineHeight: numSize + 2,
          marginTop: Math.round(size * 0.1),
        }}
      >
        5
      </Text>
    </View>
  );
}

export function SkipForward5Icon({ size = 24, color = "#ffffff" }: SkipIconProps) {
  const numSize = Math.round(size * 0.32);
  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name="RotateCw" size={size} color={color} strokeWidth={2} />
      <Text
        style={{
          position: "absolute",
          fontSize: numSize,
          fontWeight: "800",
          color,
          lineHeight: numSize + 2,
          marginTop: Math.round(size * 0.1),
        }}
      >
        5
      </Text>
    </View>
  );
}
