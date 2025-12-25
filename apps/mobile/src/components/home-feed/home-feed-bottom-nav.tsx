
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
    <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#111422] border-t border-slate-200 dark:border-slate-800 pb-5 pt-2 px-6">
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
                color={item.name === "Home" ? "#1430b8" : "gray"}
              />
              <Text
                className={`text-[10px] font-medium ${
                  item.name === "Home" ? "text-primary" : "text-slate-400"
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
