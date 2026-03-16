import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, PanResponder, ScrollView, Text, View } from "react-native";

import { AudioTranscript } from "@/components/audio-blog-view/audio-transcript";
import { CommentsSheet } from "@/components/comments-sheet";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useCommentsSheet } from "@/hooks/use-comments-sheet";
import { useColors } from "@/hooks/use-color";
import { usePlayHistorySync } from "@/hooks/use-play-history-sync";
import { useAudioStore } from "@/store/audio-store";
import { useRecentlyViewedStore } from "@/store/recently-viewed-store";
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

function albumColor(id?: number | null) {
  if (!id) return ALBUM_COLORS[0];
  return ALBUM_COLORS[id % ALBUM_COLORS.length];
}

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Tab = "info" | "transcript";

// ── Player controls ───────────────────────────────────────────────────────────

function PlayerSection() {
  const colors = useColors();
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const position = useAudioStore((s) => s.position);
  const duration = useAudioStore((s) => s.duration);
  const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
  const seek = useAudioStore((s) => s.seek);

  const progress = duration > 0 ? position / duration : 0;
  const [trackWidth, setTrackWidth] = useState(0);

  // Refs to avoid stale closures inside PanResponder
  const trackWidthRef = useRef(0);
  const durationRef = useRef(duration);
  const seekRef = useRef(seek);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { seekRef.current = seek; }, [seek]);

  const seekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const w = trackWidthRef.current;
        const d = durationRef.current;
        if (!w || !d) return;
        seekRef.current(Math.max(0, Math.min(d, (x / w) * d)));
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const w = trackWidthRef.current;
        const d = durationRef.current;
        if (!w || !d) return;
        seekRef.current(Math.max(0, Math.min(d, (x / w) * d)));
      },
    })
  ).current;

  const KNOB = 16;
  const knobLeft = trackWidth > 0 ? Math.max(0, Math.min(trackWidth - KNOB, progress * trackWidth - KNOB / 2)) : 0;

  return (
    <View className="gap-4">
      {/* Scrubber */}
      <View className="py-2">
        <View
          className="relative h-10 justify-center"
          onLayout={(e) => {
            trackWidthRef.current = e.nativeEvent.layout.width;
            setTrackWidth(e.nativeEvent.layout.width);
          }}
          {...seekPanResponder.panHandlers}
        >
          <View className="absolute w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <View
              style={{ height: "100%", backgroundColor: colors.primary, borderRadius: 9999, width: `${progress * 100}%` }}
            />
          </View>
          {trackWidth > 0 && (
            <View
              style={{
                position: "absolute",
                width: KNOB,
                height: KNOB,
                backgroundColor: colors.background,
                borderRadius: 9999,
                borderWidth: 2,
                borderColor: colors.primary,
                zIndex: 20,
                left: knobLeft,
              }}
            />
          )}
          <View className="absolute inset-0 flex-row items-center justify-between opacity-20 px-1 pointer-events-none">
            {[3, 5, 8, 4, 6, 3, 2, 5, 4, 3, 6, 4, 3, 5, 7].map((h, i) => (
              <View key={i} style={{ width: 4, backgroundColor: colors.foreground, borderRadius: 9999, height: h * 3 }} />
            ))}
          </View>
        </View>
        <View className="flex-row justify-between mt-[-6px]">
          <Text className="text-xs font-medium text-muted-foreground">{formatMs(position)}</Text>
          <Text className="text-xs font-medium text-muted-foreground">-{formatMs(Math.max(0, duration - position))}</Text>
        </View>
      </View>

      {/* Controls */}
      <View className="flex-row items-center justify-between">
        <Pressable className="px-2 py-1 rounded-md bg-muted active:opacity-70">
          <Text className="text-xs font-bold text-muted-foreground">1.0x</Text>
        </Pressable>
        <View className="flex-row items-center gap-6">
          <Pressable className="p-2 active:opacity-50" onPress={() => seek(Math.max(0, position - 10000))}>
            <Icon name="RotateCcw" size={28} className="text-foreground" />
          </Pressable>
          <Pressable
            onPress={() => togglePlayPause()}
            className="size-16 bg-primary rounded-full items-center justify-center shadow-lg active:opacity-90"
          >
            <Icon name={isPlaying ? "Pause" : "Play"} size={28} className="text-primary-foreground" />
          </Pressable>
          <Pressable className="p-2 active:opacity-50" onPress={() => seek(Math.min(duration, position + 10000))}>
            <Icon name="RotateCw" size={28} className="text-foreground" />
          </Pressable>
        </View>
        <Pressable className="p-2 active:opacity-50">
          <Icon name="Volume2" size={20} className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}

