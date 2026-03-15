import { useMutation, useQuery, useQueryClient } from "@acme/ui/tanstack";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

import { _trpc } from "@/components/static-trpc";
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

interface Props {
  mediaIds: number[];
  authorId?: number;
  onClose: () => void;
}

export function AddToAlbumModal({ mediaIds, authorId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [newAlbumName, setNewAlbumName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: albums = [], isLoading } = useQuery(
    _trpc.album.getAlbums.queryOptions()
  );

  const addMedia = useMutation(
    _trpc.album.addMediaToAlbum.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(_trpc.album.getAlbums.queryOptions());
        onClose();
      },
    })
  );

  const createAlbum = useMutation(
    _trpc.album.createAlbum.mutationOptions({
      onSuccess: (newAlbum) => {
        addMedia.mutate({ albumId: newAlbum.id, mediaIds });
      },
    })
  );

  function handleSelectAlbum(albumId: number) {
    addMedia.mutate({ albumId, mediaIds });
  }

  function handleCreate() {
    const name = newAlbumName.trim();
    if (!name) return;
    createAlbum.mutate({ name, authorId });
  }

  const isBusy = addMedia.isPending || createAlbum.isPending;

  return (
    <View className="flex-1 bg-card rounded-t-3xl px-4 pt-4 pb-8">
      {/* Handle */}
      <View className="w-10 h-1 rounded-full bg-muted self-center mb-4" />

      <Text className="text-base font-bold text-foreground mb-4">Add to Album</Text>

      {/* Create new album */}
      <View className="flex-row gap-2 mb-5">
        <View className="flex-1 flex-row items-center bg-muted rounded-xl px-3 h-10 gap-2">
          <Icon name="Plus" size={16} className="text-muted-foreground" />
          <TextInput
            className="flex-1 text-sm text-foreground"
            placeholder="New album name…"
            placeholderTextColor="#b3b3b3"
            value={newAlbumName}
            onChangeText={setNewAlbumName}
            style={{ paddingVertical: 0 }}
          />
        </View>
        <Pressable
          onPress={handleCreate}
          disabled={!newAlbumName.trim() || isBusy}
          className="px-4 h-10 rounded-xl bg-primary items-center justify-center active:opacity-80"
          style={{ opacity: !newAlbumName.trim() || isBusy ? 0.5 : 1 }}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-xs font-bold text-primary-foreground">Create</Text>
          )}
        </Pressable>
      </View>

      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Existing Albums
      </Text>

      {isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator />
        </View>
      ) : albums.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-6">
          No albums yet — create one above
        </Text>
      ) : (
        <FlatList
          data={albums}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => handleSelectAlbum(item.id)}
              disabled={isBusy}
              className="flex-row items-center gap-3 py-3 border-b border-border active:opacity-70"
            >
              <View
                className="size-10 rounded-lg items-center justify-center shrink-0"
                style={{
                  backgroundColor: ALBUM_COLORS[index % ALBUM_COLORS.length],
                }}
              >
                <Text className="text-sm font-bold text-white">
                  {getInitials(item.name)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {item.name}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {item._count.medias} tracks
                </Text>
              </View>
              <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
            </Pressable>
          )}
        />
      )}

      {/* Cancel */}
      <Pressable
        onPress={onClose}
        className="mt-4 h-11 rounded-xl bg-muted items-center justify-center active:opacity-70"
      >
        <Text className="text-sm font-semibold text-foreground">Cancel</Text>
      </Pressable>
    </View>
  );
}
