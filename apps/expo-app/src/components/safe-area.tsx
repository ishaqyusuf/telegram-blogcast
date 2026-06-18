import { Platform, StyleProp, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-color";

export function SafeArea({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
        },
        style,
        {
          paddingTop: Platform.select({
            android: insets.top,
          }),
        },
      ]}
    >
      {children}
    </View>
  );
}
