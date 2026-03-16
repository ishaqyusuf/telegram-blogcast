import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

import { _router } from "@/components/static-router";
import { Icon } from "@/components/ui/icon";

type Props = {
  className?: string;
};

export function BlogViewFooter({ className = "" }: Props) {
  return (
    <View
      className={`absolute bottom-0 left-0 w-full border-t border-border bg-background pb-6 pt-2 z-50 ${className}`}
    >
      <View className="relative h-14 flex-row items-end justify-around px-2">
        <Pressable
          className="w-16 flex-col items-center gap-1 p-2"
          onPress={() => _router.push("/home")}
        >
          <Icon name="Home" className="text-accent" />
          <Text className="text-[10px] font-bold text-accent">Home</Text>
        </Pressable>

        <Pressable className="w-16 flex-col items-center gap-1 p-2">
          <Icon name="Search" className="text-muted-foreground" />
          <Text className="text-[10px] font-medium text-muted-foreground">
            Search
          </Text>
        </Pressable>

        <View className="w-16" />
        <View className="absolute -top-7 left-1/2 -ml-8">
          <Pressable
            className="h-16 w-16 items-center justify-center rounded-full border-[6px] border-background bg-accent shadow-lg"
            onPress={() => _router.push("/blog-form")}
          >
            <Icon name="Plus" className="size-lg text-accent-foreground" />
          </Pressable>
        </View>

        <Pressable className="w-16 flex-col items-center gap-1 p-2">
          <Icon name="History" className="text-muted-foreground" />
          <Text className="text-[10px] font-medium text-muted-foreground">
            History
          </Text>
        </Pressable>

        <Pressable className="w-16 flex-col items-center gap-1 p-2">
          <Icon name="User" className="text-muted-foreground" />
          <Text className="text-[10px] font-medium text-muted-foreground">
            Profile
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
