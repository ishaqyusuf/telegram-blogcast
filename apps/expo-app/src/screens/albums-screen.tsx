import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCallback, useMemo, useState } from "react";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useColors } from "@/hooks/use-color";
import { useScrollChrome } from "@/hooks/use-scroll-chrome";
import { getMediaFileUrl } from "@/lib/media-source";
import { Image } from "expo-image";
import { KeyboardStickyView } from "react-native-keyboard-controller";

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

function getAlbumArtUrl(album: { thumbnail?: { file?: unknown } | null }) {
  return getMediaFileUrl(album.thumbnail?.file as any);
}

function AlbumGridSkeleton() {
  return (
    <View className="flex-1 px-3 pb-28">
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
  const [search, setSearch] = useState("");
  const albumScroll = useScrollChrome<FlatList<any>>();
  const {
    data: albums = [],
    isFetching,
    isLoading,
    refetch,
  } = useQuery(
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

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const filteredAlbums = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...albums].sort((a, b) => {
      const aText = `${a.name ?? ""} ${a.channel?.title ?? ""} ${a.channel?.username ?? ""}`.toLowerCase();
      const bText = `${b.name ?? ""} ${b.channel?.title ?? ""} ${b.channel?.username ?? ""}`.toLowerCase();
      if (!q) {
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      }
      const aStarts = aText.startsWith(q) ? 0 : 1;
      const bStarts = bText.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    });
    if (!q) return sorted;
    return sorted.filter((album) =>
      `${album.name ?? ""} ${album.channel?.title ?? ""} ${album.channel?.username ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [albums, search]);

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
        ) : filteredAlbums.length === 0 ? (
          <View
            className="flex-1 items-center justify-center gap-3"
            style={{ paddingBottom: 104 }}
          >
            <Icon
              name={search.trim() ? "SearchX" : "Music2"}
              size={48}
              className="text-muted-foreground"
            />
            <Text className="text-muted-foreground">
              {search.trim() ? "No matching albums" : "No albums yet"}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={albumScroll.ref}
            style={{ backgroundColor: colors.background }}
            data={filteredAlbums}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            contentContainerClassName="px-3"
            contentContainerStyle={{ paddingBottom: 104 }}
            columnWrapperClassName="gap-3 mb-3"
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            onScroll={albumScroll.onScroll}
            scrollEventThrottle={albumScroll.scrollEventThrottle}
            renderItem={({ item, index }) => {
              const albumArtUrl = getAlbumArtUrl(item);

              return (
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
                      overflow: "hidden",
                      backgroundColor: ALBUM_COLORS[index % ALBUM_COLORS.length],
                    }}
                  >
                    {albumArtUrl ? (
                      <Image
                        source={{ uri: albumArtUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <Text className="text-4xl font-bold text-white">
                        {getInitials(item.name)}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="text-sm font-bold text-foreground"
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {item._count.medias} tracks
                    {item.channel?.title ? ` · ${item.channel.title}` : ""}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
        <KeyboardStickyView
          offset={{ closed: 0, opened: 0 }}
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
          }}
        >
          <View className="bg-background px-4 pb-5 pt-2">
            <View className="h-12 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3">
              <Icon name="Search" size={16} className="text-muted-foreground" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search albums..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                returnKeyType="search"
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 14,
                  paddingVertical: 0,
                }}
              />
              {search.length > 0 && (
                <Pressable
                  accessibilityLabel="Clear album search"
                  onPress={() => setSearch("")}
                  hitSlop={8}
                >
                  <Icon name="X" size={15} className="text-muted-foreground" />
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardStickyView>
      </SafeArea>
      <ScrollToTopButton
        visible={albumScroll.showScrollTop}
        onPress={albumScroll.scrollToTop}
        bottom={104}
      />

      <FloatingBottomSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        accessibilityLabel="Create album"
        title="Create album"
      >
        <View className="bg-card px-4 pb-8" style={{ backgroundColor: colors.card }}>
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
          <View className="flex-row gap-2 rounded-2xl bg-background/60 p-1">
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
        </View>
      </FloatingBottomSheet>
    </View>
  );
}
