import { Pressable } from "@/components/ui/pressable";
import {
  isArabicLine,
  MAX_LINE,
  normalizeExternalUrl,
  splitTextLinesWithLinks,
} from "@acme/blog";
import { useRouter } from "expo-router";
import { Image, Linking, Text, View } from "react-native";

import { minuteToString } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";

import type { BlogCardVariant, BlogItem } from "./types";
import { getPrimaryImageUrl } from "./utils";

function formatMediaSizeMb(size?: number | null) {
  if (!size || !Number.isFinite(size) || size <= 0) return null;

  const mb = size / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function truncateUrlLabel(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 34) return trimmed;

  return `${trimmed.slice(0, 22)}...${trimmed.slice(-8)}`;
}

function getContentDirection(content: string) {
  return isArabicLine(content)
    ? {
        textAlign: "right" as const,
        writingDirection: "rtl" as const,
      }
    : {
        textAlign: "left" as const,
        writingDirection: "ltr" as const,
      };
}

function LinkifiedText({
  content,
  className,
  color,
  linkColor,
  numberOfLines = MAX_LINE,
}: {
  content: string;
  className: string;
  color?: string;
  linkColor: string;
  numberOfLines?: number;
}) {
  const lines = splitTextLinesWithLinks(content);
  const directionStyle = getContentDirection(content);

  return (
    <Text
      className={className}
      numberOfLines={numberOfLines}
      style={{ color, ...directionStyle }}
    >
      {lines.map((lineSegments, lineIdx) => (
        <Text key={`line-${lineIdx}`}>
          {lineSegments.map((segment, segmentIdx) => {
            if (segment.type === "link") {
              const href = segment.href ?? normalizeExternalUrl(segment.text);
              if (!href) {
                return (
                  <Text key={`seg-${lineIdx}-${segmentIdx}`}>
                    {segment.text}
                  </Text>
                );
              }
              return (
                <Text
                  key={`seg-${lineIdx}-${segmentIdx}`}
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(href)}
                  style={{
                    color: linkColor,
                    fontWeight: "700",
                    textDecorationLine: "underline",
                  }}
                >
                  {truncateUrlLabel(segment.text)}
                </Text>
              );
            }

            return (
              <Text key={`seg-${lineIdx}-${segmentIdx}`}>{segment.text}</Text>
            );
          })}
          {lineIdx < lines.length - 1 ? "\n" : ""}
        </Text>
      ))}
    </Text>
  );
}

function CardText({ post }: { post: BlogItem }) {
  const colors = useColors();
  const content = post.content?.trim() || post.caption?.trim();
  if (!content) return null;

  return (
    <View className="mb-3">
      <LinkifiedText
        content={content}
        className="text-[15px] leading-6 text-foreground"
        color={colors.foreground}
        linkColor={colors.primary}
      />
    </View>
  );
}

function CardAudio({ post }: { post: BlogItem }) {
  const colors = useColors();
  if (!post.audio?.telegramFileId && !(post.audio as any)?.url) return null;

  const mediaSize = formatMediaSizeMb(post.audio?.size);

  return (
    <View
      className="mb-1 flex-row items-center gap-3 rounded-xl border border-border bg-background p-3"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <Pressable className="size-10 items-center justify-center rounded-full bg-accent">
        <Icon name="Play" className="ml-0.5 text-accent-foreground" />
      </Pressable>
      <View className="flex-1 gap-1.5">
        <View
          className="h-1 w-full overflow-hidden rounded-full bg-muted"
          style={{ backgroundColor: colors.muted }}
        >
          <View
            className="h-full w-[35%] bg-accent"
            style={{ backgroundColor: colors.accent }}
          />
        </View>
        <View className="flex-row justify-between">
          <Text
            className="text-[10px] font-medium text-muted-foreground"
            style={{ color: colors.mutedForeground }}
          >
            00:00
          </Text>
          <Text
            className="text-[10px] font-medium text-muted-foreground"
            style={{ color: colors.mutedForeground }}
          >
            {[minuteToString(post.audio?.duration), mediaSize]
              .filter(Boolean)
              .join(" • ")}
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
            uri: encodeURIComponent(imageUrl),
            title: post.caption || post.audio?.title || "Post image",
          },
        });
      }}
    >
      <Image
        source={{ uri: imageUrl }}
        className="h-44 w-full"
        resizeMode="cover"
      />
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
  const { t } = useTranslation();
  const colors = useColors();
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
      <View
        className="mb-2 pt-3 border-t border-border"
        style={{
          borderTopColor: colors.border,
        }}
      >
        <LinkifiedText
          content={post.content ?? ""}
          className="text-lg leading-8 text-foreground"
          color={colors.foreground}
          linkColor={colors.primary}
        />
      </View>
    );
  }

  return (
    <View
      className="mb-2 rounded-lg border border-border bg-background px-3 py-2"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <Text
        className="text-sm text-muted-foreground"
        style={{ color: colors.mutedForeground }}
      >
        {t("noRenderableMedia")}
      </Text>
    </View>
  );
}
