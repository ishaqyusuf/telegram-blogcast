import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";

export function AppStatusBar() {
  const { colorScheme } = useColorScheme();
  // "light" status bar text for dark backgrounds, "dark" text for light backgrounds
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}
