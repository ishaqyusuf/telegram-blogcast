import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";

const ALBUM_COLORS = ["#1e40af", "#0f766e", "#b45309", "#4f46e5", "#be123c", "#0369a1"];

function getInitials(name?: string | null) {
  if (!name) return "AL";
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function BlogHomeAlbums() {
  const router = useRouter();
  const { data: albums = [] } = useQuery(_trpc.album.getAlbums.queryOptions());

  if (albums.length === 0) return null;

  return (
    <View className="pt-4 pb-2">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-base font-bold text-foreground">Albums</Text>
        <Pressable
          onPress={() => router.push("/albums" as any)}
          className="active:opacity-70"
        >
          <Text className="text-sm font-medium text-primary">See all</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
      >
        {albums.slice(0, 8).map((album, idx) => (
          <Pressable
            key={album.id}
            onPress={() => router.push(`/albums/${album.id}` as any)}
            className="w-[100px] active:opacity-80"
          >
            <View
              style={{
                width: "100%",
                height: 96,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
                backgroundColor: ALBUM_COLORS[idx % ALBUM_COLORS.length],
              }}
            >
              <Text className="text-2xl font-bold text-white">
                {getInitials(album.name)}
              </Text>
            </View>
            <Text className="text-xs font-bold text-foreground" numberOfLines={2}>
              {album.name}
            </Text>
            <Text className="text-[10px] text-muted-foreground mt-0.5">
              {album._count.medias} tracks
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
