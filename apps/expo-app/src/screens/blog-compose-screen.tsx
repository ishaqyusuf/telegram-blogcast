import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQueryClient } from "@/lib/react-query";
import * as DocumentPicker from "expo-document-picker";
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
import { useColors } from "@/hooks/use-color";
import { uploadBlogMediaAsset, type BlobMediaUpload } from "@/lib/blob-upload";
import { useTranslation } from "@/lib/i18n";
import { withAlpha } from "@/lib/theme";

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
  placeholder,
  minHeight = 180,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const [editing, setEditing] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const colors = useColors();

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onBlur={() => value.length > 0 && setEditing(false)}
        multiline
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={{
          fontSize: 16,
          lineHeight: 26,
          color: colors.foreground,
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
          color: colors.foreground,
          textAlign: "right",
          writingDirection: "rtl",
        }}
      />
    </Pressable>
  );
}

// ── Tag chip ──────────────────────────────────────────────────────────────────

function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: withAlpha(colors.primary, 0.12),
        borderRadius: 99,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: withAlpha(colors.primary, 0.3),
      }}
    >
      <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>#{label}</Text>
      <Pressable onPress={onRemove} hitSlop={6}>
        <Icon name="X" size={12} className="text-primary" />
      </Pressable>
    </View>
  );
}

type ComposeMediaUpload = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  status: "uploading" | "uploaded" | "failed";
  progress: number;
  error?: string;
  blob?: BlobMediaUpload;
};

function MediaUploadRow({
  item,
  onRemove,
  onRetry,
}: {
  item: ComposeMediaUpload;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const isUploading = item.status === "uploading";
  const isFailed = item.status === "failed";

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: isFailed ? colors.destructive : colors.border,
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: withAlpha(colors.primary, 0.12),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="FileText" size={18} className="text-primary" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}
          >
            {item.name}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {isUploading
              ? t("uploading")
              : isFailed
                ? t("uploadFailed")
                : t("uploaded")}
          </Text>
        </View>
        {isFailed ? (
          <Pressable onPress={onRetry} hitSlop={8}>
            <Icon name="RefreshCw" size={18} className="text-primary" />
          </Pressable>
        ) : null}
        <Pressable onPress={onRemove} hitSlop={8}>
          <Icon name="X" size={18} className="text-muted-foreground" />
        </Pressable>
      </View>
      {isUploading ? (
        <View style={{ height: 4, overflow: "hidden", borderRadius: 99, backgroundColor: colors.muted }}>
          <View
            style={{
              height: "100%",
              width: `${Math.max(5, Math.round(item.progress * 100))}%`,
              backgroundColor: colors.primary,
            }}
          />
        </View>
      ) : null}
      {item.error ? (
        <Text style={{ color: colors.destructive, fontSize: 11 }}>
          {item.error}
        </Text>
      ) : null}
    </View>
  );
}

// ── Main compose screen ───────────────────────────────────────────────────────

