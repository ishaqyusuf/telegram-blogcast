/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "nativewind";
import { NAV_THEME } from "@/lib/theme";

export function useThemeConfig() {
  // props: { light?: string; dark?: string },
  // colorName: keyof typeof Colors.light & keyof typeof Colors.dark
  const { colorScheme } = useColorScheme();

  return colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;
  // const theme = useColorScheme() ?? "light";
  // const colorFromProps = props[theme];

  // if (colorFromProps) {
  //   return colorFromProps;
  // } else {
  //   return Colors[theme][colorName];
  // }
}
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme ?? "light";
  const colorFromProps = props[theme];
  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
