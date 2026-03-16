import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import {
  parseBlogContent,
  SEGMENT_COLORS,
  type ContentSegment,
} from "@/lib/parse-blog-content";

// ── Shared styled-text renderer ──────────────────────────────────────────────

function StyledText({
  text,
  style,
  numberOfLines,
}: {
  text: string;
  style?: object;
  numberOfLines?: number;
}) {
  const segments = parseBlogContent(text);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg: ContentSegment, i: number) =>
        seg.type === "text" ? (
          seg.value
        ) : (
          <Text key={i} style={{ color: SEGMENT_COLORS[seg.type] }}>
            {seg.value}
          </Text>
        )
      )}
    </Text>
  );
}

// ── Toggle input: plain TextInput while editing, styled Text when blurred ────

function StyledContentInput({
  value,
  onChange,
  placeholder = "ابدأ الكتابة هنا...",
  minHeight = 180,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const [editing, setEditing] = useState(true);
  const inputRef = useRef<TextInput>(null);

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onBlur={() => value.length > 0 && setEditing(false)}
        multiline
        placeholder={placeholder}
        placeholderTextColor="#4a4a4a"
        style={{
          fontSize: 16,
          lineHeight: 26,
          color: "#e8e8e8",
          textAlign: "right",
          writingDirection: "rtl",
          minHeight,
          paddingVertical: 4,
        }}
        textAlignVertical="top"
        autoFocus={value.length === 0}
      />
    );
  }

  // Preview mode — tap to edit
  return (
    <Pressable
      onPress={() => {
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }}
      style={{ minHeight, paddingVertical: 4 }}
    >
      <StyledText
        text={value}
        style={{
          fontSize: 16,
          lineHeight: 26,
          color: "#e8e8e8",
          textAlign: "right",
          writingDirection: "rtl",
        }}
      />
    </Pressable>
  );
}

// ── Tag chip ──────────────────────────────────────────────────────────────────

function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#1a2e1a",
        borderRadius: 99,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "rgba(29,185,84,0.3)",
      }}
    >
      <Text style={{ fontSize: 12, color: "#1DB954", fontWeight: "600" }}>#{label}</Text>
      <Pressable onPress={onRemove} hitSlop={6}>
        <Icon name="X" size={12} className="text-primary" />
      </Pressable>
    </View>
  );
}

// ── Main compose screen ───────────────────────────────────────────────────────

export default function BlogComposeScreen() {
  const { blogId: editId } = useLocalSearchParams<{ blogId?: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const isEditing = !!editId;

  const { mutate: createBlog, isPending: isCreating } = useMutation(
    _trpc.blog.createBlog.mutationOptions({
      onSuccess: (blog) => {
        qc.invalidateQueries({ queryKey: _trpc.blog.posts.queryKey() });
        router.replace(`/blog-view-text/${blog.id}` as any);
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  const { mutate: updateBlog, isPending: isUpdating } = useMutation(
    _trpc.blog.updateBlog.mutationOptions({
      onSuccess: (blog) => {
        qc.invalidateQueries({ queryKey: _trpc.blog.getBlog.queryKey({ id: blog.id }) });
        router.back();
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  const isPending = isCreating || isUpdating;

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function publish(status: "published" | "draft") {
    if (!content.trim()) {
      Alert.alert("المحتوى مطلوب", "الرجاء كتابة محتوى المنشور.");
      return;
    }
    if (isEditing && editId) {
      updateBlog({ id: Number(editId), content: content.trim(), status });
    } else {
      createBlog({ content: content.trim(), status });
    }
  }

  // Extract auto-detected hashtags from content for display hint
  const autoTags = [...(content.match(/#([\p{L}\p{N}_\u0600-\u06FF]+)/gsu) ?? [])].map((t) =>
    t.slice(1)
  );
  const allTags = [...new Set([...tags, ...autoTags])];

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
            borderBottomColor: "#282828",
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
            <Icon name="X" size={20} className="text-foreground" />
          </Pressable>

          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
            {isEditing ? "تعديل المنشور" : "منشور جديد"}
          </Text>

          {/* Publish button */}
          <Pressable
            onPress={() => publish("published")}
            disabled={isPending}
            style={{
              backgroundColor: "#1DB954",
              borderRadius: 99,
              paddingHorizontal: 16,
              paddingVertical: 7,
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#000" }}>نشر</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 0 }}
        >
          {/* Content input */}
          <StyledContentInput value={content} onChange={setContent} />

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "#282828", marginVertical: 20 }} />

          {/* Tags section */}
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: "#6b7280",
                textAlign: "right",
                writingDirection: "rtl",
              }}
            >
              الوسوم
            </Text>

            {/* Auto-detected note */}
            {autoTags.length > 0 && (
              <Text
                style={{
                  fontSize: 11,
                  color: "#4a4a4a",
                  textAlign: "right",
                  writingDirection: "rtl",
                }}
              >
                الوسوم المكتشفة تلقائياً من النص
              </Text>
            )}

            {/* Tag chips */}
            {allTags.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                {allTags.map((tag) => (
                  <TagChip
                    key={tag}
                    label={tag}
                    onRemove={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  />
                ))}
              </View>
            )}

            {/* Manual tag input */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "#1e1e1e",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: "#282828",
              }}
            >
              <Pressable
                onPress={addTag}
                style={{
                  backgroundColor: "#282828",
                  borderRadius: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Icon name="Plus" size={14} className="text-muted-foreground" />
              </Pressable>
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                placeholder="أضف وسماً..."
                placeholderTextColor="#4a4a4a"
                returnKeyType="done"
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "#e8e8e8",
                  textAlign: "right",
                  writingDirection: "rtl",
                }}
              />
              <Text style={{ fontSize: 13, color: "#6b7280" }}>#</Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer — save as draft */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingBottom: 28,
            paddingTop: 12,
            backgroundColor: "#121212",
            borderTopWidth: 1,
            borderTopColor: "#1e1e1e",
          }}
        >
          <Pressable
            onPress={() => publish("draft")}
            disabled={isPending}
            style={{
              alignItems: "center",
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: "#1e1e1e",
              borderWidth: 1,
              borderColor: "#282828",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#b3b3b3" }}>
              حفظ كمسودة
            </Text>
          </Pressable>
        </View>
      </SafeArea>
    </View>
  );
}
