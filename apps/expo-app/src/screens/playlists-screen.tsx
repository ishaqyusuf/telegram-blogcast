import { Pressable } from "@/components/ui/pressable";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  View,
} from "react-native";

export default function PlaylistsScreen() {
  const router = useRouter();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState("");

  const { data: playlists = [], isLoading } = useQuery(
    _trpc.playlist.getPlaylists.queryOptions(),
  );

  const createPlaylist = useMutation(
    _trpc.playlist.createPlaylist.mutationOptions({
      onSuccess: (playlist) => {
        queryClient.invalidateQueries(
          _trpc.playlist.getPlaylists.queryOptions(),
        );
        setName("");
        setCreateVisible(false);
        router.push(`/playlists/${playlist.id}` as any);
      },
    }),
  );

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || createPlaylist.isPending) return;
    createPlaylist.mutate({ name: trimmed });
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card active:opacity-70"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-foreground">
            Playlists
          </Text>
          <Pressable
            onPress={() => setCreateVisible(true)}
            className="size-9 items-center justify-center rounded-full bg-primary active:opacity-80"
          >
            <Icon name="Plus" size={18} className="text-primary-foreground" />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : playlists.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3">
            <Icon
              name="ListMusic"
              size={48}
              className="text-muted-foreground"
            />
            <Text className="text-muted-foreground">No playlists yet</Text>
          </View>
        ) : (
          <FlatList
            style={{ backgroundColor: colors.background }}
            data={playlists}
            keyExtractor={(item) => String(item.id)}
            contentContainerClassName="px-4 pb-8"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/playlists/${item.id}` as any)}
                className="mb-2 flex-row items-center gap-3 rounded-xl bg-card p-3 active:opacity-80"
              >
                <View className="size-12 items-center justify-center rounded-lg bg-muted">
                  <Icon
                    name="ListMusic"
                    size={22}
                    className="text-muted-foreground"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-foreground">
                    {item.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
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
      </SafeArea>

      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <Pressable
          className="flex-1 justify-center bg-black/60 px-5"
          onPress={() => setCreateVisible(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-2xl bg-card p-4"
          >
            <Text className="mb-3 text-base font-bold text-foreground">
              Create playlist
            </Text>
            <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-border bg-muted px-3">
              <Icon
                name="ListMusic"
                size={16}
                className="text-muted-foreground"
              />
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                placeholder="New playlist name..."
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
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
                className="h-11 flex-1 items-center justify-center rounded-xl bg-muted"
              >
                <Text className="text-sm font-semibold text-foreground">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                disabled={!name.trim() || createPlaylist.isPending}
                className="h-11 flex-1 items-center justify-center rounded-xl bg-primary disabled:opacity-50"
              >
                {createPlaylist.isPending ? (
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
