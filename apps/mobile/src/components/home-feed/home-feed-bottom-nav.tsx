import { View, Text, TouchableOpacity } from "react-native";
import { Home, Search, History, User } from "lucide-react-native";
import { Fragment } from "react";

const navItems = [
  { name: "Home", icon: Home },
  { name: "Search", icon: Search },
  { name: "History", icon: History },
  { name: "Profile", icon: User },
];

export function HomeFeedBottomNav() {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border pb-5 pt-2 px-6">
      <View className="flex-row items-center justify-between">
        {navItems.map((item, index) => (
          <Fragment key={index}>
            {/* Spacer for FAB */}
            {index === 2 && <View className="w-8" />}
            <TouchableOpacity
              key={item.name}
              className="flex-col items-center gap-1 w-12"
            >
              <item.icon
                size={24}
                className={
                  item.name === "Home"
                    ? "text-primary"
                    : "text-muted-foreground"
                }
              />
              <Text
                className={`text-[10px] font-medium ${
                  item.name === "Home"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          </Fragment>
        ))}
      </View>
    </View>
  );
}
