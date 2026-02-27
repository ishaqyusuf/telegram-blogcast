import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";

export default function BlogImageViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string; title?: string }>();

  const uri = typeof params.uri === "string" ? params.uri : "";
  const title = typeof params.title === "string" ? params.title : "Image";

  return (
    <View className="flex-1 bg-black">
      <View className="absolute left-0 right-0 top-0 z-20 flex-row items-center justify-between px-4 pb-3 pt-14">
        <Text className="flex-1 pr-4 text-sm font-semibold text-white" numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="size-10 items-center justify-center rounded-full bg-black/50"
        >
          <Icon name="X" className="text-white" />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center">
        {uri ? (
          <Image
            source={{ uri }}
            className="h-full w-full"
            resizeMode="contain"
          />
        ) : (
          <Text className="text-sm text-zinc-300">Image not available.</Text>
        )}
      </View>
    </View>
  );
}
