import { View, Text, TouchableOpacity } from "react-native";
import { Home, Search, History, User } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../ui/icon";

const navItems = [
  { name: "Home", icon: Home },
  { name: "Search", icon: Search },
  { name: "History", icon: History },
  { name: "Profile", icon: User },
];

export function AudioBlogBottomNav() {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border">
      <View className="flex-row items-center justify-around">
        {navItems.map((item, index) => (
          <>
            {/* Spacer for FAB */}
            {index === 2 && (
              <View className="relative w-14 h-14 -top-6">
                <TouchableOpacity className="w-14 h-14 rounded-full bg-primary text-foreground flex items-center justify-center shadow-lg ring-4 ring-background">
                  <Icon name="Plus" size={28} />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              key={item.name}
              className="flex-col items-center gap-1 p-2 w-16"
            >
              <item.icon size={26} className="text-muted-foreground" />
              <Text className="text-[10px] font-medium text-muted-foreground">
                {item.name}
              </Text>
            </TouchableOpacity>
          </>
        ))}
      </View>
      <SafeAreaView edges={["bottom"]} />
    </View>
  );
}
