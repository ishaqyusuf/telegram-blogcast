import { Pressable } from "@/components/ui/pressable";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n";
import type { AppLanguage } from "@/store/app-settings-store";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

const LANGUAGES: AppLanguage[] = ["en", "ar"];

export default function SettingsScreen() {
  const router = useRouter();
  const { language, setLanguage, t, textAlign, writingDirection, isRtl } =
    useTranslation();

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text
            className="text-foreground"
            style={{
              flex: 1,
              textAlign,
              fontSize: 22,
              fontWeight: "800",
              writingDirection,
            }}
          >
            {t("settings")}
          </Text>
        </View>

        <View className="gap-4 px-4 pt-2">
          <View className="gap-2 rounded-xl bg-card p-4">
            <Text
              className="text-foreground"
              style={{
                textAlign,
                fontSize: 15,
                fontWeight: "700",
                writingDirection,
              }}
            >
              {t("language")}
            </Text>
            <Text
              className="text-muted-foreground"
              style={{
                textAlign,
                fontSize: 13,
                lineHeight: 20,
                writingDirection,
              }}
            >
              {t("settingsDescription")}
            </Text>

            <View
              className="gap-2 pt-2"
              style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
            >
              {LANGUAGES.map((item) => {
                const selected = language === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setLanguage(item)}
                    className={
                      selected
                        ? "flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
                        : "flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-3"
                    }
                  >
                    {selected ? (
                      <Icon name="Check" size={16} className="text-background" />
                    ) : null}
                    <Text
                      className={
                        selected
                          ? "text-sm font-bold text-primary-foreground"
                          : "text-sm font-semibold text-foreground"
                      }
                    >
                      {item === "en" ? t("english") : t("arabic")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </SafeArea>
    </View>
  );
}
