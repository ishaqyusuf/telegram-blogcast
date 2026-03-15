import { formatDate } from "@acme/utils/dayjs";
import { useQuery } from "@acme/ui/tanstack";
import { useLocalSearchParams, useRouter } from "expo-router";
import { I18nManager, Pressable, Text, View } from "react-native";
import { LegendList } from "@legendapp/list";

import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useInfiniteLoader } from "@/components/infinite-loader";
import { minuteToString } from "@/lib/utils";
import type { BlogItem } from "@/components/blog-card";

const isRTL = I18nManager.isRTL;

// ── Bubble components ────────────────────────────────────────────────────────

function TextBubble({ post }: { post: BlogItem }) {
  return (
    <View className="max-w-[85%] self-end">
      <View className="bg-card rounded-2xl rounded-br-sm px-4 py-3">
        <Text
          className="text-sm text-foreground leading-relaxed text-right"
          style={{ writingDirection: "rtl" }}
        >
          {post.content}
        </Text>
        <Text className="text-[10px] text-muted-foreground text-right mt-1">
          {formatDate(post.date, "hh:mm A")}
        </Text>
      </View>
    </View>
  );
}

function AudioBubble({ post }: { post: BlogItem }) {
  const title = post.caption || post.audio?.title || "Audio";
  return (
    <View className="max-w-[85%] self-end">
      <View className="bg-card rounded-2xl rounded-br-sm p-3">
        {/* Title */}
        <Text className="text-sm font-bold text-foreground text-right mb-2" numberOfLines={2}>
          {title}
        </Text>
        {/* Waveform row */}
        <View className="flex-row items-center gap-3">
          <Pressable className="size-10 rounded-full bg-primary items-center justify-center active:opacity-80 shrink-0">
            <Icon name="Play" size={18} className="text-primary-foreground ml-0.5" />
          </Pressable>
          {/* Static waveform bars */}
          <View className="flex-1 flex-row items-center gap-0.5 h-8">
            {[4, 8, 5, 12, 6, 10, 3, 9, 7, 11, 4, 8, 6, 10, 5].map((h, i) => (
              <View
                key={i}
                className="flex-1 rounded-full bg-muted"
                style={{ height: h * 2 }}
              />
            ))}
          </View>
          <Text className="text-[10px] text-muted-foreground shrink-0">
            {minuteToString(post.audio?.duration)}
          </Text>
        </View>
        <Text className="text-[10px] text-muted-foreground text-right mt-1.5">
          {formatDate(post.date, "hh:mm A")}
        </Text>
      </View>
    </View>
  );
}

function ImageBubble({ post }: { post: BlogItem }) {
  return (
    <View className="max-w-[75%] self-end">
      <View className="bg-muted rounded-2xl rounded-br-sm overflow-hidden">
        <View className="h-40 bg-muted items-center justify-center">
          <Icon name="Image" size={32} className="text-muted-foreground" />
        </View>
        {post.caption && (
          <View className="px-3 py-2">
            <Text className="text-sm text-foreground text-right" numberOfLines={3}>
              {post.caption}
            </Text>
          </View>
        )}
        <Text className="text-[10px] text-muted-foreground text-right px-3 pb-2">
          {formatDate(post.date, "hh:mm A")}
        </Text>
      </View>
    </View>
  );
}

function DateDivider({ date }: { date: string | null | undefined }) {
  if (!date) return null;
  return (
    <View className="items-center py-2">
      <View className="px-3 py-1 rounded-full bg-muted">
        <Text className="text-[10px] font-medium text-muted-foreground">
          {formatDate(date, "MMMM D, YYYY")}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function ChannelChatScreen() {
  const router = useRouter();
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const id = Number(channelId);

  const { data: channel } = useQuery(
    _trpc.channel.getChannel.queryOptions({ id })
  );

  const { data: posts, hasNextPage, isFetching, fetchNextPage } = useInfiniteLoader({
    route: _trpc?.blog.posts,
    input: { channelId: id },
  });

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        {/* Header */}
        <View className="flex-row items-center px-3 py-2 border-b border-border gap-3">
          <Pressable
            onPress={() => router.back()}
            className="size-10 items-center justify-center rounded-full active:bg-muted"
          >
            <Icon name="ArrowLeft" className="text-foreground" />
          </Pressable>

          <View className="size-10 rounded-full bg-primary/20 items-center justify-center">
            <Icon name="Radio" size={18} className="text-primary" />
          </View>

          <View className="flex-1">
            <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
              {channel?.title ?? channel?.username ?? "Channel"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {channel?.stats.totalBlogs ?? "…"} posts
            </Text>
          </View>

          <Pressable className="size-10 items-center justify-center rounded-full active:bg-muted">
            <Icon name="Search" className="text-muted-foreground" />
          </Pressable>
        </View>

        {/* Messages */}
        <LegendList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => {
            const prevPost = index > 0 ? posts[index - 1] : null;
            const showDate =
              !prevPost ||
              formatDate(item.date, "YYYY-MM-DD") !==
                formatDate(prevPost.date, "YYYY-MM-DD");

            return (
              <View className="px-4">
                {showDate && <DateDivider date={item.date} />}
                {item.type === "audio" ? (
                  <AudioBubble post={item} />
                ) : item.type === "image" ? (
                  <ImageBubble post={item} />
                ) : (
                  <TextBubble post={item} />
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListFooterComponent={<View className="h-6" />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Icon name="MessageCircle" size={48} className="text-muted-foreground mb-3" />
              <Text className="text-sm text-muted-foreground">
                {isFetching ? "Loading messages…" : "No messages yet"}
              </Text>
            </View>
          }
          onEndReached={() => {
            if (hasNextPage && !isFetching) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
        />
      </SafeArea>
    </View>
  );
}