function FloatingPlayerWidget({ visible }: { visible: boolean }) {
  const colors = useColors();
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const position = useAudioStore((s) => s.position);
  const duration = useAudioStore((s) => s.duration);
  const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
  const seek = useAudioStore((s) => s.seek);

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 16,
      }}
    >
      <View className="overflow-hidden rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl">
        <View className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
          <View
            style={{
              width: `${duration > 0 ? (position / duration) * 100 : 0}%`,
              height: "100%",
              backgroundColor: colors.primary,
            }}
          />
        </View>
        <View className="flex-row items-center justify-between">
          <Pressable className="p-2 active:opacity-50" onPress={() => seek(Math.max(0, position - 10000))}>
            <Icon name="RotateCcw" size={20} className="text-muted-foreground" />
          </Pressable>
          <Pressable
            onPress={() => togglePlayPause()}
            className="size-12 items-center justify-center rounded-full bg-primary active:opacity-90"
          >
            <Icon name={isPlaying ? "Pause" : "Play"} size={22} className="text-primary-foreground" />
          </Pressable>
          <Pressable className="p-2 active:opacity-50" onPress={() => seek(Math.min(duration, position + 10000))}>
            <Icon name="RotateCw" size={20} className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Info tab ──────────────────────────────────────────────────────────────────

