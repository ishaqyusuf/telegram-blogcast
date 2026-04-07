import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

export const THEME = {
  light: {
    // Dark-first brand palette (mirrors dark theme — brand primary is green)
    background: "rgb(18, 18, 18)",
    foreground: "rgb(255, 255, 255)",

    card: "rgb(30, 30, 30)",
    cardForeground: "rgb(255, 255, 255)",

    popover: "rgb(32, 32, 32)",
    popoverForeground: "rgb(255, 255, 255)",

    primary: "rgb(29, 185, 84)",
    primaryForeground: "rgb(0, 0, 0)",

    success: "rgb(34, 197, 94)",
    successForeground: "rgb(236, 253, 245)",

    warn: "rgb(245, 158, 11)",
    warnForeground: "rgb(255, 251, 235)",

    secondary: "rgb(40, 40, 40)",
    secondaryForeground: "rgb(179, 179, 179)",

    muted: "rgb(40, 40, 40)",
    mutedForeground: "rgb(179, 179, 179)",

    accent: "rgb(29, 185, 84)",
    accentForeground: "rgb(0, 0, 0)",

    destructive: "rgb(178, 38, 38)",
    destructiveForeground: "rgb(250, 250, 250)",

    border: "rgb(40, 40, 40)",
    input: "rgb(58, 58, 58)",
    ring: "rgb(29, 185, 84)",

    radius: "0.65rem",

    chart1: "rgb(29, 185, 84)",
    chart2: "rgb(52, 211, 153)",
    chart3: "rgb(251, 191, 36)",
    chart4: "rgb(192, 132, 252)",
    chart5: "rgb(244, 63, 94)",
  },

  dark: {
    // Spotify-inspired dark palette
    background: "rgb(18, 18, 18)",
    foreground: "rgb(255, 255, 255)",

    card: "rgb(24, 24, 24)",
    cardForeground: "rgb(255, 255, 255)",

    popover: "rgb(32, 32, 32)",
    popoverForeground: "rgb(255, 255, 255)",

    primary: "rgb(29, 185, 84)",
    primaryForeground: "rgb(0, 0, 0)",

    success: "rgb(34, 197, 94)",
    successForeground: "rgb(236, 253, 245)",

    warn: "rgb(245, 158, 11)",
    warnForeground: "rgb(255, 251, 235)",

    secondary: "rgb(40, 40, 40)",
    secondaryForeground: "rgb(179, 179, 179)",

    muted: "rgb(40, 40, 40)",
    mutedForeground: "rgb(179, 179, 179)",

    accent: "rgb(29, 185, 84)",
    accentForeground: "rgb(0, 0, 0)",

    destructive: "rgb(178, 38, 38)",
    destructiveForeground: "rgb(250, 250, 250)",

    border: "rgb(40, 40, 40)",
    input: "rgb(48, 48, 48)",
    ring: "rgb(29, 185, 84)",

    radius: "0.65rem",

    chart1: "rgb(29, 185, 84)",
    chart2: "rgb(52, 211, 153)",
    chart3: "rgb(251, 191, 36)",
    chart4: "rgb(192, 132, 252)",
    chart5: "rgb(244, 63, 94)",
  },
};

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};

/** Convert any `rgb(...)`, `rgba(...)`, or hex color to `rgba(r, g, b, alpha)`. */
export function withAlpha(color: string, alpha: number) {
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }

  if (color.startsWith("rgba(")) {
    const channels = color.slice(5, -1).split(",").slice(0, 3).join(",");
    return `rgba(${channels}, ${alpha})`;
  }

  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : hex;

    if (normalized.length === 6) {
      const r = Number.parseInt(normalized.slice(0, 2), 16);
      const g = Number.parseInt(normalized.slice(2, 4), 16);
      const b = Number.parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return color;
}
