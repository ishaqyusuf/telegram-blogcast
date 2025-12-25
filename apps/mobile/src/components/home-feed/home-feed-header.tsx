import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function HomeFeedHeader() {
  const userAvatar =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBiyF1rMZCXkWSog4J9UbOA8uZTD6UpwQkaltoHUEaBGP3zsmMpKHi8s86akNJOZJDyoaz7l4PMv9rwcXUVlKCJvKHiuf8NQ_NrqYtfqZt9m-QoeXEpq2DSmYuAQ8mWVXRbxmEj-5p927zOh0IavgxAx0HucWtv8nAAxPzLuDSstb9rpkhPvM1U70Jkw6d5nQsJwIt1e1KwAF-ArU27iPMsRWboPOpWshLXkliR42lgF3Mt3LLb2CvPUcvuLhgFYm02usTFwFSoRgI";

  return (
    <View className="px-4 py-3 flex-row items-center justify-between border-b border-muted bg-background">
      <View className="flex-row items-center gap-3">
        <View className="bg-primary rounded-lg p-1.5 items-center justify-center">
          <MaterialIcons name="graphic-eq" size={20} color="white" />
        </View>
        <Text className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Alghurobaa
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity className="relative p-2 rounded-full">
          <MaterialIcons name="notifications" size={24} color="gray" />
          <View className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background-light dark:border-background-dark" />
        </TouchableOpacity>
        <Image
          source={{ uri: userAvatar }}
          className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700"
        />
      </View>
    </View>
  );
}
