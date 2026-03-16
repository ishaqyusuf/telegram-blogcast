import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { minuteToString } from "@/lib/utils";

function formatProgress(progressMs: number, durationSec?: number | null) {
  const posMin = Math.floor(progressMs / 60000);
  const posSec = Math.floor((progressMs % 60000) / 1000);
  const pos = `${String(posMin).padStart(2, "0")}:${String(posSec).padStart(2, "0")}`;
  if (!durationSec) return pos;
  const dur = minuteToString(durationSec);
  return `${pos} / ${dur}`;
}

export function BlogHomeRecentlyPlayed() {
  const router = useRouter();
  const { data: history = [] } = useQuery(
    _trpc.blog.getRecentlyPlayed.queryOptions({ limit: 10 })
  );

  if (history.length === 0) return null;

  return (
    <View className="pt-4 pb-2">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-base font-bold text-foreground">Recently Played</Text>
        <Pressable
          onPress={() => router.push("/play-history" as any)}
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
        {history.map((item) => {
          const duration = item.Media?.file?.duration;
          const title = item.Media?.title || item.Media?.blog?.content?.slice(0, 40) || "Audio";
          const progressPct =
            duration && duration > 0
              ? Math.min((item.progress / 1000 / duration) * 100, 100)
              : 0;

          return (
            <Pressable
              key={item.id}
              onPress={() =>
                item.Media?.blog?.id &&
                router.push(`/blog-view-2/${item.Media.blog.id}` as any)
              }
              className="w-[130px] active:opacity-80"
            >
              {/* Thumbnail */}
              <View className="w-full h-24 rounded-xl bg-muted items-center justify-center mb-2 relative overflow-hidden">
                <Icon name="Headphones" size={32} className="text-muted-foreground" />
                {/* Progress bar at bottom */}
                <View className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                  <View
                    style={{ height: "100%", backgroundColor: "#1DB954", width: `${progressPct}%` }}
                  />
                </View>
              </View>
              <Text className="text-xs font-bold text-foreground" numberOfLines={2}>
                {title}
              </Text>
              <View className="flex-row items-center gap-1 mt-0.5">
                <Icon name="Clock" size={10} className="text-muted-foreground" />
                <Text className="text-[10px] text-muted-foreground">
                  {formatProgress(item.progress, duration)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
