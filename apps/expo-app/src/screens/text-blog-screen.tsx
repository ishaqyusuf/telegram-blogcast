import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { formatDate } from "@acme/utils/dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Linking, ScrollView, Share, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { CommentsSheet } from "@/components/comments-sheet";
import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { parseBlogContent, SEGMENT_COLORS, type ContentSegment } from "@/lib/parse-blog-content";
import { withAlpha } from "@/lib/theme";
import { useColors } from "@/hooks/use-color";

// ── Styled content renderer ───────────────────────────────────────────────────

function StyledContent({ text, style }: { text: string; style?: object }) {
  const colors = useColors();
  const segments = parseBlogContent(text);
  return (
    <Text style={[{ fontSize: 17, lineHeight: 30, color: colors.foreground, textAlign: "right", writingDirection: "rtl" }, style]}>
      {segments.map((seg: ContentSegment, i: number) => {
        if (seg.type === "text") return seg.value;
        if (seg.type === "link") {
          return (
            <Text
              key={i}
              style={{ color: SEGMENT_COLORS.link, textDecorationLine: "underline" }}
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
  const { onOpen: openComments } = useCommentsSheet();

  const { data: blog, isLoading } = useQuery(
    _trpc.blog.getBlog.queryOptions({ id: Number(blogId) })
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!blog) return null;

  const tags = blog.blogTags?.map((bt: any) => bt.tags?.title).filter(Boolean) ?? [];
  const date = blog.blogDate ?? blog.createdAt;
  const commentCount = blog.blogs?.length ?? 0;

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable
            onPress={() => router.back()}
            className="size-9 rounded-full bg-secondary items-center justify-center"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>

          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => router.push(`/blog-form?blogId=${blog.id}` as any)}
              className="p-2"
            >
              <Icon name="Pencil" size={18} className="text-muted-foreground" />
            </Pressable>
            <Pressable
              onPress={() =>
                Share.share({ message: blog.content ?? "" })
              }
              className="p-2"
            >
              <Icon name="Share2" size={18} className="text-muted-foreground" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Meta */}
          <View className="px-5 pt-6 pb-4 items-end gap-1.5">
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
          <View className="h-px bg-border mx-5" />

          {/* Tags */}
          {tags.length > 0 && (
            <View className="px-5 py-4 flex-row flex-wrap gap-2 justify-end">
              {tags.map((tag: string) => (
                <View
                  key={tag}
                  className="rounded-full px-2.5 py-1 border border-primary/25"
                  style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
                >
                  <Text className="text-xs font-semibold text-primary">
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Reactions */}
          <View className="px-5 py-4 flex-row justify-end gap-5 border-t border-border">
            {["❤️", "🤲", "💡"].map((emoji) => (
              <ReactionButton key={emoji} emoji={emoji} blogId={Number(blogId)} />
            ))}
          </View>

          {/* Comments CTA */}
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
        </ScrollView>
      </SafeArea>
    </View>
  );
}

// ── Inline reaction button ────────────────────────────────────────────────────

function ReactionButton({ emoji, blogId }: { emoji: string; blogId: number }) {
  const colors = useColors();
  const { data: reactions } = useQuery(
    _trpc.blog.getReactions.queryOptions({ blogId })
  );
  const qc = useQueryClient();
  const { mutate } = useMutation(
    _trpc.blog.addReaction.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: _trpc.blog.getReactions.queryKey({ blogId }) }),
    })
  );

  const reaction = reactions?.find((r: any) => r.emoji === emoji);
  const active = reaction?.reacted ?? false;
  const count = reaction?.count ?? 0;

  return (
    <Pressable
      onPress={() => mutate({ blogId, emoji })}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
        active ? "border-primary/40 bg-primary/10" : "border-border bg-card"
      }`}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      {count > 0 && (
        <Text
          className={`text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}
