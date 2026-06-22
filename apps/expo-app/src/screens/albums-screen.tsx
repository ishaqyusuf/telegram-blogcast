import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useColors } from "@/hooks/use-color";

const ALBUM_COLORS = [
  "#1e40af",
  "#0f766e",
  "#b45309",
  "#4f46e5",
  "#be123c",
  "#0369a1",
];

function getInitials(name?: string | null) {
  if (!name) return "AL";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function AlbumGridSkeleton() {
  return (
    <View className="flex-1 px-3 pb-8">
      <View className="flex-row gap-3 mb-3">
        <AlbumTileSkeleton />
        <AlbumTileSkeleton />
      </View>
      <View className="flex-row gap-3 mb-3">
        <AlbumTileSkeleton />
        <AlbumTileSkeleton />
      </View>
      <View className="flex-row gap-3">
        <AlbumTileSkeleton />
        <AlbumTileSkeleton />
      </View>
    </View>
  );
}

function AlbumTileSkeleton() {
  return (
    <View className="flex-1">
      <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: 1 }} />
      <Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
      <Skeleton className="mt-1.5 h-3 w-2/5 rounded-md" />
    </View>
  );
}

export default function AlbumsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useColors();
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState("");
  const { data: albums = [], isLoading } = useQuery(
    _trpc.album.getAlbums.queryOptions(),
  );
  const createAlbum = useMutation(
    _trpc.album.createAlbum.mutationOptions({
      onSuccess: (album) => {
        queryClient.invalidateQueries(_trpc.album.getAlbums.queryOptions());
        setName("");
        setCreateVisible(false);
        router.push(`/albums/${album.id}` as any);
      },
    }),
  );

  function handleCreateAlbum() {
    const trimmed = name.trim();
    if (!trimmed || createAlbum.isPending) return;
    createAlbum.mutate({ name: trimmed });
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 rounded-full bg-card items-center justify-center active:opacity-70"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text className="text-lg font-bold text-foreground flex-1">
            Albums
          </Text>
          <Pressable
            onPress={() => setCreateVisible(true)}
            className="size-9 rounded-full bg-primary items-center justify-center active:opacity-80"
          >
            <Icon name="Plus" size={18} className="text-primary-foreground" />
          </Pressable>
        </View>

        {isLoading ? (
          <AlbumGridSkeleton />
        ) : albums.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3">
            <Icon name="Music2" size={48} className="text-muted-foreground" />
            <Text className="text-muted-foreground">No albums yet</Text>
          </View>
        ) : (
          <FlatList
            style={{ backgroundColor: colors.background }}
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

      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <Pressable
          onPress={() => setCreateVisible(false)}
          className="flex-1 justify-center bg-black/60 px-5"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-2xl bg-card p-4"
          >
            <Text className="mb-3 text-base font-bold text-foreground">
              Create album
            </Text>
            <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-border bg-muted px-3">
              <Icon name="Disc3" size={16} className="text-muted-foreground" />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="New album name..."
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateAlbum}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 14,
                  paddingVertical: 12,
                }}
              />
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setCreateVisible(false)}
                className="h-11 flex-1 items-center justify-center rounded-xl bg-muted active:opacity-80"
              >
                <Text className="text-sm font-semibold text-foreground">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCreateAlbum}
                disabled={!name.trim() || createAlbum.isPending}
                className="h-11 flex-1 items-center justify-center rounded-xl bg-primary active:opacity-80 disabled:opacity-50"
              >
                {createAlbum.isPending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Text className="text-sm font-bold text-primary-foreground">
                    Create
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
