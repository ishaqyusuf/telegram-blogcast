import { THEME } from "@/lib/theme";
import { createContext, createElement, useCallback, useContext, type ReactNode } from "react";
import { Appearance, useColorScheme as useRNColorScheme } from "react-native";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";

type AppColorScheme = "light" | "dark" | "system";
type AppColors = typeof THEME.light;
const ScopedColorsContext = createContext<AppColors | null>(null);

export function ScopedColorsProvider({ children, colors }: { children: ReactNode; colors: AppColors }) {
  return createElement(ScopedColorsContext.Provider, { value: colors }, children);
}

export function useColors() {
  const { colorScheme } = useColorScheme();
	const scopedColors = useContext(ScopedColorsContext);

  return scopedColors ?? (colorScheme === "dark" ? THEME.dark : THEME.light);
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
