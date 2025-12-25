import { View, Text, TouchableOpacity } from "react-native";
import { ComponentProps } from "react";
import { Icon } from "../ui/icon";
import { cn } from "@/lib/utils";

const navItems: { name; icon: ComponentProps<typeof Icon>["name"] }[] = [
  { name: "Home", icon: "House" },
  { name: "Search", icon: "Search" },
  { name: "New", icon: "Plus" },
  { name: "History", icon: "History" },
  { name: "Profile", icon: "User" },
];

export function HomeFeedBottomNav() {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border pb-5 pt-2 px-6">
      <View className="flex-row items-center justify-between">
        {navItems.map((item, index) => (
          <View className="relative" key={index}>
            {/* Spacer for FAB */}
            {/* {index === 2 && <View className="w-8" />} */}
            <TouchableOpacity
              key={item.name}
              className={cn(
                "flex-col items-center gap-1 w-12",
                index == 2
                  ? " flex-row  items-center justify-center size-16 rounded-full bg-primary"
                  : ""
              )}
            >
              <Icon
                name={item.icon}
                className={cn(
                  item.name === "Home"
                    ? "text-primary"
                    : "text-muted-foreground",
                  "size-24",
                  index == 2 ? "text-white size-32" : ""
                )}
              />
              {index == 2 || (
                <Text
                  className={`text-[10px] font-medium ${
                    item.name === "Home"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.name}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}