export default function BlogComposeScreen() {
  const { blogId: editId } = useLocalSearchParams<{ blogId?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const colors = useColors();
  const { t, textAlign, writingDirection } = useTranslation();

  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [mediaUploads, setMediaUploads] = useState<ComposeMediaUpload[]>([]);

  const isEditing = !!editId;

  const { mutate: createBlog, isPending: isCreating } = useMutation(
    _trpc.blog.createBlog.mutationOptions({
      onSuccess: (blog) => {
        qc.invalidateQueries({ queryKey: _trpc.blog.posts.queryKey() });
        router.replace(`/blog-view-text/${blog.id}` as any);
      },
      onError: (e) => Alert.alert(t("error"), e.message),
    })
  );

  const { mutate: updateBlog, isPending: isUpdating } = useMutation(
    _trpc.blog.updateBlog.mutationOptions({
      onSuccess: (blog) => {
        qc.invalidateQueries({ queryKey: _trpc.blog.getBlog.queryKey({ id: blog.id }) });
        router.back();
      },
      onError: (e) => Alert.alert(t("error"), e.message),
    })
  );

  const hasUploadingMedia = mediaUploads.some((item) => item.status === "uploading");
  const uploadedMedia = mediaUploads
    .map((item) => item.blob)
    .filter(Boolean) as BlobMediaUpload[];
  const isPending = isCreating || isUpdating || hasUploadingMedia;

  function updateMedia(id: string, patch: Partial<ComposeMediaUpload>) {
    setMediaUploads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function uploadPickedAsset(asset: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
    size?: number | null;
  }) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: ComposeMediaUpload = {
      id,
      uri: asset.uri,
      name: asset.name || "upload",
      mimeType: asset.mimeType || "application/octet-stream",
      size: asset.size ?? undefined,
      status: "uploading",
      progress: 0,
    };

    setMediaUploads((prev) => [...prev, item]);

    try {
      const blob = await uploadBlogMediaAsset(asset, (progress) => {
        updateMedia(id, { progress });
      });
      updateMedia(id, { status: "uploaded", progress: 1, blob, error: undefined });
    } catch (error) {
      updateMedia(id, {
        status: "failed",
        error: error instanceof Error ? error.message : t("uploadFailed"),
      });
    }
  }

  async function pickMedia() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "audio/*", "video/*", "application/pdf", "text/plain"],
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;
    for (const asset of result.assets) {
      await uploadPickedAsset(asset);
    }
  }

  function retryUpload(item: ComposeMediaUpload) {
    setMediaUploads((prev) => prev.filter((media) => media.id !== item.id));
    uploadPickedAsset({
      uri: item.uri,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
    });
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function publish(status: "published" | "draft") {
    if (!content.trim() && uploadedMedia.length === 0) {
      Alert.alert(t("contentRequired"), t("contentRequiredDescription"));
      return;
    }
    if (hasUploadingMedia) return;
    if (isEditing && editId) {
      updateBlog({
        id: Number(editId),
        content: content.trim(),
        status,
        tags: allTags,
        mediaUploads: uploadedMedia,
      });
    } else {
      createBlog({
        content: content.trim(),
        status,
        tags: allTags,
        mediaUploads: uploadedMedia,
      });
    }
  }

  // Extract auto-detected hashtags from content for display hint
  const autoTags = [...(content.match(/#([\p{L}\p{N}_\u0600-\u06FF]+)/gsu) ?? [])].map((t) =>
    t.slice(1)
  );
  const allTags = [...new Set([...tags, ...autoTags])];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="X" size={20} className="text-foreground" />
          </Pressable>

          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
            {isEditing ? t("editBlog") : t("newBlog")}
          </Text>

          {/* Publish button */}
          <Pressable
            onPress={() => publish("published")}
            disabled={isPending}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 99,
              paddingHorizontal: 16,
              paddingVertical: 7,
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primaryForeground }}>{t("publish")}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 0 }}
        >
          {/* Content input */}
          <StyledContentInput
            value={content}
            onChange={setContent}
            placeholder={t("writeContentPlaceholder")}
          />

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 20 }} />

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
              {t("tags")}
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
                {t("autoDetectedTags")}
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
                backgroundColor: colors.card,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Pressable
                onPress={addTag}
                style={{
                  backgroundColor: colors.muted,
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
                placeholder={t("addTag")}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: colors.foreground,
                  textAlign: "right",
                  writingDirection: "rtl",
                }}
              />
              <Text style={{ fontSize: 13, color: "#6b7280" }}>#</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 20 }} />

          <View style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.mutedForeground,
                  textAlign,
                  writingDirection,
                }}
              >
                {t("media")}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.mutedForeground,
                  textAlign,
                  writingDirection,
                }}
              >
                {t("mediaUploadDescription")}
              </Text>
            </View>
            <Pressable
              onPress={pickMedia}
              disabled={isPending}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: isPending ? 0.6 : 1,
              }}
            >
              <Icon name="Plus" size={18} className="text-primary" />
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                {t("pickMedia")}
              </Text>
            </Pressable>
            {mediaUploads.map((item) => (
              <MediaUploadRow
                key={item.id}
                item={item}
                onRemove={() =>
                  setMediaUploads((prev) => prev.filter((media) => media.id !== item.id))
                }
                onRetry={() => retryUpload(item)}
              />
            ))}
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
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => publish("draft")}
            disabled={isPending}
            style={{
              alignItems: "center",
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.mutedForeground }}>
              {t("saveDraft")}
            </Text>
          </Pressable>
        </View>
      </SafeArea>
    </View>
  );
}
