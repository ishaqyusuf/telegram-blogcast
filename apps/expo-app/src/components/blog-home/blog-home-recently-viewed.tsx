import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useRecentlyViewedStore } from "@/store/recently-viewed-store";

const TYPE_ICONS = {
  audio: "Headphones",
  video: "Play",
  text: "FileText",
  image: "Image",
} as const;

export function BlogHomeRecentlyViewed() {
  const router = useRouter();
  const { items } = useRecentlyViewedStore();

  if (items.length === 0) return null;

  return (
    <View className="pt-4 pb-2">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-base font-bold text-foreground">Recently Viewed</Text>
        <Pressable
          onPress={() => useRecentlyViewedStore.getState().clear()}
          className="active:opacity-70"
        >
          <Text className="text-xs text-muted-foreground">Clear</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/blog-view-2/${item.id}` as any)}
            className="active:opacity-80"
            style={{ width: 80 }}
          >
            <View className="w-full h-20 rounded-xl bg-card items-center justify-center mb-2 border border-border">
              <Icon
                name={TYPE_ICONS[item.type as keyof typeof TYPE_ICONS] ?? "FileText"}
                size={24}
                className="text-muted-foreground"
              />
            </View>
            <Text className="text-xs font-medium text-foreground text-center" numberOfLines={2}>
              {item.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
