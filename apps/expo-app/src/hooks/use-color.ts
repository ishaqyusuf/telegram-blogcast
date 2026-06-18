import { THEME } from "@/lib/theme";
import { useCallback } from "react";
import { Appearance, useColorScheme as useRNColorScheme } from "react-native";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";

type AppColorScheme = "light" | "dark" | "system";

export function useColors() {
  const { colorScheme } = useColorScheme();

  return colorScheme === "dark" ? THEME.dark : THEME.light;
}

export function useColorScheme() {
  const rnColorScheme = useRNColorScheme();
  const {
    colorScheme: nativeWindColorScheme,
    setColorScheme: setNativeWindColorScheme,
  } = useNativeWindColorScheme();

  const resolvedColorScheme: "light" | "dark" =
    nativeWindColorScheme === "dark" || nativeWindColorScheme === "light"
      ? nativeWindColorScheme
      : rnColorScheme === "dark"
        ? "dark"
        : "light";
  const setColorScheme = useCallback(
    (scheme: AppColorScheme) => {
      setNativeWindColorScheme(
        scheme as Parameters<typeof setNativeWindColorScheme>[0],
      );
      Appearance.setColorScheme(scheme === "system" ? null : scheme);
    },
    [setNativeWindColorScheme],
  );
  const toggleColorScheme = useCallback(() => {
    setColorScheme(resolvedColorScheme === "dark" ? "light" : "dark");
  }, [resolvedColorScheme, setColorScheme]);

  return {
    colorScheme: resolvedColorScheme,
    setColorScheme,
    toggleColorScheme,
  };
}
