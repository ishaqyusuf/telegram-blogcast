import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { formatDate } from "@acme/utils/dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Linking, ScrollView, Share, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { CommentsSheet } from "@/components/comments-sheet";
import { parseBlogContent, SEGMENT_COLORS, type ContentSegment } from "@/lib/parse-blog-content";

// ── Styled content renderer ───────────────────────────────────────────────────

function StyledContent({ text, style }: { text: string; style?: object }) {
  const segments = parseBlogContent(text);
  return (
    <Text style={[{ fontSize: 17, lineHeight: 30, color: "#e8e8e8", textAlign: "right", writingDirection: "rtl" }, style]}>
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

  const { data: blog, isLoading } = useQuery(
    _trpc.blog.getBlog.queryOptions({ id: Number(blogId) })
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#121212", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1DB954" />
      </View>
    );
  }

  if (!blog) return null;

  const tags = blog.blogTags?.map((bt: any) => bt.tags?.title).filter(Boolean) ?? [];
  const date = blog.blogDate ?? blog.createdAt;

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <SafeArea>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#1e1e1e",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#282828",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pressable
              onPress={() => router.push(`/blog-form?blogId=${blog.id}` as any)}
              style={{ padding: 8 }}
            >
              <Icon name="Pencil" size={18} className="text-muted-foreground" />
            </Pressable>
            <Pressable
              onPress={() =>
                Share.share({ message: blog.content ?? "" })
              }
              style={{ padding: 8 }}
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
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: 16,
              gap: 6,
              alignItems: "flex-end",
            }}
          >
            {/* Date row */}
            {date && (
              <Text style={{ fontSize: 12, color: "#6b7280" }}>
                {formatDate(date, "D MMMM YYYY")}
              </Text>
            )}
          </View>

          {/* Content */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
            <StyledContent text={blog.content ?? ""} />
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "#1e1e1e", marginHorizontal: 20 }} />

          {/* Tags */}
          {tags.length > 0 && (
            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              {tags.map((tag: string) => (
                <View
                  key={tag}
                  style={{
                    backgroundColor: "#1a2e1a",
                    borderRadius: 99,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: "rgba(29,185,84,0.25)",
                  }}
                >
                  <Text style={{ fontSize: 12, color: "#1DB954", fontWeight: "600" }}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Reactions */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 20,
              borderTopWidth: 1,
              borderTopColor: "#1e1e1e",
            }}
          >
            {["❤️", "🤲", "💡"].map((emoji) => (
              <ReactionButton key={emoji} emoji={emoji} blogId={Number(blogId)} />
            ))}
          </View>

          {/* Comments CTA */}
          <CommentsSheet blogId={Number(blogId)} />
        </ScrollView>
      </SafeArea>
    </View>
  );
}

// ── Inline reaction button ────────────────────────────────────────────────────

function ReactionButton({ emoji, blogId }: { emoji: string; blogId: number }) {
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
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 99,
        backgroundColor: active ? "rgba(29,185,84,0.12)" : "#1e1e1e",
        borderWidth: 1,
        borderColor: active ? "rgba(29,185,84,0.4)" : "#282828",
      }}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      {count > 0 && (
        <Text style={{ fontSize: 12, color: active ? "#1DB954" : "#6b7280", fontWeight: "600" }}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}
