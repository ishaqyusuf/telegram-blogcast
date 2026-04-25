import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "@/hooks/use-color";
import { THEME } from "@/lib/theme";

export function AppStatusBar() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? THEME.dark : THEME.light;

  return (
    <StatusBar
      style={colorScheme === "dark" ? "light" : "dark"}
      backgroundColor={theme.background}
      translucent={false}
    />
  );
}
