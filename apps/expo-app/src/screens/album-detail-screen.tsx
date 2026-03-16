import { useMutation, useQuery, useQueryClient } from "@acme/ui/tanstack";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { minuteToString } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALBUM_COLORS = ["#4c1d95", "#7c2d12", "#14532d", "#1e3a5f", "#3b0764", "#064e3b"];

function getInitials(name?: string | null) {
  if (!name) return "AL";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function albumColor(id: number) {
  return ALBUM_COLORS[id % ALBUM_COLORS.length];
}

// ── Edit-album modal ──────────────────────────────────────────────────────────

function EditAlbumModal({
  visible,
  album,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  album: { name: string; description?: string | null };
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(album.name);
  const [description, setDescription] = useState(album.description ?? "");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}} // block tap-through
          style={{
            backgroundColor: "#1e1e1e",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            gap: 16,
          }}
        >
          {/* Handle bar */}
          <View style={{ width: 40, height: 4, backgroundColor: "#3a3a3a", borderRadius: 2, alignSelf: "center", marginBottom: 4 }} />

          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", textAlign: "right" }}>
            تعديل الألبوم
          </Text>

          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>اسم الألبوم</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="أدخل الاسم..."
              placeholderTextColor="#4a4a4a"
              style={{
                backgroundColor: "#282828",
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 15,
                color: "#e8e8e8",
                textAlign: "right",
                borderWidth: 1,
                borderColor: "#3a3a3a",
              }}
            />
          </View>

          {/* Description */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>الوصف</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="أضف وصفاً للألبوم..."
              placeholderTextColor="#4a4a4a"
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: "#282828",
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                color: "#e8e8e8",
                textAlign: "right",
                writingDirection: "rtl",
                minHeight: 90,
                borderWidth: 1,
                borderColor: "#3a3a3a",
                textAlignVertical: "top",
              }}
            />
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10, paddingBottom: 8 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: "#282828",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#b3b3b3", fontWeight: "600" }}>إلغاء</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(name.trim(), description.trim())}
              disabled={isSaving || !name.trim()}
              style={{
                flex: 2,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: "#1DB954",
                alignItems: "center",
                opacity: isSaving || !name.trim() ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#000", fontWeight: "700" }}>
                {isSaving ? "جاري الحفظ..." : "حفظ"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Track row — normal view ───────────────────────────────────────────────────

function TrackRow({
  media,
  displayIndex,
  onPress,
}: {
  media: any;
  displayIndex: number;
  onPress: () => void;
}) {
  const duration = media.file?.duration ?? media.duration;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#1e1e1e",
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: "#6b7280",
          width: 24,
          textAlign: "center",
        }}
      >
        {displayIndex}
      </Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontSize: 14, fontWeight: "600", color: "#e8e8e8", textAlign: "right" }}
          numberOfLines={1}
        >
          {media.title || media.file?.name || "Untitled"}
        </Text>
        {duration != null && (
          <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
            {minuteToString(duration)}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => {}}
        hitSlop={8}
        style={{ padding: 6 }}
      >
        <Icon name="MoreHorizontal" size={18} className="text-muted-foreground" />
      </Pressable>
    </Pressable>
  );
}

// ── Track row — reorder view ──────────────────────────────────────────────────

