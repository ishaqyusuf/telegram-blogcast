import { View, Text, Image } from "react-native";
import { Icon } from "../ui/icon";
import { ThemeToggle } from "../theme-toggle";

export function HomeFeedHeader() {
  const userAvatar =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBiyF1rMZCXkWSog4J9UbOA8uZTD6UpwQkaltoHUEaBGP3zsmMpKHi8s86akNJOZJDyoaz7l4PMv9rwcXUVlKCJvKHiuf8NQ_NrqYtfqZt9m-QoeXEpq2DSmYuAQ8mWVXRbxmEj-5p927zOh0IavgxAx0HucWtv8nAAxPzLuDSstb9rpkhPvM1U70Jkw6d5nQsJwIt1e1KwAF-ArU27iPMsRWboPOpWshLXkliR42lgF3Mt3LLb2CvPUcvuLhgFYm02usTFwFSoRgI";

  return (
    <View className="px-4 py-3 flex-row items-center justify-between border-b border-border bg-background">
      <View className="flex-row items-center gap-3">
        <View className="bg-primary rounded-lg p-1.5 items-center justify-center">
          {/* <AudioLines size={20} color="white" /> */}
          <Icon name="AudioLines" className="text-foreground size-20" />
        </View>
        <Text className="text-xl font-bold tracking-tight text-foreground">
          Alghurobaa
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <ThemeToggle />
        {/* <TouchableOpacity className="relative p-2 rounded-full">
          <BellDotIcon size={24} color="red" />
        </TouchableOpacity> */}
        {/* <ArrowDownToDot color={"red"} className="text-foreground" /> */}
        <Image
          source={{ uri: userAvatar }}
          className="w-9 h-9 rounded-full border border-border"
        />
      </View>
    </View>
  );
}
