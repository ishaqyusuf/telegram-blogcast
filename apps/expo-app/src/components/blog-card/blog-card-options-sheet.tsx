import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { Alert, Share, Text, View } from "react-native";

import { Icon, type IconKeys } from "@/components/ui/icon";
import { _trpc } from "@/components/static-trpc";
import { useQuery } from "@/lib/react-query";
import { getWebUrl } from "@/lib/base-url";
import { getBlogHref } from "./utils";

type Props = {
  blogId: string;
};

function ActionRow({
  label,
  icon,
  onPress,
  danger = false,
}: {
  label: string;
  icon: IconKeys;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-3"
    >
      <View className="flex-row items-center gap-3">
        <Icon
          name={icon}
          className={danger ? "text-destructive" : "text-foreground"}
        />
        <Text
          className={danger ? "text-sm font-medium text-destructive" : "text-sm font-medium text-foreground"}
        >
          {label}
        </Text>
      </View>
      <Icon name="MoreHorizontal" className="text-muted-foreground" />
    </Pressable>
  );
}

export function BlogCardOptionsSheet({ blogId }: Props) {
  const router = useRouter();
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

  return (
    <View className="flex-1 bg-transparent justify-end">
      <Pressable className="flex-1" onPress={() => router.back()} />
      <View className="rounded-t-3xl border border-border bg-card pb-8">
        <View className="items-center py-3">
          <View className="h-1.5 w-12 rounded-full bg-muted" />
        </View>

        <View className="px-4 pb-3">
          <Text className="text-lg font-semibold text-foreground">Post options</Text>
          <Text className="text-xs text-muted-foreground">Post #{blogId}</Text>
        </View>

        <ActionRow
          label="Open post"
          icon="FileText"
          onPress={() => {
            if (blog) {
              router.replace(getBlogHref({ id: blog.id, type: blog.type } as any) as any);
              return;
            }
            router.replace(`/blog-view/${blogId}` as any);
          }}
        />
        <ActionRow label="Share" icon="Share2" onPress={onShare} />
        <ActionRow
          label="Comment"
          icon="MessageSquare"
          onPress={() => {
            if (blog) {
              router.replace({
                pathname: getBlogHref({ id: blog.id, type: blog.type } as any) as any,
                params: { openComments: "1" },
              });
              return;
            }
            router.replace(`/blog-view/${blogId}` as any);
          }}
        />
        <ActionRow label="Save" icon="Bookmark" onPress={onComingSoon} />
        <ActionRow label="Like" icon="Heart" onPress={onComingSoon} />
        <ActionRow
          label="Delete"
          icon="Trash2"
          danger
          onPress={onComingSoon}
        />
      </View>
    </View>
  );
}
