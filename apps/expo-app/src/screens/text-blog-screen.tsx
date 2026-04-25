import { CommentsSheet } from "@/components/comments-sheet";
import { CommentInput } from "@/components/comments-sheet/comment-input";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { withAlpha } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { formatDate } from "@acme/utils/dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  Platform,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RichContent } from "@/components/rich-content/rich-content";

export default function TextBlogScreen() {
  const { blogId } = useLocalSearchParams<{ blogId: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { onOpen: openComments } = useCommentsSheet();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const numericBlogId = Number(blogId);

  const { data: blog, isLoading } = useQuery(
    _trpc.blog.getBlog.queryOptions({ id: numericBlogId }),
  );

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!blog) return null;

  const tags =
    blog.blogTags?.map((bt: any) => bt.tags?.title).filter(Boolean) ?? [];
  const date = blog.blogDate ?? blog.createdAt;
  const commentCount = blog.blogs?.length ?? 0;

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon
              name="ChevronLeft"
              size={22}
              className="text-muted-foreground"
            />
          </Pressable>

          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => router.push(`/blog-form?blogId=${blog.id}` as any)}
              className="p-2"
            >
              <Icon name="Pencil" size={18} className="text-muted-foreground" />
            </Pressable>
            <Pressable
              onPress={() => Share.share({ message: blog.content ?? "" })}
              className="p-2"
            >
              <Icon name="Share2" size={18} className="text-muted-foreground" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-end gap-1.5 px-5 pt-6 pb-4">
            {date && (
              <Text className="text-xs text-muted-foreground">
                {formatDate(date, "D MMMM YYYY")}
              </Text>
            )}
          </View>

          <View className="px-5 pb-7">
            <RichContent
              text={blog.content ?? ""}
              style={{
                color: colors.foreground,
              }}
            />
          </View>

          <View className="mx-5 h-px bg-border" />

          {tags.length > 0 && (
            <View className="flex-row flex-wrap justify-end gap-2 px-5 py-4">
              {tags.map((tag: string) => (
                <View
                  key={tag}
                  className="rounded-full border border-primary/25 px-2.5 py-1"
                  style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
                >
                  <Text className="text-xs font-semibold text-primary">
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View className="flex-row justify-end gap-5 border-t border-border px-5 py-4">
            {["❤️", "🤲", "💡"].map((emoji) => (
              <ReactionButton
                key={emoji}
                emoji={emoji}
                blogId={numericBlogId}
              />
            ))}
          </View>

          <Pressable
            onPress={openComments}
            className="mx-5 mb-4 flex-row items-center justify-between rounded-xl bg-card p-4 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <Icon name="MessageCircle" size={18} className="text-foreground" />
              <Text className="text-sm font-bold text-foreground">Comments</Text>
              {commentCount > 0 && (
                <View className="rounded-full bg-muted px-1.5 py-0.5">
                  <Text className="text-xs text-muted-foreground">
                    {commentCount}
                  </Text>
                </View>
              )}
            </View>
            <Icon
              name="ChevronRight"
              size={16}
              className="text-muted-foreground"
            />
          </Pressable>

          <CommentsSheet blogId={numericBlogId} />
        </ScrollView>

        <View
          className="absolute inset-x-0 z-50"
          style={{
            position: "absolute",
            insetInline: 0,
            bottom: Math.max(
              keyboardHeight - (Platform.OS === "ios" ? insets.bottom : -25),
              0,
            ),
          }}
        >
          <CommentInput blogId={numericBlogId} compact noKeyboardAvoid />
        </View>
      </SafeArea>
    </View>
  );
}

function ReactionButton({ emoji, blogId }: { emoji: string; blogId: number }) {
  const { data: reactions } = useQuery(
    _trpc.blog.getReactions.queryOptions({ blogId }),
  );
  const qc = useQueryClient();
  const { mutate } = useMutation(
    _trpc.blog.addReaction.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: _trpc.blog.getReactions.queryKey({ blogId }),
        }),
    }),
  );

  const reaction = reactions?.find((r: any) => r.emoji === emoji);
  const active = reaction?.reacted ?? false;
  const count = reaction?.count ?? 0;

  return (
    <Pressable
      onPress={() => mutate({ blogId, emoji })}
      className={cn(
        "flex-row items-center gap-1 rounded-full border px-3 py-1.5",
        active ? "border-primary/40 bg-primary/10" : "border-border bg-card",
      )}
      style={{
        minHeight: 36,
      }}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      {count > 0 && (
        <Text
          className={cn(
            "text-xs font-semibold",
            active ? "text-primary" : "text-muted-foreground",
          )}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}
