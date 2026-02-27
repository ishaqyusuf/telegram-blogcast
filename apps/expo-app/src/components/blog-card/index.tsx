import { formatDate } from "@acme/utils/dayjs";
import { RouterOutputs } from "@api/trpc/routers/_app";
import { useRouter } from "expo-router";
import { Image, I18nManager, Pressable, Text, View } from "react-native";

import { minuteToString } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

const isRTL = I18nManager.isRTL;

export type BlogItem = RouterOutputs["podcasts"]["posts"]["data"][number];

function getInitials(value?: string | null) {
  if (!value) return "AG";
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CardHeader({ post }: { post: BlogItem }) {
  const title = post.caption || post.audio?.title || "Alghurobaa";
  return (
    <View className="flex-row items-center justify-between mb-3">
      <View className="flex-row items-center gap-3">
        <View className="size-10 rounded-full bg-muted items-center justify-center">
          <Text className="text-sm font-bold text-foreground">
            {getInitials(title)}
          </Text>
        </View>
        <View>
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {formatDate(post.date, "MMM D, YYYY")}
          </Text>
        </View>
      </View>
      <Pressable className="p-1 rounded-full active:bg-muted">
        <Icon name="MoreHorizontal" className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}

function CardFooter({ post }: { post: BlogItem }) {
  const tags = post.tags?.slice(0, 2) ?? [];
  return (
    <View className="flex-row items-center justify-between mt-3">
      <View className="flex-row gap-2">
        {tags.map((tag, idx) => (
          <View
            key={`${tag}-${idx}`}
            className="px-2.5 py-1 rounded-md bg-accent/10"
          >
            <Text className="text-xs font-medium text-accent">#{tag}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row items-center gap-4">
        <Pressable className="flex-row items-center gap-1 active:opacity-70">
          <Icon name="Heart" className="text-muted-foreground" />
          <Text className="text-xs font-medium text-muted-foreground">
            {post.likes ?? 0}
          </Text>
        </Pressable>
        <Pressable className="active:opacity-70">
          <Icon name="Bookmark" className="text-muted-foreground" />
        </Pressable>
        <Pressable className="active:opacity-70">
          <Icon name="Share2" className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}

export function BlogCard({ post }: { post: BlogItem }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/blog-view/${post.id}`)}
      className="bg-card rounded-2xl p-4 border border-border"
    >
      <CardHeader post={post} />

      {post.type === "audio" && (
        <>
          <View className="mb-4" style={{ direction: isRTL ? "rtl" : "ltr" }}>
            <Text
              className="text-xl font-bold text-foreground mb-2 leading-tight text-right"
              numberOfLines={2}
            >
              {post.caption || post.audio?.title}
            </Text>
            <Text
              className="text-base text-muted-foreground leading-relaxed text-right"
              numberOfLines={3}
            >
              {post.content}
            </Text>
          </View>
          <View className="bg-background rounded-xl p-3 mb-1 border border-border flex-row items-center gap-3">
            <Pressable className="size-10 rounded-full bg-accent items-center justify-center shadow-md active:opacity-90">
              <Icon name="Play" className="text-accent-foreground ml-0.5" />
            </Pressable>
            <View className="flex-1 gap-1.5">
              <View className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <View className="h-full bg-accent w-[35%]" />
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[10px] font-medium text-muted-foreground">
                  00:00
                </Text>
                <Text className="text-[10px] font-medium text-muted-foreground">
                  {minuteToString(post.audio?.duration)}
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

      {post.type === "video" && (
        <>
          <View className="mb-4" style={{ direction: isRTL ? "rtl" : "ltr" }}>
            <Text
              className="text-xl font-bold text-foreground mb-2 leading-tight text-right"
              numberOfLines={2}
            >
              {post.caption}
            </Text>
            <Text
              className="text-base text-muted-foreground leading-relaxed text-right"
              numberOfLines={3}
            >
              {post.content}
            </Text>
          </View>
          <View className="h-40 rounded-xl mb-1 relative overflow-hidden bg-black">
            {post.coverImageUrl ? (
              <Image
                source={{ uri: post.coverImageUrl }}
                className="absolute inset-0 w-full h-full opacity-70"
                resizeMode="cover"
              />
            ) : null}
            <View className="absolute inset-0 items-center justify-center">
              <View className="size-12 rounded-full bg-accent/90 items-center justify-center shadow-lg">
                <Icon name="Play" className="text-accent-foreground ml-1" />
              </View>
            </View>
          </View>
        </>
      )}

      {post.type === "text" && (
        <View
          className="mb-2 pt-3 border-t border-border"
          style={{ direction: isRTL ? "rtl" : "ltr" }}
        >
          <Text
            className="text-foreground text-lg leading-relaxed text-right"
            numberOfLines={5}
          >
            {post.content}
          </Text>
        </View>
      )}

      <CardFooter post={post} />
    </Pressable>
  );
}