function InfoTab({ blog, onCommentsPress }: { blog: any; onCommentsPress: () => void }) {
  const colors = useColors();
  const tags = blog.blogTags?.map((bt: any) => bt.tags?.title).filter(Boolean) ?? [];
  const commentCount = blog.blogs?.length ?? 0;

  return (
    <View className="gap-4 pb-8">
      <View className="flex-row items-center gap-3 py-4 border-b border-border">
        <View className="size-10 rounded-full bg-muted items-center justify-center">
          <Text className="text-sm font-bold text-muted-foreground">AG</Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground font-medium">Author</Text>
          <Text className="text-sm font-bold text-foreground">Alghurobaa</Text>
        </View>
        <Pressable className="px-4 py-1.5 rounded-full border border-border active:bg-muted">
          <Text className="text-xs font-bold text-muted-foreground">Follow</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, textAlign: "right", writingDirection: "rtl" }}>
          {blog.content ?? "Untitled"}
        </Text>
        {tags.length > 0 && (
          <View className="flex-row flex-wrap gap-2 justify-end mt-1">
            {tags.map((tag: string) => (
              <Pressable key={tag} className="px-3 py-1 bg-muted rounded-lg active:opacity-70">
                <Text className="text-sm font-medium text-primary">#{tag}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable
        onPress={onCommentsPress}
        className="flex-row items-center justify-between p-4 bg-card rounded-xl active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <Icon name="MessageCircle" size={18} className="text-foreground" />
          <Text className="text-sm font-bold text-foreground">Comments</Text>
          <View className="px-1.5 py-0.5 rounded-full bg-muted">
            <Text className="text-xs text-muted-foreground">{commentCount}</Text>
          </View>
        </View>
        <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}

// ── More menu sheet ───────────────────────────────────────────────────────────

function MoreMenu({
  visible,
  hasAlbum,
  albumId,
  onClose,
  onAddToAlbum,
  onViewAlbum,
}: {
  visible: boolean;
  hasAlbum: boolean;
  albumId?: number | null;
  onClose: () => void;
  onAddToAlbum: () => void;
  onViewAlbum: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 }}
        >
          <View style={{ width: 36, height: 4, backgroundColor: colors.input, borderRadius: 2, alignSelf: "center", marginBottom: 8 }} />

          {/* Add / Change Album */}
          <Pressable
            onPress={() => { onClose(); setTimeout(onAddToAlbum, 250); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 8 }}
          >
            <Icon name="ListMusic" size={22} className="text-foreground" />
            <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: "500" }}>
              {hasAlbum ? "تغيير الألبوم" : "إضافة إلى ألبوم"}
            </Text>
          </Pressable>

          {/* View album (only if already in one) */}
          {hasAlbum && (
            <Pressable
              onPress={() => { onClose(); setTimeout(onViewAlbum, 250); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 8 }}
            >
              <Icon name="Disc3" size={22} className="text-foreground" />
              <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: "500" }}>عرض الألبوم</Text>
            </Pressable>
          )}

          {/* Share */}
          <Pressable
            onPress={onClose}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 8 }}
          >
            <Icon name="Share2" size={22} className="text-foreground" />
            <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: "500" }}>مشاركة</Text>
          </Pressable>

          <View style={{ height: 20 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Add-to-album picker ───────────────────────────────────────────────────────

function AddToAlbumPicker({
  visible,
  mediaId,
  onClose,
  onAdded,
  onNewAlbum,
  isAdding,
  addingAlbumId,
  onPick,
}: {
  visible: boolean;
  mediaId?: number | null;
  onClose: () => void;
  onAdded: (albumName: string) => void;
  onNewAlbum: () => void;
  isAdding: boolean;
  addingAlbumId: number | null;
  onPick: (albumId: number, albumName: string) => void;
}) {
  const colors = useColors();
  const { data: albums, isLoading } = useQuery({
    ..._trpc.album.getAlbums.queryOptions(),
    enabled: visible,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "70%",
          }}
        >
          {/* Handle + header */}
          <View style={{ padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 36, height: 4, backgroundColor: colors.input, borderRadius: 2, alignSelf: "center", marginBottom: 12 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={onClose}>
                <Icon name="X" size={20} className="text-muted-foreground" />
              </Pressable>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>إضافة إلى ألبوم</Text>
              <View style={{ width: 20 }} />
            </View>
          </View>

          {/* Album list */}
          {isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !albums?.length ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
              <Icon name="Disc3" size={36} className="text-muted-foreground" />
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>لا توجد ألبومات</Text>
            </View>
          ) : (
            <FlatList
              data={albums}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
              renderItem={({ item }) => {
                const color = albumColor(item.id);
                const isThisAdding = isAdding && addingAlbumId === item.id;
                return (
                  <Pressable
                    onPress={() => onPick(item.id, item.name)}
                    disabled={isAdding}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingVertical: 12,
                      opacity: isAdding && !isThisAdding ? 0.4 : 1,
                    }}
                  >
                    {/* Album art — intentional brand color background, keep white text */}
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: color,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isThisAdding ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
                          {getInitials(item.name)}
                        </Text>
                      )}
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, textAlign: "right" }} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "right" }}>
                        {item._count?.medias ?? 0} مقطع
                      </Text>
                    </View>

                    <Icon name="ChevronLeft" size={16} className="text-muted-foreground" />
                  </Pressable>
                );
              }}
            />
          )}

          {/* New album shortcut */}
          <Pressable
            onPress={() => { onClose(); setTimeout(onNewAlbum, 250); }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                backgroundColor: colors.muted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="Plus" size={20} className="text-muted-foreground" />
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.mutedForeground }}>إنشاء ألبوم جديد</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Album art section ─────────────────────────────────────────────────────────

