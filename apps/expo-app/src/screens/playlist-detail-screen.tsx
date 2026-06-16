import { Pressable } from "@/components/ui/pressable";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { minuteToString } from "@/lib/utils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const id = Number(playlistId);

  const { data: playlist, isLoading } = useQuery(
    _trpc.playlist.getPlaylist.queryOptions({ id }),
  );

  const removeEpisode = useMutation(
    _trpc.playlist.removeMediaFromPlaylist.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(_trpc.playlist.getPlaylist.queryOptions({ id }));
        queryClient.invalidateQueries(_trpc.playlist.getPlaylists.queryOptions());
      },
      onError: (error) => Alert.alert("Error", error.message),
    }),
  );

  const reorderEpisodes = useMutation(
    _trpc.playlist.reorderEpisodes.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(_trpc.playlist.getPlaylist.queryOptions({ id }));
      },
      onError: (error) => Alert.alert("Error", error.message),
    }),
  );

  const episodes = playlist?.episodes ?? [];

  function handleMove(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= episodes.length || reorderEpisodes.isPending) return;
    const next = [...episodes];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    const episodeIds = next
      .map((episode) => episode.episode?.id)
      .filter((episodeId): episodeId is number => typeof episodeId === "number");
    if (episodeIds.length !== next.length) return;
    reorderEpisodes.mutate({ playlistId: id, episodeIds });
  }

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card active:opacity-70"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-foreground" numberOfLines={1}>
            {playlist?.name ?? "Playlist"}
          </Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : !playlist ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground">Playlist not found</Text>
          </View>
        ) : episodes.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3">
            <Icon name="ListMusic" size={48} className="text-muted-foreground" />
            <Text className="text-muted-foreground">No tracks yet</Text>
          </View>
        ) : (
          <FlatList
            data={episodes}
            keyExtractor={(item) => String(item.id)}
            contentContainerClassName="px-4 pb-8"
            renderItem={({ item, index }) => {
              const media = item.episode;
              const title =
                media?.title ||
                media?.blog?.content?.slice(0, 70) ||
                "Audio";
              return (
                <Pressable
                  onPress={() => media?.blog?.id && router.push(`/blog-view-2/${media.blog.id}` as any)}
                  className="mb-2 flex-row items-center gap-3 rounded-xl bg-card p-3 active:opacity-80"
                >
                  <View className="size-10 items-center justify-center rounded-lg bg-muted">
                    <Text className="text-xs font-bold text-muted-foreground">
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-foreground" numberOfLines={2}>
                      {title}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {media?.file?.duration ? minuteToString(media.file.duration) : "Audio"}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Pressable
                      onPress={() => handleMove(index, -1)}
                      disabled={index === 0 || reorderEpisodes.isPending}
                      className="size-8 items-center justify-center rounded-full bg-muted active:opacity-70 disabled:opacity-40"
                    >
                      <Icon name="ChevronUp" size={14} className="text-muted-foreground" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleMove(index, 1)}
                      disabled={index === episodes.length - 1 || reorderEpisodes.isPending}
                      className="size-8 items-center justify-center rounded-full bg-muted active:opacity-70 disabled:opacity-40"
                    >
                      <Icon name="ChevronDown" size={14} className="text-muted-foreground" />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => media?.id && removeEpisode.mutate({ playlistId: id, episodeId: media.id })}
                    disabled={!media?.id || removeEpisode.isPending}
                    className="size-9 items-center justify-center rounded-full bg-muted active:opacity-70"
                  >
                    <Icon name="X" size={15} className="text-muted-foreground" />
                  </Pressable>
                </Pressable>
              );
            }}
          />
        )}
      </SafeArea>
    </View>
  );
}
