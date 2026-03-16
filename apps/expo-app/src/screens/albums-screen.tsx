import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";

const ALBUM_COLORS = ["#4c1d95", "#7c2d12", "#14532d", "#1e3a5f", "#3b0764", "#064e3b"];

function getInitials(name?: string | null) {
  if (!name) return "AL";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AlbumsScreen() {
  const router = useRouter();
  const { data: albums = [], isLoading } = useQuery(
    _trpc.album.getAlbums.queryOptions()
  );

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 rounded-full bg-card items-center justify-center active:opacity-70"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text className="text-lg font-bold text-foreground flex-1">Albums</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground">Loading albums…</Text>
          </View>
        ) : albums.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3">
            <Icon name="Music2" size={48} className="text-muted-foreground" />
            <Text className="text-muted-foreground">No albums yet</Text>
          </View>
        ) : (
          <FlatList
            data={albums}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            contentContainerClassName="px-3 pb-8"
            columnWrapperClassName="gap-3 mb-3"
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => router.push(`/albums/${item.id}` as any)}
                className="flex-1 active:opacity-80"
              >
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                    backgroundColor: ALBUM_COLORS[index % ALBUM_COLORS.length],
                  }}
                >
                  <Text className="text-4xl font-bold text-white">
                    {getInitials(item.name)}
                  </Text>
                </View>
                <Text
                  className="text-sm font-bold text-foreground"
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {item._count.medias} tracks
                </Text>
              </Pressable>
            )}
          />
        )}
      </SafeArea>
    </View>
  );
}