function ReorderRow({
  media,
  displayIndex,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  media: any;
  displayIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const duration = media.file?.duration ?? media.duration;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#1e1e1e",
        backgroundColor: "#121212",
      }}
    >
      {/* Up/Down controls */}
      <View style={{ alignItems: "center", gap: 2 }}>
        <Pressable
          onPress={onMoveUp}
          disabled={isFirst}
          style={{ padding: 4, opacity: isFirst ? 0.2 : 1 }}
        >
          <Icon name="ChevronUp" size={18} className="text-muted-foreground" />
        </Pressable>
        <Pressable
          onPress={onMoveDown}
          disabled={isLast}
          style={{ padding: 4, opacity: isLast ? 0.2 : 1 }}
        >
          <Icon name="ChevronDown" size={18} className="text-muted-foreground" />
        </Pressable>
      </View>

      {/* Index badge */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: "#282828",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#6b7280" }}>{displayIndex}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#e8e8e8", textAlign: "right" }} numberOfLines={1}>
          {media.title || media.file?.name || "Untitled"}
        </Text>
        {duration != null && (
          <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
            {minuteToString(duration)}
          </Text>
        )}
      </View>

      {/* Drag handle indicator */}
      <Icon name="GripVertical" size={18} className="text-muted-foreground" style={{ opacity: 0.4 }} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AlbumDetailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const id = Number(albumId);

  const { data: album, isLoading } = useQuery(_trpc.album.getAlbum.queryOptions({ id }));

  // Local track order state (mirrors server, mutated on reorder actions)
  const [localTracks, setLocalTracks] = useState<any[] | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const tracks: any[] = localTracks ?? album?.medias ?? [];
  const bgColor = albumColor(id);

  const { mutate: saveOrder, isPending: isSavingOrder } = useMutation(
    _trpc.album.reorderTracks.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: _trpc.album.getAlbum.queryKey({ id }) });
        setLocalTracks(null);
        setReorderMode(false);
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  const { mutate: updateAlbum, isPending: isUpdating } = useMutation(
    _trpc.album.updateAlbum.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: _trpc.album.getAlbum.queryKey({ id }) });
        setEditModalVisible(false);
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  // When entering reorder mode, snapshot current server tracks into local state
  function enterReorderMode() {
    setLocalTracks([...(album?.medias ?? [])]);
    setReorderMode(true);
  }

  function cancelReorder() {
    setLocalTracks(null);
    setReorderMode(false);
  }

  function commitOrder() {
    const order = tracks.map((media, i) => ({ mediaId: media.id, index: i + 1 }));
    saveOrder({ albumId: id, order });
  }

  const moveTrack = useCallback(
    (fromIdx: number, toIdx: number) => {
      setLocalTracks((prev) => {
        const arr = [...(prev ?? album?.medias ?? [])];
        const [item] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, item);
        return arr;
      });
    },
    [album?.medias]
  );

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

          <Text
            style={{ fontSize: 15, fontWeight: "700", color: "#fff", flex: 1, textAlign: "center", marginHorizontal: 8 }}
            numberOfLines={1}
          >
            {album?.name ?? "Album"}
          </Text>

          <Pressable
            onPress={() => setEditModalVisible(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#282828",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="Pencil" size={16} className="text-muted-foreground" />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#6b7280" }}>جاري التحميل...</Text>
          </View>
        ) : !album ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#6b7280" }}>الألبوم غير موجود</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={{ alignItems: "center", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 10 }}>
              {/* Art */}
              <View
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 20,
                  backgroundColor: bgColor,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: bgColor,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.5,
                  shadowRadius: 20,
                  elevation: 12,
                }}
              >
                <Text style={{ fontSize: 52, fontWeight: "800", color: "#fff" }}>
                  {getInitials(album.name)}
                </Text>
              </View>

              {/* Name */}
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff", textAlign: "center", marginTop: 4 }}>
                {album.name}
              </Text>

              {/* Author */}
              {album.author?.name && (
                <Text style={{ fontSize: 14, color: "#1DB954", fontWeight: "600" }}>
                  {album.author.name}
                </Text>
              )}

              {/* Description */}
              {album.description ? (
                <Pressable onPress={() => setDescExpanded((v) => !v)} style={{ width: "100%" }}>
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#9ca3af",
                      textAlign: "center",
                      lineHeight: 22,
                      writingDirection: "rtl",
                    }}
                    numberOfLines={descExpanded ? undefined : 2}
                  >
                    {album.description}
                  </Text>
                  {album.description.length > 80 && (
                    <Text style={{ fontSize: 12, color: "#1DB954", textAlign: "center", marginTop: 4 }}>
                      {descExpanded ? "أقل" : "المزيد"}
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Pressable onPress={() => setEditModalVisible(true)}>
                  <Text style={{ fontSize: 13, color: "#4a4a4a", fontStyle: "italic" }}>
                    أضف وصفاً للألبوم...
                  </Text>
                </Pressable>
              )}

              {/* Meta pills */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#1e1e1e", borderRadius: 99 }}>
                  <Text style={{ fontSize: 12, color: "#6b7280" }}>
                    {album.medias?.length ?? 0} مقطع
                  </Text>
                </View>
                {album.albumType && (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#1e1e1e", borderRadius: 99 }}>
                    <Text style={{ fontSize: 12, color: "#6b7280" }}>{album.albumType}</Text>
                  </View>
                )}
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8, width: "100%" }}>
                <Pressable
                  onPress={() => {
                    const first = tracks[0];
                    if (first?.blog?.id) router.push(`/blog-view/${first.blog.id}` as any);
                  }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 13,
                    borderRadius: 12,
                    backgroundColor: "#1DB954",
                  }}
                >
                  <Icon name="Play" size={18} className="text-black" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#000" }}>تشغيل الكل</Text>
                </Pressable>
                <Pressable
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: "#282828",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="Shuffle" size={20} className="text-muted-foreground" />
                </Pressable>
              </View>
            </View>

            {/* Tracks section */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 60 }}>
              {/* Section header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: "#1e1e1e",
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#e8e8e8" }}>
                  المقاطع
                </Text>

                {tracks.length > 0 && !reorderMode && (
                  <Pressable
                    onPress={enterReorderMode}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      backgroundColor: "#282828",
                      borderRadius: 8,
                    }}
                  >
                    <Icon name="ListOrdered" size={14} className="text-muted-foreground" />
                    <Text style={{ fontSize: 12, color: "#9ca3af" }}>ترتيب</Text>
                  </Pressable>
                )}

                {reorderMode && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={cancelReorder}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#282828", borderRadius: 8 }}
                    >
                      <Text style={{ fontSize: 12, color: "#9ca3af" }}>إلغاء</Text>
                    </Pressable>
                    <Pressable
                      onPress={commitOrder}
                      disabled={isSavingOrder}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        backgroundColor: "#1DB954",
                        borderRadius: 8,
                        opacity: isSavingOrder ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#000" }}>
                        {isSavingOrder ? "..." : "حفظ الترتيب"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {tracks.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
                  <Icon name="Music2" size={40} className="text-muted-foreground" />
                  <Text style={{ fontSize: 14, color: "#6b7280" }}>لا توجد مقاطع بعد</Text>
                </View>
              ) : reorderMode ? (
                tracks.map((media, idx) => (
                  <ReorderRow
                    key={media.id}
                    media={media}
                    displayIndex={idx + 1}
                    isFirst={idx === 0}
                    isLast={idx === tracks.length - 1}
                    onMoveUp={() => moveTrack(idx, idx - 1)}
                    onMoveDown={() => moveTrack(idx, idx + 1)}
                  />
                ))
              ) : (
                tracks.map((media, idx) => (
                  <TrackRow
                    key={media.id}
                    media={media}
                    displayIndex={idx + 1}
                    onPress={() => {
                      if (media.blog?.id) router.push(`/blog-view/${media.blog.id}` as any);
                    }}
                  />
                ))
              )}
            </View>
          </ScrollView>
        )}
      </SafeArea>

      {/* Edit album modal */}
      {album && (
        <EditAlbumModal
          visible={editModalVisible}
          album={{ name: album.name, description: album.description }}
          onClose={() => setEditModalVisible(false)}
          onSave={(name, description) => updateAlbum({ id, name, description })}
          isSaving={isUpdating}
        />
      )}
    </View>
  );
}
