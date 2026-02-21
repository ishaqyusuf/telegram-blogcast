import { Pressable, Text, View } from "react-native";
import { Icon } from "./ui/icon";
import { _router } from "./static-router";

export const HomeBottomNav = () => (
  <View className="absolute bottom-0 w-full bg-background/95 border-t border-border pb-6 pt-2">
    <View className="flex-row justify-around items-center h-16">
      <Pressable className="items-center gap-1 w-16">
        <Icon name="Home" className=" text-accent" />
        <Text className="text-[10px] font-medium text-accent">Home</Text>
      </Pressable>

      <Pressable className="items-center gap-1 w-16">
        <Icon name="Compass" className=" text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          Explore
        </Text>
      </Pressable>

      <View className="relative -top-6">
        <Pressable
          onPress={(e) => {
            _router.push("/blog-form");
          }}
          className="size-14 rounded-full bg-accent items-center justify-center shadow-lg active:opacity-90"
        >
          <Icon name="PenLine" className=" text-accent-foreground" />
        </Pressable>
      </View>

      <Pressable className="items-center gap-1 w-16">
        <Icon name="Bookmark" className=" text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          Saved
        </Text>
      </Pressable>

      <Pressable className="items-center gap-1 w-16">
        <Icon name="User" className=" text-muted-foreground" />
        <Text className="text-[10px] font-medium text-muted-foreground">
          Profile
        </Text>
      </Pressable>
    </View>
  </View>
);
