import { useQuery } from "@acme/ui/tanstack";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";

const CHANNEL_COLORS = [
  "#4c1d95",
  "#7c2d12",
  "#14532d",
  "#1e3a5f",
  "#3b0764",
  "#7f1d1d",
  "#064e3b",
  "#1e40af",
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

export function BlogHomeChannels() {
  const router = useRouter();
  const { data: channels = [] } = useQuery(
    _trpc.channel.getChannels.queryOptions()
  );

  if (channels.length === 0) return null;

  return (
    <View className="pt-4 pb-2">
      {/* Section header */}
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-base font-bold text-foreground">Channels</Text>
        <Pressable onPress={() => router.push("/channels" as any)} className="active:opacity-70">
          <Text className="text-sm font-medium text-primary">See all</Text>
        </Pressable>
      </View>

      {/* Horizontal channel cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
      >
        {channels.slice(0, 8).map((ch, idx) => (
          <Pressable
            key={ch.id}
            onPress={() => router.push(`/channels/${ch.id}` as any)}
            className="items-center gap-2 active:opacity-80 w-[72px]"
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: CHANNEL_COLORS[idx % CHANNEL_COLORS.length],
              }}
            >
              <Text className="text-lg font-bold text-white">
                {getInitials(ch.title ?? ch.username)}
              </Text>
            </View>
            <Text
              className="text-xs font-medium text-foreground text-center"
              numberOfLines={2}
            >
              {ch.title ?? ch.username}
            </Text>
            <Text className="text-[10px] text-muted-foreground">
              {ch.stats.totalBlogs} posts
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
