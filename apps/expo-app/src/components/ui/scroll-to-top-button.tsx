import { Pressable } from "@/components/ui/pressable";
import { useAnimatedFloatingFooterBottom } from "@/components/floating-footer";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { Animated } from "react-native";

export function ScrollToTopButton({
  visible,
  onPress,
  bottom,
}: {
  visible: boolean;
  onPress: () => void;
  bottom?: number;
}) {
  const colors = useColors();
  const animatedBottom = useAnimatedFloatingFooterBottom();
  const resolvedBottom = bottom ?? animatedBottom;
  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        alignSelf: "center",
        bottom: resolvedBottom,
        zIndex: 70,
      }}
    >
      <Pressable
        accessibilityLabel="Scroll to top"
        onPress={onPress}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
          elevation: 18,
        }}
      >
        <Icon name="ArrowUp" size={19} className="text-foreground" />
      </Pressable>
    </Animated.View>
  );
}
