import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as SystemUI from "expo-system-ui";
import { useColorScheme } from "@/hooks/use-color";
import { THEME } from "@/lib/theme";

export function AppStatusBar() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? THEME.dark : THEME.light;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.background);
  }, [theme.background]);

  return (
    <StatusBar
      style={colorScheme === "dark" ? "light" : "dark"}
      backgroundColor={theme.background}
      translucent={false}
    />
  );
}
