import { MAX_LINE, normalizeExternalUrl, splitTextLinesWithLinks } from "@acme/blog";
import { useRouter } from "expo-router";
import { Image, I18nManager, Linking, Pressable, Text, View } from "react-native";

import { minuteToString } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

import type { BlogCardVariant, BlogItem } from "./types";
import { getPrimaryImageUrl } from "./utils";

const isRTL = I18nManager.isRTL;

function LinkifiedText({
  content,
  className,
  numberOfLines = MAX_LINE,
}: {
  content: string;
  className: string;
  numberOfLines?: number;
}) {
  const lines = splitTextLinesWithLinks(content);

  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {lines.map((lineSegments, lineIdx) => (
        <Text key={`line-${lineIdx}`}>
          {lineSegments.map((segment, segmentIdx) => {
            if (segment.type === "link") {
              const href = segment.href ?? normalizeExternalUrl(segment.text);
              if (!href) {
                return (
                  <Text key={`seg-${lineIdx}-${segmentIdx}`}>{segment.text}</Text>
                );
              }
              return (
                <Text
                  key={`seg-${lineIdx}-${segmentIdx}`}
                  className="text-accent underline"
                  onPress={() => Linking.openURL(href)}
                >
                  {segment.text}
                </Text>
              );
            }

            return <Text key={`seg-${lineIdx}-${segmentIdx}`}>{segment.text}</Text>;
          })}
          {lineIdx < lines.length - 1 ? "\n" : ""}
        </Text>
      ))}
    </Text>
  );
}

function CardText({ post }: { post: BlogItem }) {
  if (!post.content?.trim()) return null;

  return (
    <View className="mb-3" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <LinkifiedText
        content={post.content}
        className="text-base leading-relaxed text-muted-foreground text-right"
      />
    </View>
  );
}

function CardAudio({ post }: { post: BlogItem }) {
  if (!post.audio?.telegramFileId) return null;

  return (
    <View className="mb-1 flex-row items-center gap-3 rounded-xl border border-border bg-background p-3">
      <Pressable className="size-10 items-center justify-center rounded-full bg-accent active:opacity-90">
        <Icon name="Play" className="ml-0.5 text-accent-foreground" />
      </Pressable>
      <View className="flex-1 gap-1.5">
        <View className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <View className="h-full w-[35%] bg-accent" />
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[10px] font-medium text-muted-foreground">
            00:00
          </Text>
          <Text className="text-[10px] font-medium text-muted-foreground">
            {minuteToString(post.audio.duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CardImage({ post }: { post: BlogItem }) {
  const router = useRouter();
  const imageUrl = getPrimaryImageUrl(post);
  if (!imageUrl) return null;

  return (
    <Pressable
      className="mb-3 overflow-hidden rounded-xl border border-border bg-black"
      onPress={(e) => {
        e.stopPropagation();
        router.push({
          pathname: "/blog-image-view",
          params: {
            uri: imageUrl,
            title: post.caption || post.audio?.title || "Post image",
          },
        });
      }}
    >
      <Image source={{ uri: imageUrl }} className="h-44 w-full" resizeMode="cover" />
    </Pressable>
  );
}

function CardVideo({ post }: { post: BlogItem }) {
  const imageUrl = getPrimaryImageUrl(post);

  return (
    <View className="mb-1 h-40 overflow-hidden rounded-xl bg-black">
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className="absolute inset-0 h-full w-full opacity-70"
          resizeMode="cover"
        />
      ) : null}
      <View className="absolute inset-0 items-center justify-center">
        <View className="size-12 items-center justify-center rounded-full bg-accent/90">
          <Icon name="Play" className="ml-1 text-accent-foreground" />
        </View>
      </View>
    </View>
  );
}

export function CardMedia({
  post,
  variant,
}: {
  post: BlogItem;
  variant: BlogCardVariant;
}) {
  if (variant === "audio") {
    return (
      <>
        <CardText post={post} />
        <CardAudio post={post} />
      </>
    );
  }

  if (variant === "video") {
    return (
      <>
        <CardText post={post} />
        <CardVideo post={post} />
      </>
    );
  }

  if (variant === "text+image") {
    return (
      <>
        <CardImage post={post} />
        <CardText post={post} />
      </>
    );
  }

  if (variant === "image") {
    return <CardImage post={post} />;
  }

  if (variant === "text") {
    return (
      <View className="mb-2 pt-3 border-t border-border" style={{ direction: isRTL ? "rtl" : "ltr" }}>
        <LinkifiedText
          content={post.content ?? ""}
          className="text-right text-lg leading-relaxed text-foreground"
        />
      </View>
    );
  }

  return (
    <View className="mb-2 rounded-lg border border-border bg-background px-3 py-2">
      <Text className="text-sm text-muted-foreground">
        Post has no renderable media payload.
      </Text>
    </View>
  );
}
