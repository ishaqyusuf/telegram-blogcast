import { Pressable } from "@/components/ui/pressable";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  mediaIds: number[];
  onClose: () => void;
};

export function AddToPlaylistModal({ visible, mediaIds, onClose }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const { data: playlists = [], isLoading } = useQuery({
    ..._trpc.playlist.getPlaylists.queryOptions(),
    enabled: visible,
  });

  const addMedia = useMutation(
    _trpc.playlist.addMediaToPlaylist.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          _trpc.playlist.getPlaylists.queryOptions(),
        );
        onClose();
      },
    }),
  );

  const createPlaylist = useMutation(
    _trpc.playlist.createPlaylist.mutationOptions({
      onSuccess: (playlist) => {
        setNewPlaylistName("");
        queryClient.invalidateQueries(
          _trpc.playlist.getPlaylists.queryOptions(),
        );
        addMedia.mutate({ playlistId: playlist.id, mediaIds });
      },
    }),
  );

  const isBusy = addMedia.isPending || createPlaylist.isPending;
  const hasMedia = mediaIds.length > 0;

  function handleCreate() {
    const name = newPlaylistName.trim();
    if (!name || isBusy || !hasMedia) return;
    createPlaylist.mutate({ name });
  }

  function handleSelect(playlistId: number) {
    if (isBusy || !hasMedia) return;
    addMedia.mutate({ playlistId, mediaIds });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          className="max-h-[75%] rounded-t-3xl bg-card px-4 pb-8 pt-4"
          style={{ backgroundColor: colors.card }}
        >
          <View
            className="mb-4 h-1 w-10 self-center rounded-full bg-muted"
            style={{ backgroundColor: colors.muted }}
          />
          <Text
            className="mb-4 text-base font-bold text-foreground"
            style={{ color: colors.foreground }}
          >
            Add to Playlist
          </Text>

          <View className="mb-5 flex-row gap-2">
            <View
              className="h-10 flex-1 flex-row items-center gap-2 rounded-xl bg-muted px-3"
              style={{ backgroundColor: colors.muted }}
            >
              <Icon name="Plus" size={16} className="text-muted-foreground" />
              <TextInput
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="New playlist name..."
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 14,
                  paddingVertical: 0,
                }}
              />
            </View>
            <Pressable
              onPress={handleCreate}
              disabled={!newPlaylistName.trim() || isBusy || !hasMedia}
              className="h-10 items-center justify-center rounded-xl bg-primary px-4 active:opacity-80 disabled:opacity-50"
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
            className="mb-3 text-xs font-semibold uppercase text-muted-foreground"
            style={{ color: colors.mutedForeground }}
          >
            Existing Playlists
          </Text>

          {!hasMedia ? (
            <Text
              className="mb-3 rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground"
              style={{
                backgroundColor: colors.muted,
                color: colors.mutedForeground,
              }}
            >
              Select at least one audio post first.
            </Text>
          ) : null}

          {isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : playlists.length === 0 ? (
            <Text
              className="py-6 text-center text-sm text-muted-foreground"
              style={{ color: colors.mutedForeground }}
            >
              No playlists yet - create one above.
            </Text>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelect(item.id)}
                  disabled={isBusy || !hasMedia}
                  className="flex-row items-center gap-3 border-b border-border py-3 active:opacity-70 disabled:opacity-50"
                >
                  <View
                    className="size-10 items-center justify-center rounded-lg bg-muted"
                    style={{ backgroundColor: colors.muted }}
                  >
                    <Icon
                      name="ListMusic"
                      size={18}
                      className="text-muted-foreground"
                    />
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
                      {item._count?.episodes ?? 0} tracks
                    </Text>
                  </View>
                  <Icon
                    name="ChevronRight"
                    size={16}
                    className="text-muted-foreground"
                  />
                </Pressable>
              )}
            />
          )}

          <Pressable
            onPress={onClose}
            className="mt-4 h-11 items-center justify-center rounded-xl bg-muted active:opacity-70"
            style={{ backgroundColor: colors.muted }}
          >
            <Text
              className="text-sm font-semibold text-foreground"
              style={{ color: colors.foreground }}
            >
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
