import { formatDate } from "@acme/utils/dayjs";
import { RouterOutputs } from "@api/trpc/routers/_app";
import { useRouter } from "expo-router";
import { Image, I18nManager, Pressable, Text, View } from "react-native";

import { minuteToString } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { ReactionBar } from "@/components/blog-card/reaction-bar";
import { useRecentlyViewedStore } from "@/store/recently-viewed-store";

const isRTL = I18nManager.isRTL;

export type BlogItem = RouterOutputs["blog"]["posts"]["data"][number];

function getInitials(value?: string | null) {
  if (!value) return "AG";
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CardFooter({ post }: { post: BlogItem }) {
  const tags = post.tags?.slice(0, 2) ?? [];
  return (
    <View className="mt-3 pt-3 border-t border-border">
      <ReactionBar blogId={post.id} />
      <View className="flex-row items-center justify-between mt-2">
        <View className="flex-row gap-2">
          {tags.map((tag, idx) => (
            <View key={`${tag}-${idx}`} className="px-2 py-0.5 rounded-md bg-muted">
              <Text className="text-xs font-medium text-muted-foreground">#{tag}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable className="flex-row items-center gap-1 active:opacity-70">
            <Icon name="Heart" size={16} className="text-muted-foreground" />
            <Text className="text-xs font-medium text-muted-foreground">
              {post.likes ?? 0}
            </Text>
          </Pressable>
          <Pressable className="active:opacity-70">
            <Icon name="Bookmark" size={16} className="text-muted-foreground" />
          </Pressable>
          <Pressable className="active:opacity-70">
            <Icon name="Share2" size={16} className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function BlogCard({ post }: { post: BlogItem }) {
  const router = useRouter();
  const markViewed = useRecentlyViewedStore((s) => s.markViewed);

  function handlePress(path: string) {
    markViewed({
      id: post.id,
      title: post.caption || post.audio?.title || "Untitled",
      type: post.type ?? "text",
      date: post.date ?? null,
    });
    router.push(path as any);
  }

  // ── Audio post — Spotify track-row style ──────────────────────────────────
  if (post.type === "audio") {
    const title = post.caption || post.audio?.title || "Alghurobaa";
    return (
      <Pressable
        onPress={() => handlePress(`/blog-view/${post.id}`)}
        className="bg-card rounded-xl p-3 active:opacity-90"
      >
        <View className="flex-row items-center gap-3">
          {/* Album art */}
          <View className="size-14 rounded-md bg-muted items-center justify-center shrink-0">
            <Text className="text-base font-bold text-foreground">
              {getInitials(title)}
            </Text>
          </View>

          {/* Info */}
          <View className="flex-1 gap-0.5">
            <Text
              className="text-sm font-bold text-foreground text-right"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text className="text-xs text-muted-foreground text-right" numberOfLines={1}>
              {formatDate(post.date, "MMM D, YYYY")}
              {post.audio?.duration
                ? ` · ${minuteToString(post.audio.duration)}`
                : ""}
            </Text>
            {/* Tags */}
            <View className="flex-row gap-1.5 mt-1 justify-end">
              {(post.tags?.slice(0, 2) ?? []).map((tag, idx) => (
                <View key={`${tag}-${idx}`} className="px-2 py-0.5 rounded-md bg-muted">
                  <Text className="text-[10px] font-medium text-muted-foreground">
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Play button */}
          <View className="flex-row items-center gap-3 ml-1">
            <Pressable className="flex-row items-center gap-1 active:opacity-70">
              <Icon name="Heart" size={16} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">{post.likes ?? 0}</Text>
            </Pressable>
            <Pressable className="size-10 rounded-full bg-primary items-center justify-center shadow-md active:opacity-90">
              <Icon name="Play" size={18} className="text-primary-foreground ml-0.5" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Video post ─────────────────────────────────────────────────────────────
  if (post.type === "video") {
    return (
      <Pressable
        onPress={() => handlePress(`/blog-view/${post.id}`)}
        className="bg-card rounded-xl overflow-hidden active:opacity-90"
      >
        {/* Cover image */}
        <View className="h-44 relative bg-muted">
          {post.coverImageUrl ? (
            <Image
              source={{ uri: post.coverImageUrl }}
              className="absolute inset-0 w-full h-full"
              resizeMode="cover"
            />
          ) : null}
          {/* Gradient overlay placeholder + play btn */}
          <View className="absolute inset-0 bg-black/40 items-center justify-center">
            <View className="size-12 rounded-full bg-primary/90 items-center justify-center shadow-lg">
              <Icon name="Play" size={22} className="text-primary-foreground ml-1" />
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="p-3">
          <Text
            className="text-base font-bold text-foreground mb-1 text-right"
            numberOfLines={2}
          >
            {post.caption}
          </Text>
          <Text
            className="text-sm text-muted-foreground text-right"
            numberOfLines={2}
          >
            {post.content}
          </Text>
          <CardFooter post={post} />
        </View>
      </Pressable>
    );
  }

  // ── Text post ──────────────────────────────────────────────────────────────
  return (
    <Pressable
      onPress={() => handlePress(`/blog-view/${post.id}`)}
      className="bg-card rounded-xl p-4 active:opacity-90"
    >
      {/* Header row */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-3">
          <View className="size-9 rounded-md bg-muted items-center justify-center">
            <Text className="text-xs font-bold text-foreground">
              {getInitials(post.caption)}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            {formatDate(post.date, "MMM D, YYYY")}
          </Text>
        </View>
        <Pressable className="p-1 rounded-full active:bg-muted">
          <Icon name="MoreHorizontal" size={16} className="text-muted-foreground" />
        </Pressable>
      </View>

      {/* Text content */}
      <Text
        className="text-foreground text-base leading-relaxed text-right"
        numberOfLines={5}
      >
        {post.content}
      </Text>

      <CardFooter post={post} />
    </Pressable>
  );
}
