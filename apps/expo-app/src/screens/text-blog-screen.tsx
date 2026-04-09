import { Pressable } from "@/components/ui/pressable";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { formatDate } from "@acme/utils/dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  Linking,
  Platform,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { CommentsSheet } from "@/components/comments-sheet";
<<<<<<< HEAD
import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { parseBlogContent, SEGMENT_COLORS, type ContentSegment } from "@/lib/parse-blog-content";
import { withAlpha } from "@/lib/theme";
import { useColors } from "@/hooks/use-color";
=======
import { CommentInput } from "@/components/comments-sheet/comment-input";
import { useColors } from "@/hooks/use-color";
import {
  parseBlogContent,
  SEGMENT_COLORS,
  type ContentSegment,
} from "@/lib/parse-blog-content";
import { useSafeAreaInsets } from "react-native-safe-area-context";
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)

// ── Styled content renderer ───────────────────────────────────────────────────

function StyledContent({ text, style }: { text: string; style?: object }) {
  const colors = useColors();
  const segments = parseBlogContent(text);
  return (
<<<<<<< HEAD
    <Text style={[{ fontSize: 17, lineHeight: 30, color: colors.foreground, textAlign: "right", writingDirection: "rtl" }, style]}>
=======
    <Text
      className="text-[17px] leading-[30px] text-foreground"
      style={[
        {
          textAlign: "right",
          writingDirection: "rtl",
        },
        style,
      ]}
    >
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
      {segments.map((seg: ContentSegment, i: number) => {
        if (seg.type === "text") return seg.value;
        if (seg.type === "link") {
          return (
            <Text
              key={i}
              style={{
                color: SEGMENT_COLORS.link,
                textDecorationLine: "underline",
              }}
              onPress={() => Linking.openURL(seg.value)}
            >
              {seg.value}
            </Text>
          );
        }
        return (
          <Text key={i} style={{ color: SEGMENT_COLORS[seg.type] }}>
            {seg.value}
          </Text>
        );
      })}
    </Text>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TextBlogScreen() {
  const { blogId } = useLocalSearchParams<{ blogId: string }>();
  const router = useRouter();
  const colors = useColors();
<<<<<<< HEAD
  const { onOpen: openComments } = useCommentsSheet();
=======
  const insets = useSafeAreaInsets();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const numericBlogId = Number(blogId);
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)

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
<<<<<<< HEAD
      <View className="flex-1 bg-background items-center justify-center">
=======
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
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
        {/* Header */}
<<<<<<< HEAD
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable
            onPress={() => router.back()}
            className="size-9 rounded-full bg-secondary items-center justify-center"
=======
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card"
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
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
<<<<<<< HEAD
              onPress={() =>
                Share.share({ message: blog.content ?? "" })
              }
=======
              onPress={() => Share.share({ message: blog.content ?? "" })}
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
              className="p-2"
            >
              <Icon name="Share2" size={18} className="text-muted-foreground" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: isComposerOpen ? 180 : 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Meta */}
<<<<<<< HEAD
          <View className="px-5 pt-6 pb-4 items-end gap-1.5">
=======
          <View className="items-end gap-1.5 px-5 pt-6 pb-4">
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
            {/* Date row */}
            {date && (
              <Text className="text-xs text-muted-foreground">
                {formatDate(date, "D MMMM YYYY")}
              </Text>
            )}
          </View>

          {/* Content */}
          <View className="px-5 pb-7">
            <StyledContent text={blog.content ?? ""} />
          </View>

          {/* Divider */}
<<<<<<< HEAD
          <View className="h-px bg-border mx-5" />

          {/* Tags */}
          {tags.length > 0 && (
            <View className="px-5 py-4 flex-row flex-wrap gap-2 justify-end">
              {tags.map((tag: string) => (
                <View
                  key={tag}
                  className="rounded-full px-2.5 py-1 border border-primary/25"
                  style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
=======
          <View className="mx-5 h-px bg-border" />

          {/* Tags */}
          {tags.length > 0 && (
            <View className="flex-row flex-wrap justify-end gap-2 px-5 py-4">
              {tags.map((tag: string) => (
                <View
                  key={tag}
                  className="rounded-full border border-primary/25 bg-card px-2.5 py-1"
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
                >
                  <Text className="text-xs font-semibold text-primary">
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Reactions */}
<<<<<<< HEAD
          <View className="px-5 py-4 flex-row justify-end gap-5 border-t border-border">
=======
          <View className="flex-row justify-end gap-5 border-t border-border px-5 py-4">
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
            {["❤️", "🤲", "💡"].map((emoji) => (
              <ReactionButton
                key={emoji}
                emoji={emoji}
                blogId={numericBlogId}
              />
            ))}
          </View>

          {/* Comments CTA */}
<<<<<<< HEAD
          <Pressable
            onPress={openComments}
            className="mx-5 mb-4 flex-row items-center justify-between p-4 bg-card rounded-xl active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <Icon name="MessageCircle" size={18} className="text-foreground" />
              <Text className="text-sm font-bold text-foreground">Comments</Text>
              {commentCount > 0 && (
                <View className="px-1.5 py-0.5 rounded-full bg-muted">
                  <Text className="text-xs text-muted-foreground">
                    {commentCount}
                  </Text>
                </View>
              )}
            </View>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
          </Pressable>

          <CommentsSheet blogId={Number(blogId)} />
=======
          <CommentsSheet blogId={numericBlogId} />
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
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
          <CommentInput
            blogId={numericBlogId}
            autoFocus
            compact
            noKeyboardAvoid
          />
        </View>
      </SafeArea>
    </View>
  );
}

// ── Inline reaction button ────────────────────────────────────────────────────

function ReactionButton({ emoji, blogId }: { emoji: string; blogId: number }) {
  const colors = useColors();
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
<<<<<<< HEAD
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
        active ? "border-primary/40 bg-primary/10" : "border-border bg-card"
      }`}
=======
      className={cn(
        "flex-row items-center gap-1 rounded-full border px-3 py-1.5",
        active ? "border-primary/40 bg-primary/10" : "border-border bg-card",
      )}
      style={{
        minHeight: 36,
      }}
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      {count > 0 && (
        <Text
<<<<<<< HEAD
          className={`text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
=======
          className={cn(
            "text-xs font-semibold",
            active ? "text-primary" : "text-muted-foreground",
          )}
>>>>>>> d08ecb5 (Rebrand Expo app config and unify mobile icons)
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}
