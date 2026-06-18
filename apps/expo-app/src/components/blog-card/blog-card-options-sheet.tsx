import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { Alert, Share, Text, View } from "react-native";

import { Icon, type IconKeys } from "@/components/ui/icon";
import { _trpc } from "@/components/static-trpc";
import { useQuery } from "@/lib/react-query";
import { getWebUrl } from "@/lib/base-url";
import { getBlogHref } from "./utils";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

type Props = {
  blogId: string;
};

const TYPE_LABELS: Record<string, string> = {
  audio: "Audio",
  image: "Image",
  picture: "Image",
  text: "Text",
  video: "Video",
};

function ActionRow({
  label,
  description,
  icon,
  onPress,
  danger = false,
}: {
  label: string;
  description: string;
  icon: IconKeys;
  onPress: () => void;
  danger?: boolean;
}) {
  const colors = useColors();
  const actionColor = danger ? colors.destructive : colors.foreground;

  return (
    <Pressable
      haptic
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 rounded-2xl px-3 py-2 active:bg-muted"
    >
      <View
        className="size-11 items-center justify-center rounded-full"
        style={{
          backgroundColor: danger
            ? withAlpha(colors.destructive, 0.12)
            : colors.muted,
        }}
      >
        <Icon
          name={icon}
          className={danger ? "text-destructive" : "text-foreground"}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={
            danger
              ? "text-sm font-medium text-destructive"
              : "text-sm font-medium text-foreground"
          }
          style={{ color: actionColor }}
        >
          {label}
        </Text>
        <Text
          className="mt-0.5 text-xs text-muted-foreground"
          numberOfLines={1}
          style={{ color: colors.mutedForeground }}
        >
          {description}
        </Text>
      </View>
      {!danger && (
        <Icon name="ChevronRight" className="text-muted-foreground" />
      )}
    </Pressable>
  );
}

export function BlogCardOptionsSheet({ blogId }: Props) {
  const router = useRouter();
  const colors = useColors();
  const numericBlogId = Number(blogId);
  const { data: blog } = useQuery(
    _trpc.blog.getBlog.queryOptions(
      { id: numericBlogId || 0 },
      { enabled: Number.isFinite(numericBlogId) && numericBlogId > 0 },
    ),
  );

  const onShare = async () => {
    const id = encodeURIComponent(blogId);
    let webUrl = `https://alghurobaa.com/blog/${id}`;
    try {
      webUrl = `${getWebUrl()}/blog/${id}`;
    } catch {}
    await Share.share({
      message: `Check out this post: ${webUrl}`,
      url: webUrl,
    });
  };

  const onComingSoon = () => {
    Alert.alert("Coming soon", "This action is not connected yet.");
  };
  const postTitle =
    (blog as any)?.caption?.trim() ||
    (blog as any)?.content?.trim() ||
    (blog as any)?.medias?.[0]?.title?.trim() ||
    `Post #${blogId}`;
  const rawPostType = blog ? String((blog as any).type ?? "post") : "post";
  const postType = TYPE_LABELS[rawPostType] ?? "Post";

  return (
    <View
      className="flex-1 justify-end"
      style={{ backgroundColor: withAlpha(colors.foreground, 0.4) }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close post options"
        className="flex-1"
        onPress={() => router.back()}
      />
      <View
        className="rounded-t-[28px] border border-border bg-card px-4 pb-8 shadow-lg"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          maxHeight: "82%",
        }}
      >
        <View className="items-center py-3.5">
          <View
            className="h-1 w-11 rounded-full bg-muted"
            style={{ backgroundColor: colors.muted }}
          />
        </View>

        <View className="pb-4">
          <View className="mb-3 flex-row items-center gap-2">
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
            >
              <Text
                className="text-xs font-semibold text-primary"
                style={{ color: colors.primary }}
              >
                {postType}
              </Text>
            </View>
            <Text
              className="text-xs text-muted-foreground"
              style={{ color: colors.mutedForeground }}
            >
              #{blogId}
            </Text>
          </View>
          <Text
            className="text-xl font-semibold text-foreground"
            numberOfLines={2}
            style={{ color: colors.foreground }}
          >
            Post options
          </Text>
          <Text
            className="mt-1 text-sm leading-5 text-muted-foreground"
            numberOfLines={2}
            style={{ color: colors.mutedForeground }}
          >
            {postTitle}
          </Text>
        </View>

        <View className="gap-1">
          <ActionRow
            label="Open post"
            description="View the full post and media"
            icon="FileText"
            onPress={() => {
              if (blog) {
                router.replace(
                  getBlogHref({ id: blog.id, type: blog.type } as any) as any,
                );
                return;
              }
              router.replace(`/blog-view/${blogId}` as any);
            }}
          />
          <ActionRow
            label="Share"
            description="Send a web link to this post"
            icon="Share2"
            onPress={onShare}
          />
          <ActionRow
            label="Comment"
            description="Open the discussion for this post"
            icon="MessageSquare"
            onPress={() => {
              if (blog) {
                router.replace({
                  pathname: getBlogHref({
                    id: blog.id,
                    type: blog.type,
                  } as any) as any,
                  params: { openComments: "1" },
                });
                return;
              }
              router.replace(`/blog-view/${blogId}` as any);
            }}
          />
          <ActionRow
            label="Save"
            description="Keep this post in saved items"
            icon="Bookmark"
            onPress={onComingSoon}
          />
          <ActionRow
            label="Like"
            description="Add this post to liked items"
            icon="Heart"
            onPress={onComingSoon}
          />
        </View>

        <View
          className="my-3 h-px"
          style={{ backgroundColor: colors.border }}
        />

        <ActionRow
          label="Delete post"
          description="Remove this post from the blog list"
          icon="Trash2"
          danger
          onPress={onComingSoon}
        />
      </View>
    </View>
  );
}
