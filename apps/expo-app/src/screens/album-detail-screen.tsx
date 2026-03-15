import { useQuery } from "@acme/ui/tanstack";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { minuteToString } from "@/lib/utils";

const ALBUM_COLORS = ["#4c1d95", "#7c2d12", "#14532d", "#1e3a5f", "#3b0764", "#064e3b"];

function getInitials(name?: string | null) {
  if (!name) return "AL";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AlbumDetailScreen() {
  const router = useRouter();
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const id = Number(albumId);

  const { data: album, isLoading } = useQuery(
    _trpc.album.getAlbum.queryOptions({ id })
  );

  const bgColor = ALBUM_COLORS[id % ALBUM_COLORS.length];

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        {/* Back button */}
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 rounded-full bg-card items-center justify-center active:opacity-70"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text className="text-lg font-bold text-foreground flex-1" numberOfLines={1}>
            {album?.name ?? "Album"}
          </Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground">Loading…</Text>
          </View>
        ) : !album ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground">Album not found</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View className="items-center px-4 py-6">
              <View
                style={{
                  width: 144,
                  height: 144,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  backgroundColor: bgColor,
                }}
              >
                <Text className="text-5xl font-bold text-white">
                  {getInitials(album.name)}
                </Text>
              </View>
              <Text className="text-xl font-bold text-foreground mb-1 text-center">
                {album.name}
              </Text>
              {album.author && (
                <Text className="text-sm text-muted-foreground mb-1">
                  {album.author.name}
                </Text>
              )}
              <Text className="text-xs text-muted-foreground">
                {album._count?.medias ?? 0} tracks
              </Text>
            </View>

            {/* Tracks */}
            {(album.audios ?? []).length === 0 ? (
              <View className="items-center py-10 gap-2">
                <Icon name="Music2" size={40} className="text-muted-foreground" />
                <Text className="text-muted-foreground text-sm">No tracks yet</Text>
              </View>
            ) : (
              <View className="px-4 pb-10">
                {(album.audios ?? []).map((media: any, idx: number) => (
                  <View
                    key={media.id}
                    className="flex-row items-center gap-3 py-3 border-b border-border"
                  >
                    <Text className="text-sm font-bold text-muted-foreground w-6 text-center">
                      {idx + 1}
                    </Text>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {media.title || "Untitled"}
                      </Text>
                      {media.duration ? (
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          {minuteToString(media.duration)}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable className="p-2 active:opacity-70">
                      <Icon name="MoreHorizontal" size={18} className="text-muted-foreground" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeArea>
    </View>
  );
}
