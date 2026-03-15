import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "./ui/icon";
import { _router } from "./static-router";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: "Home" as const },
  { key: "search", label: "Search", icon: "Search" as const },
  { key: "channels", label: "Channels", icon: "Radio" as const, route: "/channels" },
  { key: "history", label: "History", icon: "History" as const, route: "/play-history" },
  { key: "profile", label: "Profile", icon: "User" as const },
] as const;

export const HomeBottomNav = () => {
  const [active, setActive] = useState<string>("home");

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
                if (item.route) _router.push(item.route);
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
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
