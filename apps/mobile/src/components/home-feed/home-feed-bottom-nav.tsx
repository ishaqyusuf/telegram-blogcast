
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

const navItems = [
  { name: "Home", icon: "home" },
  { name: "Search", icon: "search" },
  { name: "History", icon: "history" },
  { name: "Profile", icon: "person" },
];

export function HomeFeedBottomNav() {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border pb-5 pt-2 px-6">
      <View className="flex-row items-center justify-between">
        {navItems.map((item, index) => (
          <>
            {/* Spacer for FAB */}
            {index === 2 && <View className="w-8" />}
            <TouchableOpacity
              key={item.name}
              className="flex-col items-center gap-1 w-12"
            >
              <MaterialIcons
                name={item.icon as any}
                size={24}
                className={
                  item.name === "Home" ? "text-primary" : "text-muted-foreground"
                }
              />
              <Text
                className={`text-[10px] font-medium ${
                  item.name === "Home" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          </>
        ))}
      </View>
    </View>
  );
}
