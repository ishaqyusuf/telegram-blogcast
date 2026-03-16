import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { formatDate } from "@acme/utils/dayjs";
import { useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";

import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { minuteToString } from "@/lib/utils";

function formatProgress(progressMs: number, durationSec?: number | null) {
  const posMin = Math.floor(progressMs / 60000);
  const posSec = Math.floor((progressMs % 60000) / 1000);
  const pos = `${String(posMin).padStart(2, "0")}:${String(posSec).padStart(2, "0")}`;
  if (!durationSec) return pos;
  return `${pos} / ${minuteToString(durationSec)}`;
}

export default function PlayHistoryScreen() {
  const router = useRouter();
  const { data: history = [], isFetching } = useQuery(
    _trpc.blog.getRecentlyPlayed.queryOptions({ limit: 50 })
  );

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 gap-3">
          <Pressable
            onPress={() => router.back()}
            className="size-10 items-center justify-center rounded-full active:bg-muted"
          >
            <Icon name="ArrowLeft" className="text-foreground" />
          </Pressable>
          <Text className="text-xl font-bold text-foreground flex-1">
            Recently Played
          </Text>
          <View className="px-2 py-0.5 rounded-full bg-muted">
            <Text className="text-xs font-medium text-muted-foreground">
              {history.length}
            </Text>
          </View>
        </View>

        <FlatList
          data={history}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4 pb-8 gap-2"
          renderItem={({ item }) => {
            const duration = item.Media?.file?.duration;
            const title =
              item.Media?.title ||
              item.Media?.blog?.content?.slice(0, 60) ||
              "Audio";
            const progressPct =
              duration && duration > 0
                ? Math.min((item.progress / 1000 / duration) * 100, 100)
                : 0;

            return (
              <Pressable
                onPress={() =>
                  item.Media?.blog?.id &&
                  router.push(`/blog-view-2/${item.Media.blog.id}` as any)
                }
                className="bg-card rounded-xl p-3 active:opacity-80"
              >
                <View className="flex-row items-center gap-3">
                  {/* Thumbnail */}
                  <View className="size-14 rounded-lg bg-muted items-center justify-center shrink-0">
                    <Icon name="Headphones" size={24} className="text-muted-foreground" />
                  </View>

                  {/* Info */}
                  <View className="flex-1 gap-1">
                    <Text
                      className="text-sm font-bold text-foreground"
                      numberOfLines={2}
                    >
                      {title}
                    </Text>

                    {/* Progress bar */}
                    <View className="h-1 w-full bg-muted rounded-full overflow-hidden">
                      <View
                        style={{ height: "100%", backgroundColor: "#1DB954", borderRadius: 9999, width: `${progressPct}%` }}
                      />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1">
                        <Icon name="Clock" size={10} className="text-muted-foreground" />
                        <Text className="text-[10px] text-muted-foreground">
                          {formatProgress(item.progress, duration)}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-muted-foreground">
                        {formatDate(item.playedAt, "MMM D, hh:mm A")}
                      </Text>
                    </View>
                  </View>

                  {/* Resume play button */}
                  <Pressable className="size-9 rounded-full bg-primary items-center justify-center active:opacity-80 shrink-0">
                    <Icon name="Play" size={16} className="text-primary-foreground ml-0.5" />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Icon name="History" size={48} className="text-muted-foreground mb-3" />
              <Text className="text-sm text-muted-foreground">
                {isFetching ? "Loading history…" : "No recently played"}
              </Text>
            </View>
          }
        />
      </SafeArea>
    </View>
  );
}
