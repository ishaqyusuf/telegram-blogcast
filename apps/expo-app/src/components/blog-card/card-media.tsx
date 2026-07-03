import { Pressable } from "@/components/ui/pressable";
import {
  isArabicLine,
  MAX_LINE,
  normalizeExternalUrl,
  splitTextLinesWithLinks,
} from "@acme/blog";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Linking, Platform, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { useTranslation } from "@/lib/i18n";

import type { BlogCardVariant, BlogItem } from "./types";
import {
  getInlinePreviewText,
  getPrimaryDocumentMedia,
  getPrimaryDocumentUrl,
  getPrimaryImageUrl,
} from "./utils";

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
  const content =
    getInlinePreviewText(post.content) ||
    getInlinePreviewText(post.caption) ||
    (post.type === "audio" ? getAudioDisplayTitle(post, "") : "");
  if (!content) return null;

  return (
    <View className="mb-3">
      <LinkifiedText
        content={content}
        className="text-[15px] leading-6 text-foreground"
        color={colors.foreground}
        linkColor={colors.primary}
        numberOfLines={3}
      />
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

function formatFileSize(size?: number | null) {
  if (!size || !Number.isFinite(size) || size <= 0) return null;
  const mb = size / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

const PRIVATE_HTTPS_HOST_PATTERN =
  /^https:\/\/(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i;

function getPdfPreviewUri(uri?: string | null) {
  if (!uri) return null;

  if (Platform.OS === "android") {
    if (!/^https:\/\//i.test(uri) || PRIVATE_HTTPS_HOST_PATTERN.test(uri)) {
      return null;
    }

    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(uri)}`;
  }

  const [baseUri] = uri.split("#");
  return `${baseUri}#page=1&zoom=page-width&toolbar=0&navpanes=0&scrollbar=0`;
}

function PdfPreviewFallback() {
  const colors = useColors();

  return (
    <View
      className="absolute inset-0 items-center justify-center px-5"
      style={{ backgroundColor: colors.muted }}
    >
      <View
        className="mb-3 size-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: colors.background }}
      >
        <Icon name="FileText" size={30} className="text-primary" />
      </View>
      <View
        className="rounded-full px-3 py-1"
        style={{ backgroundColor: colors.primary }}
      >
        <Text
          className="text-[11px] font-bold"
          style={{ color: colors.primaryForeground }}
        >
          PDF
        </Text>
      </View>
    </View>
  );
}

function PdfPreview({ uri, title }: { uri?: string | null; title: string }) {
  const colors = useColors();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const previewUri = useMemo(() => getPdfPreviewUri(uri), [uri]);
  const showPreview = Boolean(previewUri && !hasFailed);

  useEffect(() => {
    setHasLoaded(false);
    setHasFailed(false);
  }, [previewUri]);

  return (
    <View
      className="h-44 overflow-hidden"
      style={{ backgroundColor: colors.muted }}
    >
      {showPreview ? (
        <View className="absolute inset-0" pointerEvents="none">
          <WebView
            source={{ uri: previewUri as string }}
            originWhitelist={["*"]}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
            javaScriptEnabled={Platform.OS === "android"}
            mixedContentMode="always"
            onLoadEnd={() => setHasLoaded(true)}
            onError={() => setHasFailed(true)}
            onHttpError={() => setHasFailed(true)}
            accessibilityLabel={`${title} preview`}
            style={{
              flex: 1,
              backgroundColor: colors.background,
              opacity: hasLoaded ? 1 : 0,
            }}
          />
        </View>
      ) : null}
      {!showPreview || !hasLoaded ? <PdfPreviewFallback /> : null}
      {showPreview && hasLoaded ? (
        <View
          className="absolute left-3 top-3 rounded-full px-3 py-1"
          pointerEvents="none"
          style={{ backgroundColor: colors.primary }}
        >
          <Text
            className="text-[11px] font-bold"
            style={{ color: colors.primaryForeground }}
          >
            PDF
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CardPdf({ post }: { post: BlogItem }) {
  const colors = useColors();
  const doc = getPrimaryDocumentMedia(post) as any;
  const file = doc?.file;
  const previewUrl = getPrimaryDocumentUrl(post);
  const fileName =
    doc?.fileName ||
    file?.fileName ||
    doc?.title ||
    getInlinePreviewText(post.caption) ||
    "PDF document";
  const sizeLabel = formatFileSize(doc?.size ?? file?.fileSize);

  return (
    <View
      className="mb-3 overflow-hidden rounded-xl border border-border bg-card"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <PdfPreview uri={previewUrl} title={fileName} />
      <View className="gap-1 px-3 py-3">
        <Text
          className="text-sm font-bold text-foreground"
          numberOfLines={2}
          style={{ color: colors.foreground }}
        >
          {fileName}
        </Text>
        <Text
          className="text-xs text-muted-foreground"
          numberOfLines={1}
          style={{ color: colors.mutedForeground }}
        >
          {sizeLabel ? `PDF document · ${sizeLabel}` : "PDF document"}
        </Text>
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
    return <CardText post={post} />;
  }

  if (variant === "video") {
    return (
      <>
        <CardText post={post} />
        <CardVideo post={post} />
      </>
    );
  }

  if (variant === "pdf") {
    return (
      <>
        <CardPdf post={post} />
        <CardText post={post} />
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
          content={
            getInlinePreviewText(post.content) ||
            getInlinePreviewText(post.caption) ||
            ""
          }
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
