import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ScrollViewProps,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Toast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-color";

const ALBUM_COLORS = [
  "#1e40af",
  "#0f766e",
  "#b45309",
  "#4f46e5",
  "#be123c",
  "#0369a1",
];
const ADD_TO_ALBUM_KEYBOARD_OFFSET = 112;

function renderKeyboardAwareScrollView(props: ScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      {...props}
      bottomOffset={ADD_TO_ALBUM_KEYBOARD_OFFSET}
      disableScrollOnKeyboardHide
    />
  );
}

function getInitials(name?: string | null) {
  if (!name) return "AL";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizeAlbumFilterText(value?: string | number | null) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670]/g, "")
    .replace(/[\u200c\u200d]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface Props {
  mediaIds: number[];
  authorId?: number;
  onClose: () => void;
  onAdded?: (album: { id: number; name: string }) => void;
}

export function AddToAlbumModal({
  mediaIds,
  authorId,
  onClose,
  onAdded,
}: Props) {
  const queryClient = useQueryClient();
  const colors = useColors();
  const { height: windowHeight } = useWindowDimensions();
  const [newAlbumName, setNewAlbumName] = useState("");
  const selectedAlbumRef = useRef<{ id: number; name: string } | null>(null);
  const singleMediaId = mediaIds.length === 1 ? (mediaIds[0] ?? null) : null;

  const { data: albums = [], isLoading } = useQuery(
    _trpc.album.getAlbums.queryOptions(),
  );
  const {
    data: recommendedAlbum,
    isLoading: isRecommendationLoading,
  } = useQuery({
    ..._trpc.album.getRelatedAlbumForMedia.queryOptions({
      mediaId: singleMediaId ?? 0,
    }),
    enabled: singleMediaId !== null,
  });
  const sortedAlbums = useMemo(
    () =>
      [...albums].sort((a, b) => {
        const aChannel = a.channel?.title ?? a.channel?.username ?? "";
        const bChannel = b.channel?.title ?? b.channel?.username ?? "";
        const channelCompare = aChannel.localeCompare(bChannel);
        if (channelCompare !== 0) return channelCompare;
        return a.name.localeCompare(b.name);
      }),
    [albums],
  );
  const albumFilterTerms = useMemo(
    () =>
      normalizeAlbumFilterText(newAlbumName)
        .split(" ")
        .filter(Boolean),
    [newAlbumName],
  );
  const filteredAlbums = useMemo(() => {
    const otherAlbums = recommendedAlbum
      ? sortedAlbums.filter((album) => album.id !== recommendedAlbum.id)
      : sortedAlbums;
    if (albumFilterTerms.length === 0) return otherAlbums;
    return otherAlbums.filter((album) => {
      const searchText = normalizeAlbumFilterText(
        [
          album.name,
          album.author?.name,
          album.author?.nameAr,
          album.channel?.title,
          album.channel?.username,
        ].join(" "),
      );
      return albumFilterTerms.every((term) => searchText.includes(term));
    });
  }, [albumFilterTerms, recommendedAlbum, sortedAlbums]);

  const addMedia = useMutation(
    _trpc.album.addMediaToAlbum.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(_trpc.album.getAlbums.queryOptions());
        if (singleMediaId !== null) {
          queryClient.setQueryData(
            _trpc.album.getRelatedAlbumForMedia.queryKey({
              mediaId: singleMediaId,
            }),
            null,
          );
        }
        if (selectedAlbumRef.current) {
          onAdded?.(selectedAlbumRef.current);
          Toast.show(`Added to ${selectedAlbumRef.current.name}`, {
            type: "success",
            position: "bottom",
          });
        }
        onClose();
      },
    }),
  );

  const createAlbum = useMutation(
    _trpc.album.createAlbum.mutationOptions({
      onSuccess: (newAlbum) => {
        selectedAlbumRef.current = { id: newAlbum.id, name: newAlbum.name };
        addMedia.mutate({ albumId: newAlbum.id, mediaIds });
      },
    }),
  );

  function handleSelectAlbum(album: { id: number; name: string }) {
    selectedAlbumRef.current = { id: album.id, name: album.name };
    addMedia.mutate({ albumId: album.id, mediaIds });
  }

  function handleCreate() {
    const name = newAlbumName.trim();
    if (!name) return;
    createAlbum.mutate({ name, authorId });
  }

  const isBusy = addMedia.isPending || createAlbum.isPending;

  return (
    <View
      className="bg-card rounded-t-3xl"
      style={{
        backgroundColor: colors.card,
        maxHeight: Math.min(Math.max(360, windowHeight * 0.72), windowHeight - 24),
        overflow: "hidden",
        width: "100%",
      }}
    >
      <FlatList
        data={isLoading ? [] : filteredAlbums}
        keyExtractor={(item) => String(item.id)}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        renderScrollComponent={renderKeyboardAwareScrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 24,
          paddingHorizontal: 16,
          paddingTop: 16,
        }}
        ListHeaderComponent={
          <>
            {/* Handle */}
        <View
          className="w-10 h-1 rounded-full bg-muted self-center mb-4"
          style={{ backgroundColor: colors.muted }}
        />

        <Text
          className="text-base font-bold text-foreground mb-4"
          style={{ color: colors.foreground }}
        >
          Add to album
        </Text>

        {singleMediaId !== null &&
        (isRecommendationLoading || recommendedAlbum) ? (
          <View className="mb-5">
            <View className="mb-3 flex-row items-center gap-2">
              <Icon name="Sparkles" size={15} className="text-primary" />
              <Text
                className="text-xs font-semibold uppercase tracking-wider text-primary"
              >
                Recommended album
              </Text>
            </View>

            {isRecommendationLoading ? (
              <View
                className="h-20 flex-row items-center justify-center gap-3 rounded-2xl border border-border bg-muted"
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  className="text-sm font-medium text-muted-foreground"
                >
                  Finding the best match…
                </Text>
              </View>
            ) : recommendedAlbum ? (
              <View
                className="rounded-2xl border border-primary/30 bg-muted p-3"
              >
                <View className="flex-row items-center gap-3">
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      backgroundColor:
                        ALBUM_COLORS[recommendedAlbum.id % ALBUM_COLORS.length],
                    }}
                  >
                    <Text className="text-sm font-bold text-white">
                      {getInitials(recommendedAlbum.name)}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-sm font-bold text-foreground"
                    >
                      {recommendedAlbum.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      {recommendedAlbum._count.medias} tracks
                      {recommendedAlbum.channel?.title
                        ? ` · ${recommendedAlbum.channel.title}`
                        : ""}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row gap-2">
                  <Pressable
                    accessibilityLabel="Cancel adding to recommended album"
                    onPress={onClose}
                    disabled={isBusy}
                    className="h-10 flex-1 items-center justify-center rounded-xl bg-background active:opacity-70"
                  >
                    <Text className="text-xs font-semibold text-foreground">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Add to recommended album ${recommendedAlbum.name}`}
                    onPress={() => handleSelectAlbum(recommendedAlbum)}
                    disabled={isBusy}
                    className={`h-10 flex-[2] flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80 ${isBusy ? "opacity-50" : "opacity-100"}`}
                  >
                    {addMedia.isPending &&
                    selectedAlbumRef.current?.id === recommendedAlbum.id ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primaryForeground}
                      />
                    ) : (
                      <Icon
                        name="Plus"
                        size={16}
                        className="text-primary-foreground"
                      />
                    )}
                    <Text className="text-xs font-bold text-primary-foreground">
                      Yes, add here
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Create new album */}
        <View className="flex-row gap-2 mb-5">
          <View
            className="flex-1 flex-row items-center bg-muted rounded-xl px-3 h-10 gap-2"
            style={{ backgroundColor: colors.muted }}
          >
            <Icon name="Plus" size={16} className="text-muted-foreground" />
            <TextInput
              placeholder="New album name..."
              placeholderTextColor={colors.mutedForeground}
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
              style={{
                flex: 1,
                fontSize: 14,
                color: colors.foreground,
                paddingVertical: 0,
              }}
            />
          </View>
          <Pressable
            onPress={handleCreate}
            disabled={!newAlbumName.trim() || isBusy}
            className={`px-4 h-10 rounded-xl bg-primary items-center justify-center active:opacity-80 ${!newAlbumName.trim() || isBusy ? "opacity-50" : "opacity-100"}`}
          >
            {isBusy ? (
              <ActivityIndicator
                size="small"
                color={colors.primaryForeground}
              />
            ) : (
              <Text className="text-xs font-bold text-primary-foreground">
                Create
              </Text>
            )}
          </Pressable>
        </View>

        <Text
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3"
          style={{ color: colors.mutedForeground }}
        >
          {recommendedAlbum ? "Choose another album" : "Existing Albums"}
        </Text>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <Text
              className="text-sm text-muted-foreground text-center py-6"
              style={{ color: colors.mutedForeground }}
            >
              {albumFilterTerms.length > 0
                ? "No existing albums match"
                : "No albums yet — create one above"}
            </Text>
          )
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => handleSelectAlbum(item)}
            disabled={isBusy}
            className="flex-row items-center gap-3 py-3 border-b border-border active:opacity-70"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                backgroundColor: ALBUM_COLORS[index % ALBUM_COLORS.length],
              }}
            >
              <Text className="text-sm font-bold text-white">
                {getInitials(item.name)}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className="text-sm font-semibold text-foreground"
                style={{ color: colors.foreground }}
              >
                {item.name}
              </Text>
              <Text
                className="text-xs text-muted-foreground"
                style={{ color: colors.mutedForeground }}
              >
                {item._count.medias} tracks
                {item.channel?.title ? ` · ${item.channel.title}` : ""}
              </Text>
            </View>
            <Icon
              name="ChevronRight"
              size={16}
              className="text-muted-foreground"
            />
          </Pressable>
        )}
        ListFooterComponent={
          <View className="mt-4 rounded-2xl bg-background/60 p-1">
            <Pressable
              onPress={onClose}
              className="h-11 rounded-xl bg-muted items-center justify-center active:opacity-70"
              style={{ backgroundColor: colors.muted }}
            >
              <Text
                className="text-sm font-semibold text-foreground"
                style={{ color: colors.foreground }}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}
