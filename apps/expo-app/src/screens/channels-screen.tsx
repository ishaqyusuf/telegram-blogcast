import { useQuery } from "@acme/ui/tanstack";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";

const CHANNEL_COLORS = [
  "#4c1d95", "#7c2d12", "#14532d", "#1e3a5f",
  "#3b0764", "#7f1d1d", "#064e3b", "#1e40af",
];

function getInitials(value?: string | null) {
  if (!value) return "CH";
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ChannelsScreen() {
  const router = useRouter();
  const { data: channels = [], isFetching } = useQuery(
    _trpc.channel.getChannels.queryOptions()
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
            Channels
          </Text>
          <View className="px-2 py-0.5 rounded-full bg-muted">
            <Text className="text-xs font-medium text-muted-foreground">
              {channels.length}
            </Text>
          </View>
        </View>

        <FlatList
          data={channels}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4 pb-8 gap-2"
          renderItem={({ item: ch, index }) => (
            <Pressable
              onPress={() => router.push(`/channels/${ch.id}` as any)}
              className="bg-card rounded-xl overflow-hidden active:opacity-80"
            >
              <View
                className={`flex-row items-center gap-3 p-3 ${
                  ch.isFetchable ? "border-l-2 border-primary" : ""
                }`}
              >
                {/* Avatar */}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
                  }}
                >
                  <Text className="text-base font-bold text-white">
                    {getInitials(ch.title ?? ch.username)}
                  </Text>
                </View>

                {/* Info */}
                <View className="flex-1 gap-0.5">
                  <Text
                    className="text-sm font-bold text-foreground"
                    numberOfLines={1}
                  >
                    {ch.title ?? ch.username}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    @{ch.username}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    <Text className="text-[10px] text-muted-foreground">
                      {ch.stats.totalBlogs} posts · {ch.stats.publishedBlogs} published
                    </Text>
                    {ch.isFetchable && (
                      <View className="px-1.5 py-0.5 rounded-full bg-primary/20">
                        <Text className="text-[9px] font-bold text-primary">
                          LIVE
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Icon name="Radio" size={48} className="text-muted-foreground mb-3" />
              <Text className="text-sm text-muted-foreground">
                {isFetching ? "Loading channels…" : "No channels yet"}
              </Text>
            </View>
          }
        />
      </SafeArea>
    </View>
  );
}
