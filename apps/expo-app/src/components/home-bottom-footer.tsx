import { Pressable } from "@/components/ui/pressable";
import { useState } from "react";
import { Text, View } from "react-native";

import { Icon } from "./ui/icon";
import { _router } from "./static-router";
import { useTranslation, type TranslationKey } from "@/lib/i18n";

const NAV_ITEMS = [
  { key: "home", labelKey: "home", icon: "Home" as const },
  { key: "search", labelKey: "search", icon: "Search" as const, route: "/search" },
  { key: "channels", labelKey: "channels", icon: "Radio" as const, route: "/channels" },
  { key: "history", labelKey: "history", icon: "History" as const, route: "/play-history" },
  { key: "profile", labelKey: "profile", icon: "User" as const },
] as const;

export const HomeBottomNav = () => {
  const [active, setActive] = useState<string>("home");
  const { t } = useTranslation();

  return (
    <View className="absolute bottom-0 w-full bg-card border-t border-border pb-6 pt-1">
      <View className="flex-row justify-around items-center h-14">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <Pressable
              key={item.key}
              className="items-center gap-1 w-16 active:opacity-70"
              onPress={() => {
                setActive(item.key);
                if ("route" in item) _router.push(item.route);
              }}
            >
              <Icon
                name={item.icon}
                size={22}
                className={isActive ? "text-foreground" : "text-muted-foreground"}
              />
              <Text
                className={`text-[10px] ${
                  isActive
                    ? "text-foreground font-bold"
                    : "text-muted-foreground font-medium"
                }`}
              >
                {t(item.labelKey as TranslationKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
