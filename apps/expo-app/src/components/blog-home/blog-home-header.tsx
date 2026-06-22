import { Pressable } from "@/components/ui/pressable";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n";
import { useColorScheme, useColors } from "@/hooks/use-color";
import { setThemeOverride } from "@/lib/theme-preference";
import * as Haptics from "expo-haptics";

const LOGOS = {
  light: require("../../../assets/icons/splash-logo-light.png"),
  dark: require("../../../assets/icons/splash-logo-dark.png"),
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function BlogHomeHeader() {
  const greeting = getGreeting();
  const router = useRouter();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { t } = useTranslation();
  const colors = useColors();

  async function toggleColorScheme() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const nextScheme = colorScheme === "dark" ? "light" : "dark";
    await setThemeOverride(nextScheme);
    setColorScheme(nextScheme);
  }

  return (
    <View
      className="bg-background px-4 pb-4 pt-3"
      style={{ backgroundColor: colors.background }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="size-10 overflow-hidden rounded-xl border border-border bg-card"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <Image
              source={LOGOS[colorScheme]}
              style={{ height: "100%", width: "100%" }}
              contentFit="cover"
              accessibilityLabel="Alghurobaa logo"
            />
          </View>
          <View className="gap-0.5">
            <Text
              className="text-2xl font-bold tracking-tight text-foreground"
              style={{ color: colors.foreground }}
            >
              {greeting}
            </Text>
            <Text
              className="text-sm font-medium text-muted-foreground"
              style={{ color: colors.mutedForeground }}
            >
              Alghurobaa
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push("/search" as any)}
            className="p-2 rounded-full active:bg-muted"
          >
            <Icon name="Search" className="text-muted-foreground" />
          </Pressable>
          <Pressable
            onPress={toggleColorScheme}
            className="p-2 rounded-full active:bg-muted"
          >
            <Icon
              name={colorScheme === "dark" ? "Sun" : "Moon"}
              className="text-muted-foreground"
            />
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings" as any)}
            className="p-2 rounded-full active:bg-muted"
            accessibilityRole="button"
            accessibilityLabel={t("settings")}
          >
            <Icon name="Settings" className="size-base text-muted-foreground" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/transcribe-queue" as any)}
            className="p-2 rounded-full active:bg-muted"
            accessibilityRole="button"
            accessibilityLabel="Transcribe queue"
          >
            <Icon name="Captions" className="size-base text-muted-foreground" />
          </Pressable>
          <View className="size-9 rounded-full bg-primary items-center justify-center">
            <Text
              className="text-xs font-bold text-primary-foreground"
              style={{ color: colors.primaryForeground }}
            >
              ME
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