function AlbumArtSection({ media }: { media: any }) {
  const hasAlbum = !!media?.album;
  const color = albumColor(media?.albumId);

  if (hasAlbum) {
    return (
      <View className="px-6">
        <View
          style={{
            width: "100%",
            aspectRatio: 1,
            borderRadius: 20,
            backgroundColor: color,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: color,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.6,
            shadowRadius: 30,
            elevation: 16,
          }}
        >
          <Text style={{ fontSize: 72, fontWeight: "900", color: "#fff", opacity: 0.9 }}>
            {getInitials(media.album.name)}
          </Text>
          <View style={{ position: "absolute", top: 16, right: 16 }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 99, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#fff" }}>Audio Blog</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="px-6">
      <View className="w-full aspect-square rounded-2xl overflow-hidden bg-muted items-center justify-center shadow-2xl border border-border">
        <Icon name="AudioWaveform" size={64} className="text-muted-foreground" />
        <View className="absolute top-4 right-4">
          <View className="px-3 py-1 bg-black/40 rounded-full border border-white/10">
            <Text className="text-xs font-medium text-white">Audio Blog</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AudioBlogScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const colors = useColors();
  const { blogId, openComments: openCommentsParam } = useLocalSearchParams<{ blogId: string; openComments?: string }>();
  const id = Number(blogId);

  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [albumPickerVisible, setAlbumPickerVisible] = useState(false);
  const [addingAlbumId, setAddingAlbumId] = useState<number | null>(null);
  const [addedToAlbumName, setAddedToAlbumName] = useState<string | null>(null);
  const [controlsLayout, setControlsLayout] = useState({ y: 0, height: 0 });
  const [showFloatingControls, setShowFloatingControls] = useState(false);

  const openComments = useCommentsSheet((s) => s.onOpen);
  const loadAudio = useAudioStore((s) => s.loadAudio);

  // Auto-open comments if navigated here with ?openComments=1
  useEffect(() => {
    if (openCommentsParam === "1") {
      const timer = setTimeout(() => openComments(), 600);
      return () => clearTimeout(timer);
    }
  }, [openCommentsParam]);
  const loadedBlog = useAudioStore((s) => s.blog);
  const audioError = useAudioStore((s) => s.error);

  const { data: blog } = useQuery(_trpc.blog.getBlog.queryOptions({ id }));

  const media = blog?.medias?.[0];
  const mediaId = media?.id;
  const telegramFileId = media?.file?.fileId;
  const duration = media?.file?.duration;

  usePlayHistorySync(mediaId);

  const markViewed = useRecentlyViewedStore((s) => s.markViewed);
  useEffect(() => {
    if (blog) {
      markViewed({
        id: blog.id,
        title: blog.caption || (blog.medias as any)?.[0]?.title || "Untitled",
        type: blog.type ?? "audio",
        date: blog.date ?? null,
      });
    }
  }, [blog?.id]);

  useEffect(() => {
    if (!blog || blog.type !== "audio") return;

    const media = blog.medias?.[0];
    const file = media?.file;
    if (!media?.id || !file?.fileId || !file?.fileName) return;
    if (loadedBlog?.id === blog.id) return;

    loadAudio({
      id: blog.id,
      type: "audio",
      caption: blog.content ?? media.title ?? null,
      content: null,
      date: blog.blogDate,
      audio: {
        mediaId: media.id,
        telegramFileId: file.fileId,
        fileName: file.fileName,
        title: media.title,
        duration: file.duration,
      },
    } as any).catch(() => undefined);
  }, [blog?.id, loadedBlog?.id, loadAudio]);

  const { mutate: addToAlbum, isPending: isAdding } = useMutation(
    _trpc.album.addMediaToAlbum.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: _trpc.blog.getBlog.queryKey({ id }) });
        setAlbumPickerVisible(false);
        setAddingAlbumId(null);
      },
      onError: (e) => {
        setAddingAlbumId(null);
        Alert.alert("خطأ", e.message);
      },
    })
  );

  function handlePickAlbum(albumId: number, albumName: string) {
    if (!mediaId) return;
    setAddingAlbumId(albumId);
    setAddedToAlbumName(albumName);
    addToAlbum({ albumId, mediaIds: [mediaId] });
  }

  function updateFloatingControls(scrollY: number) {
    if (!controlsLayout.height) return;
    setShowFloatingControls(scrollY > controlsLayout.y + controlsLayout.height + 12);
  }

  return (
    <View className="flex-1 bg-background">
      <SafeArea className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-10 items-center justify-center rounded-full active:bg-muted"
          >
            <Icon name="ArrowLeft" className="text-foreground" />
          </Pressable>
          <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Now Playing
          </Text>
          <View className="flex-row items-center gap-1">
            <Pressable className="size-10 items-center justify-center rounded-full active:bg-muted">
              <Icon name="Share" className="text-foreground" />
            </Pressable>
            <Pressable
              onPress={() => setMoreMenuVisible(true)}
              className="size-10 items-center justify-center rounded-full active:bg-muted"
            >
              <Icon name="MoreHorizontal" className="text-foreground" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 120 }}
          onScroll={(event) => updateFloatingControls(event.nativeEvent.contentOffset.y)}
        >
          {/* Album art */}
          <AlbumArtSection media={media} />

          {/* Album strip */}
          {media?.album && (
            <Pressable
              onPress={() => router.push(`/albums/${media.albumId}` as any)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginHorizontal: 24,
                marginTop: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Icon name="Disc3" size={16} className="text-primary" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }} numberOfLines={1}>
                  {media.album.name}
                </Text>
                {media.albumAudioIndex?.index && (
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                    المقطع {media.albumAudioIndex.index}
                  </Text>
                )}
              </View>
              <Icon name="ChevronRight" size={14} className="text-muted-foreground" />
            </Pressable>
          )}

          {/* "Added to album" confirmation */}
          {addedToAlbumName && !isAdding && (
            <View style={{ marginHorizontal: 24, marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.success + "22", borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="CheckCircle2" size={16} className="text-success" />
              <Text style={{ fontSize: 13, color: colors.success, flex: 1 }}>
                تمت الإضافة إلى {addedToAlbumName}
              </Text>
              <Pressable onPress={() => setAddedToAlbumName(null)}>
                <Icon name="X" size={14} className="text-success" />
              </Pressable>
            </View>
          )}

          {/* Category + duration */}
          <View className="flex-row justify-between items-center px-6 pt-4">
            <Text className="text-xs font-semibold tracking-wide text-primary uppercase">
              {blog?.blogTags?.[0]?.tags?.title ?? "Audio"}
            </Text>
            <View className="flex-row items-center gap-1">
              <Icon name="Headphones" size={14} className="text-primary" />
              <Text className="text-xs font-medium text-primary">
                {duration ? minuteToString(duration) : "—"}
              </Text>
            </View>
          </View>

          {/* Player controls */}
          <View
            className="px-6 pt-2"
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              setControlsLayout({ y, height });
            }}
          >
            <PlayerSection />
            {audioError ? (
              <Text className="pt-3 text-center text-xs text-destructive">
                {audioError}
              </Text>
            ) : null}
          </View>

          {/* Tabs */}
          <View className="mx-6 mt-4">
            <View className="flex-row rounded-xl bg-muted p-1">
              {(["info", "transcript"] as Tab[]).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? "bg-card shadow-sm" : ""}`}
                >
                  <Text className={`text-sm font-bold capitalize ${activeTab === tab ? "text-foreground" : "text-muted-foreground"}`}>
                    {tab}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tab content */}
          <View className="mt-3 px-6">
            {activeTab === "info" ? (
              <InfoTab blog={blog ?? {}} onCommentsPress={openComments} />
            ) : mediaId ? (
              <AudioTranscript mediaId={mediaId} telegramFileId={telegramFileId} />
            ) : (
              <View className="items-center justify-center py-12">
                <Text className="text-sm text-muted-foreground">No media attached</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeArea>

      <FloatingPlayerWidget visible={showFloatingControls} />

      {/* Comments modal */}
      <CommentsSheet blogId={id} />

      {/* More menu */}
      <MoreMenu
        visible={moreMenuVisible}
        hasAlbum={!!media?.album}
        albumId={media?.albumId}
        onClose={() => setMoreMenuVisible(false)}
        onAddToAlbum={() => setAlbumPickerVisible(true)}
        onViewAlbum={() => router.push(`/albums/${media?.albumId}` as any)}
      />

      {/* Album picker */}
      <AddToAlbumPicker
        visible={albumPickerVisible}
        mediaId={mediaId}
        onClose={() => setAlbumPickerVisible(false)}
        onAdded={(name) => setAddedToAlbumName(name)}
        onNewAlbum={() => router.push("/albums" as any)}
        isAdding={isAdding}
        addingAlbumId={addingAlbumId}
        onPick={handlePickAlbum}
      />
    </View>
  );
}
