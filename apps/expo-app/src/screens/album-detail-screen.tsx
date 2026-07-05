import { Pressable } from "@/components/ui/pressable";
import { AddToAlbumModal } from "@/components/channel-chat/add-to-album-modal";
import {
  useFloatingFooterInset,
  useFloatingFooterLayer,
} from "@/components/floating-footer";
import {
  SwipeDeleteAction,
  getSwipeDeleteThreshold,
} from "@/components/ui/swipe-delete-action";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { formatDate } from "@acme/utils/dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import ReanimatedSwipeable, {
  SwipeDirection,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon, type IconKeys } from "@/components/ui/icon";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-color";
import { useScrollChrome } from "@/hooks/use-scroll-chrome";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";
import { getWebUrl } from "@/lib/base-url";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { getMediaFileUrl } from "@/lib/media-source";
import { withAlpha } from "@/lib/theme";
import { getDefaultTranscriberUrl } from "@/lib/transcribe";
import { getTranscriptionBadgeState } from "@/lib/transcription-status";
import { minuteToString } from "@/lib/utils";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useAudioStore } from "@/store/audio-store";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALBUM_COLORS = [
  "#1e40af",
  "#0f766e",
  "#b45309",
  "#4f46e5",
  "#be123c",
  "#0369a1",
];
const SUGGESTION_DISPLAY_LIMIT = 25;
const SUGGESTION_POOL_LIMIT = 500;
const ALBUM_DETAIL_KEYBOARD_OFFSET = 140;
type AlbumDetailTab = "tracks" | "add";

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

function formatMediaSizeMb(size?: number | null) {
  if (!size || !Number.isFinite(size) || size <= 0) return null;
  const mb = size / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function getMediaTelegramTime(media: any) {
  const value = media?.blog?.blogDate ?? media?.blogDate ?? media?.date;
  const time = value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function sortMediaByTelegramDate(items: any[]) {
  return [...items].sort(
    (a, b) => getMediaTelegramTime(b) - getMediaTelegramTime(a),
  );
}

function getTrackBlogHref(media: any) {
  const blogId = media?.blog?.id ?? media?.blogId;
  const type = media?.blog?.type;
  if (!blogId) return null;
  if (type === "text") return `/blog-view-text/${blogId}`;
  if (type === "audio") return `/blog-view-2/${blogId}`;
  return `/blog-view/${blogId}`;
}

function getTrackBlogId(media: any) {
  return media?.blog?.id ?? media?.blogId ?? null;
}

function getTrackMediaId(media: any) {
  return media?.id ?? media?.mediaId ?? media?.audio?.mediaId ?? null;
}

function getTrackTitle(media: any) {
  return (
    media?.title ||
    media?.file?.fileName ||
    media?.file?.name ||
    media?.blog?.content ||
    "Untitled"
  );
}

function getAuthorDisplayName(author?: any | null) {
  return author?.nameAr || author?.name || null;
}

function getBookDisplayName(book?: any | null) {
  return book?.nameAr || book?.nameEn || "Book";
}

function normalizeAlbumSearchText(value?: string | number | null) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670]/g, "")
    .replace(/[\u200c\u200d]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getAlbumSearchTerms(query: string) {
  return normalizeAlbumSearchText(query)
    .split(" ")
    .map((term) => term.trim())
    .filter(Boolean);
}

function getTrackSearchFields(media: any, albumAuthor?: any | null) {
  const blogTags =
    media?.blog?.blogTags
      ?.map((blogTag: any) => blogTag?.tags?.title)
      .filter(Boolean) ?? [];
  const comments =
    media?.blog?.blogs
      ?.map((link: any) =>
        link?.comment?.deletedAt ? null : link?.comment?.content,
      )
      .filter(Boolean) ?? [];
  const transcriptSegments =
    media?.transcript?.segments
      ?.map((segment: any) => segment?.text)
      .filter(Boolean) ?? [];

  return [
    { label: "Title", text: getTrackTitle(media) },
    { label: "File", text: media?.file?.fileName ?? media?.file?.name },
    { label: "Caption", text: media?.blog?.content },
    { label: "Author", text: getAuthorDisplayName(media?.author) },
    { label: "Album author", text: getAuthorDisplayName(albumAuthor) },
    { label: "Tags", text: blogTags.join(" ") },
    { label: "Comments", text: comments.join(" ") },
    { label: "Transcript", text: transcriptSegments.join(" ") },
  ].filter((field) => field.text);
}

function clipAlbumSearchSnippet(value: string, query: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const normalizedText = normalizeAlbumSearchText(text);
  const normalizedQuery = normalizeAlbumSearchText(query);
  const firstTerm = getAlbumSearchTerms(query)[0] ?? normalizedQuery;
  const matchIndex =
    normalizedText.indexOf(normalizedQuery) >= 0
      ? normalizedText.indexOf(normalizedQuery)
      : normalizedText.indexOf(firstTerm);
  const start = matchIndex > 28 ? matchIndex - 28 : 0;
  const snippet = text.slice(start, start + 92).trim();
  return `${start > 0 ? "..." : ""}${snippet}${text.length > start + 92 ? "..." : ""}`;
}

function getTrackSearchMatch(media: any, query: string, albumAuthor?: any | null) {
  const terms = getAlbumSearchTerms(query);
  if (terms.length === 0) return null;

  const fields = getTrackSearchFields(media, albumAuthor);
  const combinedText = normalizeAlbumSearchText(
    fields.map((field) => field.text).join(" "),
  );
  if (!terms.every((term) => combinedText.includes(term))) return null;

  const directField =
    fields.find((field) =>
      normalizeAlbumSearchText(field.text).includes(
        normalizeAlbumSearchText(query),
      ),
    ) ??
    fields.find((field) => {
      const text = normalizeAlbumSearchText(field.text);
      return terms.some((term) => text.includes(term));
    });

  if (!directField) return { label: "Match", snippet: "" };
  return {
    label: directField.label,
    snippet: clipAlbumSearchSnippet(String(directField.text), query),
  };
}

function buildAlbumTrackAudioItem(
  media: any,
  album: any,
  albumQueue?: any[] | null,
) {
  const blogId = getTrackBlogId(media);
  const mediaId = getTrackMediaId(media);
  const file = media?.file;
  const audioUrl = getMediaFileUrl(file);
  const fileName = file?.fileName ?? file?.name;

  if (!blogId || !mediaId || !fileName) return null;

  return {
    id: blogId,
    type: "audio",
    caption: media?.blog?.content ?? media?.title ?? fileName,
    content: media?.blog?.content ?? null,
    date: media?.blog?.blogDate ?? media?.blogDate ?? media?.date ?? null,
    audio: {
      albumId: album?.id,
      albumName: album?.name,
      albumTrackIndex: media?.albumAudioIndex?.index ?? null,
      mediaId,
      telegramFileId: file?.fileId,
      url: audioUrl,
      fileName,
      title: media?.title,
      duration: file?.duration ?? media?.duration,
      ...(albumQueue?.length ? { albumQueue } : {}),
    },
  } as any;
}

function buildAlbumTrackQueue(tracks: any[], album: any) {
  return tracks
    .filter(canPlayAlbumTrack)
    .map((track) => buildAlbumTrackAudioItem(track, album))
    .filter(Boolean);
}

function canPlayAlbumTrack(media: any) {
  const file = media?.file;
  return Boolean(
    getTrackBlogId(media) &&
    getTrackMediaId(media) &&
    (file?.fileName || file?.name) &&
    (file?.fileId || getMediaFileUrl(file)),
  );
}

function AlbumDetailSkeleton() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 24,
          gap: 12,
        }}
      >
        <Skeleton className="h-40 w-40 rounded-[20px]" />
        <Skeleton className="h-6 w-3/5 rounded-md" />
        <Skeleton className="h-4 w-1/3 rounded-md" />
        <View style={{ width: "100%", alignItems: "center", gap: 7 }}>
          <Skeleton className="h-3.5 w-5/6 rounded-md" />
          <Skeleton className="h-3.5 w-2/3 rounded-md" />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </View>
        <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {[0, 1, 2, 3, 4].map((item) => (
          <View
            key={item}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Skeleton className="h-12 w-12 rounded-xl" />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton className="h-4 w-4/5 rounded-md" />
              <Skeleton className="h-3 w-2/5 rounded-md" />
            </View>
            <Skeleton className="h-8 w-8 rounded-full" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
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
  const colors = useColors();
  const [name, setName] = useState(album.name);
  const [description, setDescription] = useState(album.description ?? "");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}} // block tap-through
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            gap: 16,
          }}
        >
          {/* Handle bar */}
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: colors.input,
              borderRadius: 2,
              alignSelf: "center",
              marginBottom: 4,
            }}
          />

          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.foreground,
              textAlign: "left",
            }}
          >
            Edit album
          </Text>

          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedForeground,
                textAlign: "right",
              }}
            >
              Album name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter a name..."
              placeholderTextColor={colors.input}
              style={{
                backgroundColor: colors.muted,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 15,
                color: colors.foreground,
                textAlign: "left",
                borderWidth: 1,
                borderColor: colors.input,
              }}
            />
          </View>

          {/* Description */}
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedForeground,
                textAlign: "right",
              }}
            >
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add an album description..."
              placeholderTextColor={colors.input}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: colors.muted,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.foreground,
                textAlign: "left",
                minHeight: 90,
                borderWidth: 1,
                borderColor: colors.input,
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
                backgroundColor: colors.muted,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: colors.mutedForeground, fontWeight: "600" }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(name.trim(), description.trim())}
              disabled={isSaving || !name.trim()}
              style={{
                flex: 2,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: colors.primary,
                alignItems: "center",
                opacity: isSaving || !name.trim() ? 0.6 : 1,
              }}
            >
              <Text
                style={{ color: colors.primaryForeground, fontWeight: "700" }}
              >
                {isSaving ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AuthorEditorModal({
  visible,
  title,
  initialAuthor,
  isSaving,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initialAuthor?: { name?: string | null; nameAr?: string | null } | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: { name: string; nameAr: string }) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(initialAuthor?.name ?? "");
  const [nameAr, setNameAr] = useState(initialAuthor?.nameAr ?? "");

  useEffect(() => {
    if (!visible) return;
    setName(initialAuthor?.name ?? "");
    setNameAr(initialAuthor?.nameAr ?? "");
  }, [initialAuthor, visible]);

  const canSave = Boolean(name.trim() || nameAr.trim());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.62)",
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 42,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.input,
              alignSelf: "center",
            }}
          />
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: colors.foreground,
              textAlign: "right",
            }}
          >
            {title}
          </Text>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.mutedForeground,
                textAlign: "right",
              }}
            >
              Arabic name
            </Text>
            <TextInput
              value={nameAr}
              onChangeText={setNameAr}
              placeholder="اسم المؤلف"
              placeholderTextColor={colors.input}
              style={{
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.input,
                backgroundColor: colors.muted,
                paddingHorizontal: 14,
                color: colors.foreground,
                textAlign: "right",
                writingDirection: "rtl",
              }}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.mutedForeground,
                textAlign: "right",
              }}
            >
              English name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Author name"
              placeholderTextColor={colors.input}
              style={{
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.input,
                backgroundColor: colors.muted,
                paddingHorizontal: 14,
                color: colors.foreground,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.muted,
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: "800" }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={!canSave || isSaving}
              onPress={() =>
                onSave({ name: name.trim(), nameAr: nameAr.trim() })
              }
              style={{
                flex: 1.5,
                height: 46,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
                opacity: !canSave || isSaving ? 0.55 : 1,
              }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text
                  style={{ color: colors.primaryForeground, fontWeight: "900" }}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ManageAlbumBooksModal({
  visible,
  books,
  attachedReferences,
  isAttaching,
  isDetaching,
  onClose,
  onAttach,
  onDetach,
  onOpenBook,
}: {
  visible: boolean;
  books: any[];
  attachedReferences: any[];
  isAttaching: boolean;
  isDetaching: boolean;
  onClose: () => void;
  onAttach: (bookId: number) => void;
  onDetach: (referenceId: number) => void;
  onOpenBook: (bookId: number) => void;
}) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const attachedBookIds = useMemo(
    () => new Set(attachedReferences.map((reference) => reference.bookId)),
    [attachedReferences],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredBooks = useMemo(() => {
    if (!normalizedQuery) return books;
    return books.filter((book) =>
      [book.nameAr, book.nameEn, ...(book.authors ?? []).map(getAuthorDisplayName)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [books, normalizedQuery]);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.62)",
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            maxHeight: "86%",
            backgroundColor: colors.card,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: "hidden",
          }}
        >
          <KeyboardAwareScrollView
            bottomOffset={ALBUM_DETAIL_KEYBOARD_OFFSET}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 18, gap: 14 }}
          >
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 999,
                backgroundColor: colors.input,
                alignSelf: "center",
              }}
            />
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "900",
                    color: colors.foreground,
                    textAlign: "right",
                  }}
                >
                  Books
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color: colors.mutedForeground,
                    textAlign: "right",
                  }}
                >
                  {attachedReferences.length} attached
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.muted,
                }}
              >
                <Icon name="X" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View
              style={{
                minHeight: 46,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.muted,
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 12,
              }}
            >
              <Icon name="Search" size={16} color={colors.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search books..."
                placeholderTextColor={colors.input}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  textAlign: "right",
                  writingDirection: "rtl",
                }}
              />
            </View>

            {attachedReferences.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: colors.mutedForeground,
                    textAlign: "right",
                  }}
                >
                  Attached
                </Text>
                {attachedReferences.map((reference) => (
                  <View
                    key={reference.id}
                    style={{
                      minHeight: 54,
                      borderRadius: 14,
                      backgroundColor: colors.muted,
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => onOpenBook(reference.bookId)}
                      style={{
                        flex: 1,
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Icon name="BookOpen" size={18} color={colors.primary} />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: "800",
                          color: colors.foreground,
                          textAlign: "right",
                          writingDirection: "rtl",
                        }}
                        numberOfLines={1}
                      >
                        {getBookDisplayName(reference.book)}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isDetaching}
                      onPress={() =>
                        Alert.alert("Remove book?", undefined, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () => onDetach(reference.id),
                          },
                        ])
                      }
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: isDetaching ? 0.45 : 1,
                      }}
                    >
                      <Icon
                        name="Trash2"
                        size={15}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: colors.mutedForeground,
                  textAlign: "right",
                }}
              >
                Library
              </Text>
              {filteredBooks.length > 0 ? (
                filteredBooks.map((book) => {
                  const attached = attachedBookIds.has(book.id);
                  return (
                    <View
                      key={book.id}
                      style={{
                        minHeight: 58,
                        borderRadius: 14,
                        backgroundColor: colors.muted,
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        gap: 10,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Pressable
                        onPress={() => onOpenBook(book.id)}
                        style={{
                          flex: 1,
                          flexDirection: "row-reverse",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: book.coverColor || colors.card,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon name="BookOpen" size={16} color="#ffffff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: colors.foreground,
                              textAlign: "right",
                              writingDirection: "rtl",
                            }}
                            numberOfLines={1}
                          >
                            {getBookDisplayName(book)}
                          </Text>
                          {book.authors?.length ? (
                            <Text
                              style={{
                                marginTop: 2,
                                fontSize: 11,
                                color: colors.mutedForeground,
                                textAlign: "right",
                              }}
                              numberOfLines={1}
                            >
                              {book.authors.map(getAuthorDisplayName).filter(Boolean).join("، ")}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                      <Pressable
                        disabled={attached || isAttaching}
                        onPress={() => onAttach(book.id)}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: attached ? colors.card : colors.primary,
                          opacity: isAttaching ? 0.6 : 1,
                        }}
                      >
                        {isAttaching && !attached ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primaryForeground}
                          />
                        ) : (
                          <Icon
                            name={attached ? "Check" : "Plus"}
                            size={17}
                            color={
                              attached
                                ? colors.mutedForeground
                                : colors.primaryForeground
                            }
                          />
                        )}
                      </Pressable>
                    </View>
                  );
                })
              ) : (
                <View
                  style={{
                    minHeight: 82,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.muted,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.mutedForeground,
                      fontWeight: "700",
                    }}
                  >
                    No books found
                  </Text>
                </View>
              )}
            </View>
          </KeyboardAwareScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Track row — normal view ───────────────────────────────────────────────────

function SwipeDeleteRow({
  children,
  onDelete,
  disabled = false,
}: {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { width } = useWindowDimensions();
  const swipeRef = useRef<any>(null);
  const isDeletingRef = useRef(false);
  const rowHeight = useSharedValue(0);
  const deleteProgress = useSharedValue(0);
  const fullSwipeThreshold = useMemo(
    () => getSwipeDeleteThreshold(width),
    [width],
  );

  const finishDelete = useCallback(() => {
    onDelete();
    isDeletingRef.current = false;
  }, [onDelete]);

  const handleSwipeWillOpen = useCallback(
    (direction: SwipeDirection) => {
      if (
        disabled ||
        direction !== SwipeDirection.LEFT ||
        isDeletingRef.current
      ) {
        swipeRef.current?.close();
        return;
      }

      isDeletingRef.current = true;
      deleteProgress.value = withTiming(
        1,
        { duration: 240, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(finishDelete)();
          }
        },
      );
    },
    [deleteProgress, disabled, finishDelete],
  );

  const containerStyle = useAnimatedStyle(() => {
    const measuredHeight = rowHeight.value;
    const height =
      measuredHeight > 0
        ? interpolate(
            deleteProgress.value,
            [0, 1],
            [measuredHeight, 0],
            Extrapolation.CLAMP,
          )
        : undefined;

    return {
      height,
      opacity: interpolate(
        deleteProgress.value,
        [0, 0.7, 1],
        [1, 0.35, 0],
        Extrapolation.CLAMP,
      ),
      overflow: "hidden",
      transform: [
        {
          translateX: interpolate(
            deleteProgress.value,
            [0, 1],
            [0, -Math.min(width * 0.18, 72)],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const renderRightActions = useCallback(
    (progress: SharedValue<number>, translation: SharedValue<number>) => (
      <SwipeDeleteAction
        progress={progress}
        translation={translation}
        actionWidth={width}
        fullSwipeThreshold={fullSwipeThreshold}
      />
    ),
    [fullSwipeThreshold, width],
  );

  return (
    <Animated.View
      onLayout={(event) => {
        if (!isDeletingRef.current) {
          rowHeight.value = event.nativeEvent.layout.height;
        }
      }}
      style={containerStyle}
    >
      <ReanimatedSwipeable
        ref={swipeRef}
        enabled={!disabled}
        friction={1.15}
        overshootFriction={8}
        overshootRight={false}
        rightThreshold={fullSwipeThreshold}
        onSwipeableWillOpen={handleSwipeWillOpen}
        renderRightActions={renderRightActions}
      >
        {children}
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

function TrackRow({
  media,
  displayIndex,
  onPress,
  onLongPress,
  onActions,
  onPlayPress,
  isRemoving,
  isSelected,
  isActiveTrack,
  isTrackPlaying,
  isTrackLoading,
  canPlay,
  selectionMode,
  trackAuthorLabel,
  searchMatch,
}: {
  media: any;
  displayIndex: number;
  onPress: () => void;
  onLongPress: () => void;
  onActions: () => void;
  onPlayPress: () => void;
  isRemoving?: boolean;
  isSelected?: boolean;
  isActiveTrack?: boolean;
  isTrackPlaying?: boolean;
  isTrackLoading?: boolean;
  canPlay?: boolean;
  selectionMode?: boolean;
  trackAuthorLabel?: string | null;
  searchMatch?: { label: string; snippet: string } | null;
}) {
  const colors = useColors();
  const duration = media.file?.duration ?? media.duration;
  const trackDate = media.blog?.blogDate ?? media.blogDate ?? media.date;
  const transcriptBadge = getTranscriptionBadgeState(media);
  const transcriptColor =
    transcriptBadge.tone === "success"
      ? colors.success
      : transcriptBadge.tone === "warn"
        ? colors.warn
        : transcriptBadge.tone === "muted"
          ? colors.mutedForeground
          : colors.primary;
  const metadata = [
    trackAuthorLabel,
    duration != null ? minuteToString(duration) : null,
    trackDate ? formatDate(trackDate, "MMM D, YYYY") : null,
  ].filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={260}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: selectionMode ? 10 : 0,
        borderRadius: selectionMode ? 14 : 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: isSelected
          ? withAlpha(colors.primary, 0.1)
          : isActiveTrack
            ? withAlpha(colors.primary, 0.08)
            : "transparent",
      }}
    >
      {selectionMode ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: isSelected ? colors.primary : colors.mutedForeground,
            backgroundColor: isSelected ? colors.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSelected ? (
            <Icon name="Check" size={13} className="text-primary-foreground" />
          ) : null}
        </View>
      ) : (
        <Pressable
          disabled={isRemoving || !canPlay}
          onPress={(event) => {
            event.stopPropagation();
            onPlayPress();
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isActiveTrack
              ? colors.primary
              : withAlpha(colors.primary, 0.1),
            opacity: isRemoving || !canPlay ? 0.45 : 1,
          }}
          accessibilityLabel={
            isTrackPlaying
              ? "Pause track"
              : isActiveTrack
                ? "Resume track"
                : "Play track"
          }
        >
          {isTrackLoading ? (
            <ActivityIndicator
              size="small"
              color={isActiveTrack ? colors.primaryForeground : colors.primary}
            />
          ) : (
            <Icon
              name={isTrackPlaying ? "Pause" : "Play"}
              size={16}
              color={isActiveTrack ? colors.primaryForeground : colors.primary}
              style={isTrackPlaying ? undefined : { marginLeft: 2 }}
            />
          )}
        </Pressable>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: isActiveTrack ? "800" : "600",
              color: isActiveTrack ? colors.primary : colors.foreground,
              textAlign: "right",
            }}
            numberOfLines={1}
          >
            {getTrackTitle(media)}
          </Text>
          {isActiveTrack ? (
            <View
              style={{
                minHeight: 22,
                borderRadius: 999,
                paddingHorizontal: 7,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(colors.primary, 0.13),
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: colors.primary,
                }}
              >
                Now
              </Text>
            </View>
          ) : null}
          {transcriptBadge.show ? (
            <View
              accessibilityLabel={transcriptBadge.label}
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(transcriptColor, 0.14),
              }}
            >
              <Icon name="FileText" size={13} color={transcriptColor} />
            </View>
          ) : null}
        </View>
        {metadata.length > 0 && (
          <Text
            style={{
              fontSize: 12,
              color: colors.mutedForeground,
              textAlign: "right",
            }}
          >
            {metadata.join(" · ")}
          </Text>
        )}
        {searchMatch?.snippet ? (
          <View
            style={{
              marginTop: 3,
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: colors.primary,
              }}
            >
              {searchMatch.label}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 11,
                color: colors.mutedForeground,
                textAlign: "right",
                writingDirection: "rtl",
              }}
              numberOfLines={1}
            >
              {searchMatch.snippet}
            </Text>
          </View>
        ) : null}
      </View>
      {isActiveTrack ? (
        <View
          style={{
            width: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: colors.primary,
            }}
          >
            {displayIndex}
          </Text>
        </View>
      ) : null}
      <Pressable
        disabled={isRemoving || selectionMode}
        onPress={(event) => {
          event.stopPropagation();
          onActions();
        }}
        hitSlop={8}
        style={{ padding: 6, opacity: isRemoving || selectionMode ? 0.45 : 1 }}
      >
        <Icon
          name="MoreHorizontal"
          size={20}
          className="text-muted-foreground"
        />
      </Pressable>
    </Pressable>
  );
}

function TrackActionRow({
  label,
  description,
  icon,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  description: string;
  icon: IconKeys;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const colors = useColors();
  const actionColor = danger ? colors.destructive : colors.foreground;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 56,
        borderRadius: 14,
        flexDirection: "row-reverse",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: danger
            ? withAlpha(colors.destructive, 0.12)
            : colors.muted,
        }}
      >
        <Icon
          name={icon}
          size={18}
          color={danger ? colors.destructive : colors.foreground}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: actionColor,
            textAlign: "right",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: 12,
            color: colors.mutedForeground,
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

function TrackActionsSheet({
  visible,
  media,
  isBusy,
  onClose,
  onMoveRequest,
  onOpenPost,
  onShare,
  onComment,
  onTranscribe,
  onResetTranscription,
  onRemove,
}: {
  visible: boolean;
  media: any | null;
  isBusy?: boolean;
  onClose: () => void;
  onMoveRequest: () => void;
  onOpenPost: () => void;
  onShare: () => void;
  onComment: () => void;
  onTranscribe: () => void;
  onResetTranscription: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const { height: windowHeight } = useWindowDimensions();
  const title =
    media?.title || media?.file?.fileName || media?.blog?.content || "Track";
  const canOpenPost = Boolean(getTrackBlogHref(media));
  const onComingSoon = () => {
    Alert.alert("Coming soon", "This action is not connected yet.");
  };
  const runAndClose = (fn: () => void) => {
    onClose();
    setTimeout(fn, 250);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxHeight: Math.min(
              Math.max(360, windowHeight * 0.72),
              windowHeight - 24,
            ),
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            backgroundColor: colors.card,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 28,
          }}
        >
          <View
            style={{
              width: 42,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.input,
              alignSelf: "center",
              marginBottom: 14,
            }}
          />
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: colors.foreground,
              textAlign: "right",
            }}
            numberOfLines={1}
          >
            {title}
          </Text>

          <ScrollView
            style={{ marginTop: 14 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            <View>
              <TrackActionRow
                label="Remove from album"
                description="Keep the post but remove this track here"
                icon="X"
                disabled={isBusy}
                danger
                onPress={onRemove}
              />
              <TrackActionRow
                label="Move to album"
                description="Choose another album for this track"
                icon="ListMusic"
                disabled={isBusy}
                onPress={() => runAndClose(onMoveRequest)}
              />
            </View>

            <Text
              style={{
                marginTop: 18,
                marginBottom: 8,
                fontSize: 12,
                fontWeight: "800",
                letterSpacing: 0.5,
                color: colors.mutedForeground,
                textAlign: "right",
                textTransform: "uppercase",
              }}
            >
              Post options
            </Text>

            <View>
              <TrackActionRow
                label="Open post"
                description="View the full post and media"
                icon="FileText"
                disabled={!canOpenPost}
                onPress={() => runAndClose(onOpenPost)}
              />
              <TrackActionRow
                label="Share"
                description="Send a web link to this post"
                icon="Share"
                onPress={() => runAndClose(onShare)}
              />
              <TrackActionRow
                label="Comment"
                description="Open the discussion for this post"
                icon="MessageSquare"
                disabled={!canOpenPost}
                onPress={() => runAndClose(onComment)}
              />
              <TrackActionRow
                label="Transcribe"
                description="Queue this audio for local Whisper"
                icon="Captions"
                disabled={isBusy || !media?.id}
                onPress={() => runAndClose(onTranscribe)}
              />
              <TrackActionRow
                label="Reset transcribe"
                description="Clear transcript and queue jobs"
                icon="RotateCcw"
                disabled={isBusy || !media?.id}
                onPress={() => runAndClose(onResetTranscription)}
              />
              <TrackActionRow
                label="Save"
                description="Keep this post in saved items"
                icon="Bookmark"
                onPress={() => runAndClose(onComingSoon)}
              />
              <TrackActionRow
                label="Like"
                description="Add this post to liked items"
                icon="Heart"
                onPress={() => runAndClose(onComingSoon)}
              />
              <TrackActionRow
                label="Delete post"
                description="Remove this post from the blog list"
                icon="Trash2"
                danger
                onPress={() => runAndClose(onComingSoon)}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TrackMoveAlbumSheet({
  visible,
  media,
  albums,
  currentAlbumId,
  isBusy,
  onClose,
  onMove,
}: {
  visible: boolean;
  media: any | null;
  albums: any[];
  currentAlbumId: number;
  isBusy?: boolean;
  onClose: () => void;
  onMove: (albumId: number) => void;
}) {
  const colors = useColors();
  const { height: windowHeight } = useWindowDimensions();
  const title =
    media?.title || media?.file?.fileName || media?.blog?.content || "Track";
  const targetAlbums = albums.filter((album) => album.id !== currentAlbumId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxHeight: Math.min(
              Math.max(320, windowHeight * 0.62),
              windowHeight - 24,
            ),
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            backgroundColor: colors.card,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 28,
          }}
        >
          <View
            style={{
              width: 42,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.input,
              alignSelf: "center",
              marginBottom: 14,
            }}
          />
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: colors.foreground,
              textAlign: "right",
            }}
            numberOfLines={1}
          >
            Move {title}
          </Text>
          {targetAlbums.length === 0 ? (
            <Text
              style={{
                paddingVertical: 16,
                fontSize: 13,
                color: colors.mutedForeground,
                textAlign: "center",
              }}
            >
              No other albums available
            </Text>
          ) : (
            <FlatList
              data={targetAlbums}
              keyExtractor={(album) => String(album.id)}
              style={{ flexGrow: 0 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <Pressable
                  disabled={isBusy}
                  onPress={() => onMove(item.id)}
                  style={{
                    minHeight: 52,
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    opacity: isBusy ? 0.5 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        ALBUM_COLORS[index % ALBUM_COLORS.length],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: "#fff",
                      }}
                    >
                      {getInitials(item.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: colors.foreground,
                        textAlign: "right",
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.mutedForeground,
                        textAlign: "right",
                      }}
                    >
                      {item._count?.medias ?? 0} tracks
                    </Text>
                  </View>
                  <Icon
                    name="ChevronLeft"
                    size={16}
                    className="text-muted-foreground"
                  />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
  const colors = useColors();
  const duration = media.file?.duration ?? media.duration;
  const trackDate = media.blog?.blogDate ?? media.blogDate ?? media.date;
  const metadata = [
    duration != null ? minuteToString(duration) : null,
    trackDate ? formatDate(trackDate, "MMM D, YYYY") : null,
  ].filter(Boolean);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
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
          <Icon
            name="ChevronDown"
            size={18}
            className="text-muted-foreground"
          />
        </Pressable>
      </View>

      {/* Index badge */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: colors.mutedForeground,
          }}
        >
          {displayIndex}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: colors.foreground,
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {media.title || media.file?.name || "Untitled"}
        </Text>
        {metadata.length > 0 && (
          <Text
            style={{
              fontSize: 12,
              color: colors.mutedForeground,
              textAlign: "right",
            }}
          >
            {metadata.join(" · ")}
          </Text>
        )}
      </View>

      {/* Drag handle indicator */}
      <Icon
        name="GripVertical"
        size={18}
        className="text-muted-foreground"
        style={{ opacity: 0.4 }}
      />
    </View>
  );
}

// ── Suggested media row ──────────────────────────────────────────────────────

function SuggestedMediaRow({
  media,
  selected,
  onPress,
  onAdd,
  onAddLongPress,
  isAdding,
}: {
  media: any;
  selected: boolean;
  onPress: () => void;
  onAdd: () => void;
  onAddLongPress?: () => void;
  isAdding?: boolean;
}) {
  const colors = useColors();
  const duration = media.file?.duration;
  const sizeLabel = formatMediaSizeMb(media.file?.fileSize ?? media.fileSize);
  const title =
    media.title || media.file?.fileName || media.blog?.content || "Untitled";
  const matchingTerms = media.matchingTerms ?? [];

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 9999,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.mutedForeground,
          backgroundColor: selected ? colors.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && <Icon name="Check" size={12} className="text-white" />}
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: colors.foreground,
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {title}
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 6,
          }}
        >
          {duration != null && (
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              {minuteToString(duration)}
            </Text>
          )}
          {sizeLabel && (
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              {sizeLabel}
            </Text>
          )}
          {media.blog?.blogDate && (
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              {formatDate(media.blog.blogDate, "MMM D, YYYY")}
            </Text>
          )}
          {matchingTerms.slice(0, 3).map((term: string) => (
            <Text key={term} style={{ fontSize: 11, color: colors.primary }}>
              {term}
            </Text>
          ))}
        </View>
      </View>

      <View
        style={{
          minWidth: 28,
          height: 24,
          paddingHorizontal: 6,
          borderRadius: 8,
          backgroundColor: colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.mutedForeground,
          }}
        >
          {media.matchScore}
        </Text>
      </View>

      <Pressable
        disabled={isAdding}
        onPress={(event) => {
          event.stopPropagation();
          onAdd();
        }}
        onLongPress={(event) => {
          event.stopPropagation();
          onAddLongPress?.();
        }}
        hitSlop={8}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          opacity: isAdding ? 0.55 : 1,
        }}
      >
        {isAdding ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Icon name="Plus" size={16} className="text-primary-foreground" />
        )}
      </Pressable>
    </Pressable>
  );
}

function SelectionFooterShell({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <View pointerEvents="box-none" style={{ alignItems: "center" }}>
      <View
        style={{
          width: "92%",
          maxWidth: 440,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 16,
          elevation: 16,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function FooterIconButton({
  icon,
  onPress,
  disabled,
  selected,
  destructive,
}: {
  icon: IconKeys;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  destructive?: boolean;
}) {
  const colors = useColors();
  const tint = destructive ? colors.destructive : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? colors.primary : colors.muted,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon
        name={icon}
        size={18}
        color={selected ? colors.primaryForeground : tint}
      />
    </Pressable>
  );
}

function FooterActionButton({
  icon,
  label,
  onPress,
  onLongPress,
  disabled,
  loading,
  variant = "primary",
}: {
  icon: IconKeys;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "muted";
}) {
  const colors = useColors();
  const primary = variant === "primary";
  const foreground = primary ? colors.primaryForeground : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || loading}
      style={{
        flex: 1,
        minWidth: 82,
        height: 44,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: primary ? colors.primary : colors.muted,
        opacity: disabled || loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <Icon name={icon} size={16} color={foreground} />
      )}
      <Text
        numberOfLines={1}
        style={{ color: foreground, fontSize: 13, fontWeight: "800" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AlbumSuggestionSelectionFooter({
  allSelected,
  selectedCount,
  isAdding,
  isDeleting,
  onToggleAll,
  onAdd,
  onAddToAlbum,
  onDelete,
}: {
  allSelected: boolean;
  selectedCount: number;
  isAdding: boolean;
  isDeleting: boolean;
  onToggleAll: () => void;
  onAdd: () => void;
  onAddToAlbum: () => void;
  onDelete: () => void;
}) {
  const busy = isAdding || isDeleting;
  return (
    <SelectionFooterShell>
      <FooterIconButton
        icon="CheckCheck"
        onPress={onToggleAll}
        selected={allSelected}
        disabled={busy}
      />
      <FooterActionButton
        icon="Plus"
        label={`${selectedCount}`}
        onPress={onAdd}
        onLongPress={onAddToAlbum}
        loading={isAdding}
        disabled={selectedCount === 0 || isDeleting}
      />
      <FooterIconButton
        icon="Trash2"
        onPress={onDelete}
        disabled={busy || selectedCount === 0}
        destructive
      />
      <FooterActionButton
        icon="Plus"
        label={`${selectedCount}`}
        onPress={onAddToAlbum}
        disabled={busy || selectedCount === 0}
        variant="muted"
      />
    </SelectionFooterShell>
  );
}

function AlbumTrackSelectionFooter({
  selectedCount,
  isMoving,
  isRemoving,
  onMove,
  onRemove,
}: {
  selectedCount: number;
  isMoving: boolean;
  isRemoving: boolean;
  onMove: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  return (
    <SelectionFooterShell>
      <Text
        style={{
          minWidth: 28,
          textAlign: "center",
          fontSize: 12,
          fontWeight: "800",
          color: colors.mutedForeground,
        }}
      >
        {selectedCount}
      </Text>
      <FooterActionButton
        icon="ListMusic"
        label="Move"
        onPress={onMove}
        loading={isMoving}
        disabled={isRemoving}
      />
      <Pressable
        onPress={onRemove}
        disabled={isMoving || isRemoving}
        style={{
          flex: 1,
          height: 44,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: withAlpha(colors.destructive, 0.12),
          opacity: isMoving || isRemoving ? 0.6 : 1,
        }}
      >
        {isRemoving ? (
          <ActivityIndicator size="small" color={colors.destructive} />
        ) : (
          <Icon name="Trash2" size={16} color={colors.destructive} />
        )}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: colors.destructive,
          }}
        >
          Remove
        </Text>
      </Pressable>
    </SelectionFooterShell>
  );
}

function DeleteSuggestionConfirmSheet({
  visible,
  count,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  count: number;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const colors = useColors();
  return (
    <FloatingBottomSheet
      visible={visible}
      onClose={onCancel}
      title="Delete selected item"
      accessibilityLabel="Confirm deleting selected suggestion blogs"
    >
      <View style={{ gap: 16, padding: 18, paddingTop: 8 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 16,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          Delete {count} blog item{count === 1 ? "" : "s"}?
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 13,
            lineHeight: 19,
            textAlign: "center",
          }}
        >
          This removes the selected blog item from the app. It will not just
          hide the suggestion.
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={onCancel}
            disabled={isDeleting}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.muted,
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "800" }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={isDeleting}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(colors.destructive, 0.14),
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <Text style={{ color: colors.destructive, fontWeight: "900" }}>
                Delete
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </FloatingBottomSheet>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AlbumDetailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const colors = useColors();
  const floatingFooterInset = useFloatingFooterInset();
  const activeAudioBlog = useAudioStore((s) => s.blog);
  const activeAudioIsPlaying = useAudioStore((s) => s.isPlaying);
  const activeAudioIsLoading = useAudioStore((s) => s.isLoading);
  const loadAudio = useAudioStore((s) => s.loadAudio);
  const playAudio = useAudioStore((s) => s.play);
  const pauseAudio = useAudioStore((s) => s.pause);
  const albumScroll = useScrollChrome<any>();
  const localTranscriberBaseUrl = useAppSettingsStore(
    (s) => s.localTranscriberBaseUrl,
  );
  const transcriberUrl = getDefaultTranscriberUrl(localTranscriberBaseUrl);
  const { enqueue: enqueueTranscription } = useTranscriptionQueue(undefined, {
    autoLoad: false,
    reloadOnEnqueue: false,
  });
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const id = Number(albumId);

  const {
    data: album,
    isFetching: isFetchingAlbum,
    isLoading,
    refetch: refetchAlbum,
  } = useQuery(_trpc.album.getAlbum.queryOptions({ id }));
  const { data: albums = [], refetch: refetchAlbums } = useQuery(
    _trpc.album.getAlbums.queryOptions(),
  );
  const { data: authors = [] } = useQuery(
    _trpc.album.getAuthors.queryOptions(),
  );
  const { data: booksData, refetch: refetchBooks } = useQuery(
    _trpc.book.getBooks.queryOptions({ limit: 100 }),
  );

  // Local track order state (mirrors server, mutated on reorder actions)
  const [localTracks, setLocalTracks] = useState<any[] | null>(null);
  const [activeAlbumTab, setActiveAlbumTab] =
    useState<AlbumDetailTab>("tracks");
  const [reorderMode, setReorderMode] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [trackSearchActive, setTrackSearchActive] = useState(false);
  const [trackSearchQuery, setTrackSearchQuery] = useState("");
  const [selectedTrackForActions, setSelectedTrackForActions] = useState<
    any | null
  >(null);
  const [trackMoveTarget, setTrackMoveTarget] = useState<any | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(
    new Set(),
  );
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<
    Set<number>
  >(new Set());
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<
    Set<number>
  >(new Set());
  const [suggestionsRequested, setSuggestionsRequested] = useState(false);
  const [suggestionKeyword, setSuggestionKeyword] = useState("");
  const [addingSuggestionIds, setAddingSuggestionIds] = useState<Set<number>>(
    new Set(),
  );
  const [albumModalMediaIds, setAlbumModalMediaIds] = useState<number[] | null>(
    null,
  );
  const [deleteSuggestionConfirmVisible, setDeleteSuggestionConfirmVisible] =
    useState(false);
  const [bookManagerVisible, setBookManagerVisible] = useState(false);
  const [authorEditorState, setAuthorEditorState] = useState<{
    mode: "create" | "edit";
    author?: any | null;
  } | null>(null);
  const autoLoadedSuggestionAlbumRef = useRef<number | null>(null);
  const resetQueueTrackRef = useRef<any | null>(null);
  const trackSearchInputRef = useRef<TextInput>(null);

  const rawTracks: any[] = useMemo(
    () => localTracks ?? album?.medias ?? [],
    [album?.medias, localTracks],
  );
  const tracks = useMemo(
    () => (reorderMode ? rawTracks : sortMediaByTelegramDate(rawTracks)),
    [rawTracks, reorderMode],
  );
  const normalizedTrackSearchQuery = normalizeAlbumSearchText(trackSearchQuery);
  const trackSearchState = useMemo(() => {
    if (!normalizedTrackSearchQuery) {
      return {
        tracks,
        matchesById: new Map<number, { label: string; snippet: string }>(),
      };
    }

    const matchesById = new Map<number, { label: string; snippet: string }>();
    const filteredTracks = tracks.filter((media) => {
      const match = getTrackSearchMatch(media, trackSearchQuery, album?.author);
      if (!match) return false;
      matchesById.set(media.id, match);
      return true;
    });

    return { tracks: filteredTracks, matchesById };
  }, [album?.author, normalizedTrackSearchQuery, trackSearchQuery, tracks]);
  const displayedTracks = trackSearchState.tracks;
  const hasTrackSearch = normalizedTrackSearchQuery.length > 0;
  const bgColor = albumColor(id);
  const selectedSuggestionCount = selectedSuggestionIds.size;
  const selectedTrackCount = selectedTrackIds.size;
  const normalizedSuggestionKeyword = suggestionKeyword.trim();
  const libraryBooks = Array.isArray((booksData as any)?.data)
    ? ((booksData as any).data as any[])
    : [];
  const attachedBookReferences = Array.isArray((album as any)?.bookReferences)
    ? ((album as any).bookReferences as any[])
    : [];
  const albumAuthorId = album?.author?.id ?? null;
  const trackAuthors = useMemo(() => {
    const seen = new Set<number>();
    const uniqueAuthors: any[] = [];
    for (const track of rawTracks) {
      const author = track?.author;
      if (!author?.id || seen.has(author.id)) continue;
      seen.add(author.id);
      uniqueAuthors.push(author);
    }
    return uniqueAuthors;
  }, [rawTracks]);
  const authorOptions = useMemo(() => {
    const byId = new Map<number, any>();
    for (const author of trackAuthors) {
      if (author?.id) byId.set(author.id, author);
    }
    if (album?.author?.id) byId.set(album.author.id, album.author);
    for (const author of authors as any[]) {
      if (author?.id && byId.has(author.id)) byId.set(author.id, author);
    }
    return Array.from(byId.values());
  }, [album?.author, authors, trackAuthors]);

  const {
    data: suggestedMedia = [],
    isFetching: isFetchingSuggestions,
    refetch: refetchSuggestedMedia,
  } = useQuery({
    ..._trpc.album.getSuggestedMedia.queryOptions({
      albumId: id,
      limit: SUGGESTION_POOL_LIMIT,
      keyword: normalizedSuggestionKeyword || undefined,
    }),
    enabled: suggestionsRequested,
  });
  const visibleSuggestedMedia = suggestedMedia.filter(
    (media: any) => !dismissedSuggestionIds.has(media.id),
  );
  const displayedSuggestedMedia = visibleSuggestedMedia.slice(
    0,
    SUGGESTION_DISPLAY_LIMIT,
  );
  const allDisplayedSuggestionsSelected =
    displayedSuggestedMedia.length > 0 &&
    selectedSuggestionCount === displayedSuggestedMedia.length;
  const selectedSuggestionMediaIds = useMemo(
    () => Array.from(selectedSuggestionIds),
    [selectedSuggestionIds],
  );
  const activeAudioBlogId = activeAudioBlog?.id ?? null;
  const activeAudioMediaId = (activeAudioBlog?.audio as any)?.mediaId ?? null;
  const hasNoMoreSuggestions =
    suggestionsRequested &&
    !isFetchingSuggestions &&
    suggestedMedia.length > 0 &&
    visibleSuggestedMedia.length <= SUGGESTION_DISPLAY_LIMIT;

  const { mutate: saveOrder, isPending: isSavingOrder } = useMutation(
    _trpc.album.reorderTracks.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: _trpc.album.getAlbum.queryKey({ id }),
        });
        setLocalTracks(null);
        setReorderMode(false);
      },
      onError: (e) => Alert.alert("Error", e.message),
    }),
  );

  const {
    mutate: updateAlbum,
    mutateAsync: updateAlbumAsync,
    isPending: isUpdating,
  } = useMutation(
    _trpc.album.updateAlbum.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: _trpc.album.getAlbum.queryKey({ id }),
        });
        qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() });
        setEditModalVisible(false);
      },
      onError: (e) => Alert.alert("Error", e.message),
    }),
  );

  const { mutateAsync: createAuthor, isPending: isCreatingAuthor } =
    useMutation(_trpc.album.createAuthor.mutationOptions());

  const { mutateAsync: updateAuthor, isPending: isUpdatingAuthor } =
    useMutation(_trpc.album.updateAuthor.mutationOptions());

  const { mutate: addSuggestedMedia, isPending: isAddingSuggestions } =
    useMutation(
      _trpc.album.addMediaToAlbum.mutationOptions({
        onSuccess: (result, variables) => {
          qc.invalidateQueries({
            queryKey: _trpc.album.getAlbum.queryKey({ id }),
          });
          qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() });
          qc.invalidateQueries({
            queryKey: _trpc.album.getSuggestedMedia.queryKey({
              albumId: id,
              limit: SUGGESTION_POOL_LIMIT,
              keyword: normalizedSuggestionKeyword || undefined,
            }),
          });
          const addedIds = new Set(variables.mediaIds);
          setDismissedSuggestionIds((prev) => new Set([...prev, ...addedIds]));
          setSelectedSuggestionIds(new Set());
          if (result.added > 0) {
            Toast.show(
              `${result.added} audio item${result.added === 1 ? "" : "s"} added`,
              {
                type: "success",
                position: "bottom",
              },
            );
          }
        },
        onError: (e) => Alert.alert("Error", e.message),
      }),
    );

  const { mutateAsync: addOneSuggestedMedia } = useMutation(
    _trpc.album.addMediaToAlbum.mutationOptions(),
  );

  const {
    mutateAsync: deleteSuggestionBlog,
    isPending: isDeletingSuggestions,
  } = useMutation(_trpc.blog.deleteBlog.mutationOptions());

  const { mutate: removeMediaFromAlbum, isPending: isRemovingMedia } =
    useMutation(
      _trpc.album.removeMediaFromAlbum.mutationOptions({
        onSuccess: async () => {
          await Promise.all([
            qc.invalidateQueries({
              queryKey: _trpc.album.getAlbum.queryKey({ id }),
            }),
            qc.invalidateQueries({
              queryKey: _trpc.album.getAlbums.queryKey(),
            }),
          ]);
          setLocalTracks(null);
        },
        onError: (e) => {
          Alert.alert("Error", e.message);
          setLocalTracks(null);
        },
      }),
    );

  const {
    mutate: removeSelectedMediaFromAlbum,
    isPending: isRemovingSelectedMedia,
  } = useMutation(
    _trpc.album.removeMediaFromAlbumBulk.mutationOptions({
      onSuccess: async (result) => {
        await Promise.all([
          qc.invalidateQueries({
            queryKey: _trpc.album.getAlbum.queryKey({ id }),
          }),
          qc.invalidateQueries({
            queryKey: _trpc.album.getAlbums.queryKey(),
          }),
        ]);
        Toast.show(
          `${result.removed} track${result.removed === 1 ? "" : "s"} removed`,
          {
            type: "success",
            position: "bottom",
          },
        );
        setSelectedTrackIds(new Set());
        setLocalTracks(null);
      },
      onError: (e) => {
        Alert.alert("Error", e.message);
        setLocalTracks(null);
      },
    }),
  );

  const { mutate: moveMediaToAlbum, isPending: isMovingMedia } = useMutation(
    _trpc.album.addMediaToAlbum.mutationOptions({
      onSuccess: async (_result, variables) => {
        await Promise.all([
          qc.invalidateQueries({
            queryKey: _trpc.album.getAlbum.queryKey({ id }),
          }),
          qc.invalidateQueries({
            queryKey: _trpc.album.getAlbum.queryKey({ id: variables.albumId }),
          }),
          qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() }),
        ]);
        setSelectedTrackForActions(null);
        setSelectedTrackIds(new Set());
        setLocalTracks(null);
      },
      onError: (e) => {
        Alert.alert("Error", e.message);
        setLocalTracks(null);
      },
    }),
  );

  const { mutate: resetTrackTranscription, isPending: isResettingTrack } =
    useMutation(
      _trpc.blog.resetTranscript.mutationOptions({
        onSuccess: async () => {
          await qc.invalidateQueries({
            queryKey: _trpc.album.getAlbum.queryKey({ id }),
          });
          setSelectedTrackForActions(null);
          const media = resetQueueTrackRef.current;
          resetQueueTrackRef.current = null;
          Alert.alert("Queue for transcribing", undefined, [
            { text: "No", style: "cancel" },
            {
              text: "Yes",
              onPress: () => {
                void queueTrackTranscription(media);
              },
            },
          ]);
        },
        onError: (e) => {
          resetQueueTrackRef.current = null;
          Alert.alert("Error", e.message);
        },
      }),
    );

  const { mutate: saveSuggestionKeywords } = useMutation(
    _trpc.album.updateSuggestionKeywords.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: _trpc.album.getAlbum.queryKey({ id }),
        });
      },
      onError: (e) => Alert.alert("Error", e.message),
    }),
  );

  useEffect(() => {
    if (activeAlbumTab !== "tracks" && selectedTrackCount > 0) {
      setSelectedTrackIds(new Set());
    }
  }, [activeAlbumTab, selectedTrackCount]);

  useEffect(() => {
    if (!trackSearchActive) return;
    const timeout = setTimeout(() => {
      trackSearchInputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timeout);
  }, [trackSearchActive]);

  useEffect(() => {
    if (!album?.id || autoLoadedSuggestionAlbumRef.current === album.id) return;

    const savedKeywords = ((album as any).suggestionKeywords ?? "").trim();
    autoLoadedSuggestionAlbumRef.current = album.id;
    setSuggestionKeyword(savedKeywords);
    setSuggestionsRequested(Boolean(savedKeywords));
    setSelectedSuggestionIds(new Set());
    setDismissedSuggestionIds(new Set());
  }, [album]);

  function openTrackSearch() {
    setActiveAlbumTab("tracks");
    setReorderMode(false);
    setSelectedTrackIds(new Set());
    setTrackSearchActive(true);
  }

  function closeTrackSearch() {
    setTrackSearchActive(false);
    setTrackSearchQuery("");
  }

  const { mutate: attachBook, isPending: isAttachingBook } = useMutation(
    _trpc.album.attachBook.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: _trpc.album.getAlbum.queryKey({ id }),
        });
        qc.invalidateQueries({
          queryKey: _trpc.book.getBooks.queryKey({ limit: 100 }),
        });
      },
      onError: (e) => Alert.alert("Error", e.message),
    }),
  );

  const { mutate: detachBook, isPending: isDetachingBook } = useMutation(
    _trpc.album.detachBook.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: _trpc.album.getAlbum.queryKey({ id }),
        });
        qc.invalidateQueries({
          queryKey: _trpc.book.getBooks.queryKey({ limit: 100 }),
        });
      },
      onError: (e) => Alert.alert("Error", e.message),
    }),
  );

  async function refreshAlbumAuthorData() {
    await Promise.all([
      qc.invalidateQueries({
        queryKey: _trpc.album.getAlbum.queryKey({ id }),
      }),
      qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() }),
      qc.invalidateQueries({ queryKey: _trpc.album.getAuthors.queryKey() }),
    ]);
  }

  async function toggleAlbumAuthor(authorId: number) {
    try {
      await updateAlbumAsync({
        id,
        authorId: albumAuthorId === authorId ? null : authorId,
      });
      await refreshAlbumAuthorData();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Could not update author.",
      );
    }
  }

  async function saveAuthor(values: { name: string; nameAr: string }) {
    const displayName = values.name || values.nameAr;
    if (!displayName.trim()) return;

    try {
      if (authorEditorState?.mode === "edit" && authorEditorState.author?.id) {
        await updateAuthor({
          id: authorEditorState.author.id,
          name: displayName,
          nameAr: values.nameAr || null,
        });
      } else {
        const author = await createAuthor({
          name: displayName,
          nameAr: values.nameAr || undefined,
        });
        await updateAlbumAsync({ id, authorId: author.id });
      }
      setAuthorEditorState(null);
      await refreshAlbumAuthorData();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Could not save author.",
      );
    }
  }

  // When entering reorder mode, snapshot current server tracks into local state
  function enterReorderMode() {
    setSelectedTrackIds(new Set());
    setLocalTracks([...tracks]);
    setReorderMode(true);
  }

  function cancelReorder() {
    setLocalTracks(null);
    setReorderMode(false);
  }

  function commitOrder() {
    const order = tracks.map((media, i) => ({
      mediaId: media.id,
      index: i + 1,
    }));
    saveOrder({ albumId: id, order });
  }

  function toggleTrackSelection(mediaId: number) {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  }

  function startTrackSelection(mediaId: number) {
    setSelectedTrackForActions(null);
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      next.add(mediaId);
      return next;
    });
  }

  function clearTrackSelection() {
    setSelectedTrackIds(new Set());
  }

  function removeSelectedTracksFromAlbum() {
    const mediaIds = Array.from(selectedTrackIds);
    if (mediaIds.length === 0) return;
    setLocalTracks((prev) =>
      (prev ?? tracks).filter((media) => !selectedTrackIds.has(media.id)),
    );
    removeSelectedMediaFromAlbum({ albumId: id, mediaIds });
  }

  const moveTrack = useCallback(
    (fromIdx: number, toIdx: number) => {
      setLocalTracks((prev) => {
        const arr = [...(prev ?? tracks)];
        const [item] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, item);
        return arr;
      });
    },
    [tracks],
  );

  function toggleSuggestion(mediaId: number) {
    setSelectedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  }

  function selectAllSuggestions() {
    setSelectedSuggestionIds(
      new Set(displayedSuggestedMedia.map((media: any) => media.id)),
    );
  }

  function clearSuggestionSelection() {
    setSelectedSuggestionIds(new Set());
  }

  function openSelectedSuggestionAlbumModal() {
    if (selectedSuggestionMediaIds.length === 0) return;
    setAlbumModalMediaIds(selectedSuggestionMediaIds);
  }

  function openSingleSuggestionAlbumModal(mediaId: number) {
    setAlbumModalMediaIds([mediaId]);
  }

  function openDeleteSelectedSuggestions() {
    if (selectedSuggestionCount === 0) return;
    setDeleteSuggestionConfirmVisible(true);
  }

  async function confirmDeleteSelectedSuggestions() {
    if (selectedSuggestionCount === 0 || isDeletingSuggestions) return;

    const selectedMedia = displayedSuggestedMedia.filter((media: any) =>
      selectedSuggestionIds.has(media.id),
    );
    const mediaIds = selectedMedia.map((media: any) => media.id);
    const blogIds = Array.from(
      new Set(
        selectedMedia
          .map((media: any) => media?.blog?.id ?? media?.blogId)
          .filter(
            (blogId: unknown): blogId is number => typeof blogId === "number",
          ),
      ),
    );

    if (blogIds.length === 0) {
      setDismissedSuggestionIds((prev) => new Set([...prev, ...mediaIds]));
      setSelectedSuggestionIds(new Set());
      setDeleteSuggestionConfirmVisible(false);
      return;
    }

    try {
      await Promise.all(
        blogIds.map((blogId) => deleteSuggestionBlog({ id: blogId })),
      );
      setDismissedSuggestionIds((prev) => new Set([...prev, ...mediaIds]));
      setSelectedSuggestionIds(new Set());
      setDeleteSuggestionConfirmVisible(false);
      await Promise.all([
        qc.invalidateQueries({
          queryKey: _trpc.album.getSuggestedMedia.queryKey({
            albumId: id,
            limit: SUGGESTION_POOL_LIMIT,
            keyword: normalizedSuggestionKeyword || undefined,
          }),
        }),
        qc.invalidateQueries({ queryKey: _trpc.blog.posts.queryKey() }),
      ]);
      Toast.show(
        `${blogIds.length} blog item${blogIds.length === 1 ? "" : "s"} deleted`,
        { type: "success", position: "bottom" },
      );
    } catch (error) {
      Alert.alert(
        "Could not delete",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  }

  function addSelectedSuggestions() {
    if (selectedSuggestionMediaIds.length === 0) return;
    addSuggestedMedia({ albumId: id, mediaIds: selectedSuggestionMediaIds });
  }

  function suggestMoreForAlbum() {
    setSuggestionsRequested(true);
    setSelectedSuggestionIds(new Set());
    setDismissedSuggestionIds(new Set());
    saveSuggestionKeywords({
      id,
      suggestionKeywords: normalizedSuggestionKeyword,
    });
    void refetchSuggestedMedia();
  }

  const refreshAlbumScreen = useCallback(() => {
    void Promise.all([
      refetchAlbum(),
      refetchAlbums(),
      refetchBooks(),
      suggestionsRequested ? refetchSuggestedMedia() : Promise.resolve(),
    ]);
  }, [
    refetchAlbum,
    refetchAlbums,
    refetchBooks,
    refetchSuggestedMedia,
    suggestionsRequested,
  ]);

  async function addOneSuggestion(media: any) {
    const mediaId = media.id;
    if (addingSuggestionIds.has(mediaId)) return;

    setAddingSuggestionIds((prev) => new Set(prev).add(mediaId));

    try {
      const result = await addOneSuggestedMedia({
        albumId: id,
        mediaIds: [mediaId],
      });

      if (result.added > 0) {
        setLocalTracks((prev) => {
          const base = prev ?? tracks;
          if (base.some((track) => track.id === mediaId)) return base;
          return sortMediaByTelegramDate([...base, media]);
        });
        qc.setQueryData(_trpc.album.getAlbums.queryKey(), (old: any) =>
          Array.isArray(old)
            ? old.map((albumItem) =>
                albumItem.id === id
                  ? {
                      ...albumItem,
                      _count: {
                        ...albumItem._count,
                        medias: (albumItem._count?.medias ?? 0) + 1,
                      },
                    }
                  : albumItem,
              )
            : old,
        );
      }

      setDismissedSuggestionIds((prev) => new Set(prev).add(mediaId));
      if (result.added > 0) {
        Toast.show("Added to album", {
          type: "success",
          position: "bottom",
        });
      }
      setSelectedSuggestionIds((prev) => {
        if (!prev.has(mediaId)) return prev;
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    } catch (error) {
      Alert.alert(
        "Add failed",
        error instanceof Error
          ? error.message
          : "Could not add this audio to the album.",
      );
    } finally {
      setAddingSuggestionIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  }

  function dismissSuggestion(mediaId: number) {
    setDismissedSuggestionIds((prev) => {
      const next = new Set(prev);
      next.add(mediaId);
      return next;
    });
    setSelectedSuggestionIds((prev) => {
      if (!prev.has(mediaId)) return prev;
      const next = new Set(prev);
      next.delete(mediaId);
      return next;
    });
  }

  function handleAlbumModalAdded(targetAlbum: { id: number; name: string }) {
    const mediaIds = albumModalMediaIds ?? [];
    if (mediaIds.length > 0) {
      setDismissedSuggestionIds((prev) => new Set([...prev, ...mediaIds]));
      setSelectedSuggestionIds((prev) => {
        const next = new Set(prev);
        mediaIds.forEach((mediaId) => next.delete(mediaId));
        return next;
      });
    }
    void Promise.all([
      qc.invalidateQueries({
        queryKey: _trpc.album.getAlbum.queryKey({ id }),
      }),
      qc.invalidateQueries({
        queryKey: _trpc.album.getAlbum.queryKey({ id: targetAlbum.id }),
      }),
      qc.invalidateQueries({
        queryKey: _trpc.album.getSuggestedMedia.queryKey({
          albumId: id,
          limit: SUGGESTION_POOL_LIMIT,
          keyword: normalizedSuggestionKeyword || undefined,
        }),
      }),
    ]);
  }

  function removeTrackFromAlbum(mediaId: number) {
    setLocalTracks((prev) =>
      (prev ?? tracks).filter((media) => media.id !== mediaId),
    );
    setSelectedTrackForActions(null);
    removeMediaFromAlbum({ albumId: id, mediaId });
  }

  function isActiveAlbumTrack(media: any) {
    const blogId = getTrackBlogId(media);
    const mediaId = getTrackMediaId(media);
    return Boolean(
      (blogId && activeAudioBlogId === blogId) ||
      (mediaId && activeAudioMediaId === mediaId),
    );
  }

  async function handleTrackPlaybackPress(media: any) {
    if (selectedTrackCount > 0) return;

    const isActiveTrack = isActiveAlbumTrack(media);
    if (isActiveTrack && activeAudioIsPlaying) {
      await pauseAudio();
      return;
    }

    if (isActiveTrack) {
      await playAudio();
      return;
    }

    const albumQueue = buildAlbumTrackQueue(tracks, album);
    const audioItem = buildAlbumTrackAudioItem(media, album, albumQueue);
    if (!audioItem) {
      Toast.show("Audio file is not available", {
        type: "error",
        position: "bottom",
      });
      return;
    }

    await loadAudio(audioItem);
    if (!useAudioStore.getState().error) {
      await useAudioStore.getState().play();
    }
  }

  function moveTrackToAlbum(targetAlbumId: number) {
    const selectedMediaIds = Array.from(selectedTrackIds);
    const mediaIds =
      selectedMediaIds.length > 0
        ? selectedMediaIds
        : [trackMoveTarget?.id ?? selectedTrackForActions?.id].filter(
            (mediaId): mediaId is number => typeof mediaId === "number",
          );
    if (mediaIds.length === 0) return;
    const movingIds = new Set(mediaIds);
    setLocalTracks((prev) =>
      (prev ?? tracks).filter((media) => !movingIds.has(media.id)),
    );
    setTrackMoveTarget(null);
    setSelectedTrackForActions(null);
    moveMediaToAlbum({ albumId: targetAlbumId, mediaIds });
  }

  function openTrackMovePicker() {
    setTrackMoveTarget(selectedTrackForActions);
  }

  function openSelectedTrackMovePicker() {
    if (selectedTrackCount === 0) return;
    setTrackMoveTarget({
      title: `${selectedTrackCount} selected tracks`,
      bulk: true,
    });
  }

  function openSelectedTrackPost(openComments = false) {
    const href = getTrackBlogHref(selectedTrackForActions);
    if (!href) return;
    if (openComments) {
      router.push({ pathname: href as any, params: { openComments: "1" } });
      return;
    }
    router.push(href as any);
  }

  async function shareSelectedTrackPost() {
    const blogId =
      selectedTrackForActions?.blog?.id ?? selectedTrackForActions?.blogId;
    if (!blogId) return;
    const webUrl = `${getWebUrl()}/blog/${encodeURIComponent(String(blogId))}`;
    await Share.share({
      message: `Check out this post: ${webUrl}`,
      url: webUrl,
    });
  }

  async function queueTrackTranscription(media: any | null) {
    if (!media?.id) return;
    const telegramFileId =
      media.file?.source === "vercel_blob" ? null : media.file?.fileId;
    let reachableAudioUrl = getMediaFileUrl(media.file);
    reachableAudioUrl =
      reachableAudioUrl?.startsWith("http://") ||
      reachableAudioUrl?.startsWith("https://")
        ? reachableAudioUrl
        : null;

    if (!telegramFileId && !reachableAudioUrl) {
      Alert.alert(
        "Cannot transcribe yet",
        "This audio does not have a reachable file source to queue.",
      );
      return;
    }

    try {
      if (!reachableAudioUrl && telegramFileId) {
        const resolved = await getTelegramFileUrl(telegramFileId);
        reachableAudioUrl =
          resolved?.url?.startsWith("http://") ||
          resolved?.url?.startsWith("https://")
            ? resolved.url
            : null;
      }

      if (!reachableAudioUrl) {
        throw new Error(
          "Could not resolve a reachable audio URL for this job.",
        );
      }

      await enqueueTranscription({
        mediaId: media.id,
        telegramFileId: telegramFileId ?? null,
        audioUrl: reachableAudioUrl,
        language: "ar",
        transcriberUrl,
      });
      await refetchAlbum();
      Alert.alert("Queued", "Added to transcription queue.");
    } catch (error) {
      Alert.alert(
        "Could not queue transcription",
        error instanceof Error
          ? error.message
          : "This audio could not be added to the transcription queue.",
      );
    }
  }

  async function queueSelectedTrackTranscription() {
    await queueTrackTranscription(selectedTrackForActions);
  }

  function resetSelectedTrackTranscription() {
    const media = selectedTrackForActions;
    const mediaId = media?.id;
    if (!mediaId) return;
    Alert.alert(
      "Reset transcription?",
      "Clear the saved transcript and queued jobs for this track.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetQueueTrackRef.current = media;
            resetTrackTranscription({ mediaId });
          },
        },
      ],
    );
  }

  useFloatingFooterLayer({
    id: `album-${id}-track-selection-footer`,
    priority: 20,
    visible: selectedTrackCount > 0,
    render: () => (
      <AlbumTrackSelectionFooter
        selectedCount={selectedTrackCount}
        isMoving={isMovingMedia}
        isRemoving={isRemovingSelectedMedia}
        onMove={openSelectedTrackMovePicker}
        onRemove={removeSelectedTracksFromAlbum}
      />
    ),
  });

  useFloatingFooterLayer({
    id: `album-${id}-suggestion-selection-footer`,
    priority: 30,
    visible: selectedSuggestionCount > 0,
    render: () => (
      <AlbumSuggestionSelectionFooter
        allSelected={allDisplayedSuggestionsSelected}
        selectedCount={selectedSuggestionCount}
        isAdding={isAddingSuggestions}
        isDeleting={isDeletingSuggestions}
        onToggleAll={
          allDisplayedSuggestionsSelected
            ? clearSuggestionSelection
            : selectAllSuggestions
        }
        onAdd={addSelectedSuggestions}
        onAddToAlbum={openSelectedSuggestionAlbumModal}
        onDelete={openDeleteSelectedSuggestions}
      />
    ),
  });

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
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.muted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>

          {trackSearchActive ? (
            <View
              style={{
                flex: 1,
                minHeight: 44,
                marginHorizontal: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.muted,
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 12,
              }}
            >
              <Icon name="Search" size={16} color={colors.mutedForeground} />
              <TextInput
                ref={trackSearchInputRef}
                value={trackSearchQuery}
                onChangeText={setTrackSearchQuery}
                placeholder="Search tracks..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 14,
                  textAlign: "right",
                  writingDirection: "rtl",
                  paddingVertical: 0,
                }}
              />
            </View>
          ) : (
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: colors.foreground,
                flex: 1,
                textAlign: "center",
                marginHorizontal: 8,
              }}
              numberOfLines={1}
            >
              {album?.name ?? "Album"}
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: 8 }}>
            {trackSearchActive ? (
              <Pressable
                onPress={closeTrackSearch}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="X" size={18} className="text-muted-foreground" />
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={openTrackSearch}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name="Search"
                    size={17}
                    className="text-muted-foreground"
                  />
                </Pressable>
                <Pressable
                  onPress={() => setEditModalVisible(true)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name="Pencil"
                    size={16}
                    className="text-muted-foreground"
                  />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {isLoading ? (
          <AlbumDetailSkeleton />
        ) : !album ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: colors.mutedForeground }}>
              Album not found
            </Text>
          </View>
        ) : (
          <KeyboardAwareScrollView
            ref={albumScroll.ref}
            showsVerticalScrollIndicator={false}
            bottomOffset={
              activeAlbumTab === "add" ? ALBUM_DETAIL_KEYBOARD_OFFSET : 96
            }
            contentContainerStyle={{
              paddingBottom: Math.max(
                activeAlbumTab === "add" ? 140 : 80,
                floatingFooterInset + 32,
              ),
            }}
            disableScrollOnKeyboardHide
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            onScroll={albumScroll.onScroll}
            scrollEventThrottle={albumScroll.scrollEventThrottle}
            refreshControl={
              <RefreshControl
                refreshing={isFetchingAlbum && !isLoading}
                onRefresh={refreshAlbumScreen}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {/* Hero */}
            <View
              style={{
                alignItems: "center",
                paddingHorizontal: 24,
                paddingTop: 16,
                paddingBottom: 24,
                gap: 10,
              }}
            >
              {/* Art — white initials on brand color, intentional */}
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
                <Text
                  style={{ fontSize: 52, fontWeight: "800", color: "#fff" }}
                >
                  {getInitials(album.name)}
                </Text>
              </View>

              {/* Name */}
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.foreground,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                {album.name}
              </Text>

              {/* Authors */}
              <View style={{ width: "100%", gap: 8, alignItems: "center" }}>
                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  {album.author ? (
                    <View
                      style={{
                        minHeight: 30,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: withAlpha(colors.primary, 0.16),
                      }}
                    >
                      <Icon name="User" size={14} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: "900",
                        }}
                      >
                        {getAuthorDisplayName(album.author)}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.mutedForeground,
                        fontWeight: "700",
                      }}
                    >
                      Track authors shown per audio
                    </Text>
                  )}
                  <Pressable
                    onPress={() =>
                      setAuthorEditorState({ mode: "create", author: null })
                    }
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.muted,
                    }}
                  >
                    <Icon name="Plus" size={15} color={colors.primary} />
                  </Pressable>
                </View>

                {authorOptions.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
                  >
                    {authorOptions.map((author) => {
                      const selected = albumAuthorId === author.id;
                      return (
                        <View
                          key={author.id}
                          style={{
                            flexDirection: "row-reverse",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Pressable
                            disabled={isUpdating}
                            onPress={() => {
                              void toggleAlbumAuthor(author.id);
                            }}
                            style={{
                              minHeight: 32,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              flexDirection: "row-reverse",
                              alignItems: "center",
                              gap: 6,
                              backgroundColor: selected
                                ? colors.primary
                                : colors.card,
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            <Icon
                              name={selected ? "Check" : "User"}
                              size={13}
                              color={
                                selected
                                  ? colors.primaryForeground
                                  : colors.mutedForeground
                              }
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "800",
                                color: selected
                                  ? colors.primaryForeground
                                  : colors.foreground,
                              }}
                              numberOfLines={1}
                            >
                              {getAuthorDisplayName(author)}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              setAuthorEditorState({ mode: "edit", author })
                            }
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 999,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: colors.card,
                            }}
                          >
                            <Icon
                              name="Edit2"
                              size={13}
                              color={colors.mutedForeground}
                            />
                          </Pressable>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>

              {/* Description */}
              {album.description ? (
                <Pressable
                  onPress={() => setDescExpanded((v) => !v)}
                  style={{ width: "100%" }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.mutedForeground,
                      textAlign: "center",
                      lineHeight: 22,
                      writingDirection: "rtl",
                    }}
                    numberOfLines={descExpanded ? undefined : 2}
                  >
                    {album.description}
                  </Text>
                  {album.description.length > 80 && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.primary,
                        textAlign: "center",
                        marginTop: 4,
                      }}
                    >
                      {descExpanded ? "Less" : "More"}
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Pressable onPress={() => setEditModalVisible(true)}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.input,
                      fontStyle: "italic",
                    }}
                  >
                    Add an album description...
                  </Text>
                </Pressable>
              )}

              {/* Meta pills */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: colors.card,
                    borderRadius: 99,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {album.medias?.length ?? 0} tracks
                  </Text>
                </View>
                {album.albumType && (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      backgroundColor: colors.card,
                      borderRadius: 99,
                    }}
                  >
                    <Text
                      style={{ fontSize: 12, color: colors.mutedForeground }}
                    >
                      {album.albumType}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action buttons */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  marginTop: 8,
                  width: "100%",
                }}
              >
                <Pressable
                  onPress={() => {
                    const first = tracks[0];
                    if (first?.blog?.id) {
                      router.push(`/blog-view-2/${first.blog.id}` as any);
                    }
                  }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 13,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Icon
                    name="Play"
                    size={18}
                    className="text-primary-foreground"
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: colors.primaryForeground,
                    }}
                  >
                    Play all
                  </Text>
                </Pressable>
                <Pressable
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: colors.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name="Shuffle"
                    size={20}
                    className="text-muted-foreground"
                  />
                </Pressable>
              </View>

              <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: colors.foreground,
                    }}
                  >
                      Books
                    </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {attachedBookReferences.length} attached
                  </Text>
                </View>

                {attachedBookReferences.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    {attachedBookReferences.slice(0, 3).map((reference) => (
                      <View
                        key={reference.id}
                        style={{
                          flexDirection: "row-reverse",
                          alignItems: "center",
                          gap: 8,
                          borderRadius: 10,
                          backgroundColor: colors.card,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            router.push(`/books/${reference.bookId}` as any)
                          }
                          style={{
                            flex: 1,
                            flexDirection: "row-reverse",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Icon
                            name="BookOpen"
                            size={16}
                            className="text-primary"
                          />
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: "600",
                              color: colors.foreground,
                              textAlign: "right",
                              writingDirection: "rtl",
                            }}
                            numberOfLines={1}
                          >
                            {reference.book?.nameAr ??
                              reference.book?.nameEn ??
                              "Book"}
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={isDetachingBook}
                          onPress={() =>
                            Alert.alert("Remove book?", undefined, [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => detachBook({ id: reference.id }),
                              },
                            ])
                          }
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: isDetachingBook ? 0.45 : 1,
                          }}
                        >
                          <Icon
                            name="Trash2"
                            size={14}
                            className="text-muted-foreground"
                          />
                        </Pressable>
                      </View>
                    ))}
                    {attachedBookReferences.length > 3 ? (
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.mutedForeground,
                          textAlign: "right",
                        }}
                      >
                        +{attachedBookReferences.length - 3} more
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <View
                    style={{
                      minHeight: 58,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.mutedForeground,
                        fontWeight: "700",
                      }}
                    >
                      No books attached
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={() => setBookManagerVisible(true)}
                  style={{
                    minHeight: 42,
                    borderRadius: 12,
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Icon
                    name="BookOpen"
                    size={16}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "900",
                      color: colors.primaryForeground,
                    }}
                  >
                    Manage books
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  borderRadius: 12,
                  backgroundColor: colors.muted,
                  padding: 4,
                }}
              >
                {(["tracks", "add"] as AlbumDetailTab[]).map((tab) => {
                  const active = activeAlbumTab === tab;
                  return (
                    <Pressable
                      key={tab}
                      onPress={() => {
                        setActiveAlbumTab(tab);
                        if (tab !== "tracks") {
                          setReorderMode(false);
                          setSelectedTrackIds(new Set());
                        }
                      }}
                      style={{
                        flex: 1,
                        minHeight: 40,
                        borderRadius: 9,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? colors.card : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: active
                            ? colors.foreground
                            : colors.mutedForeground,
                        }}
                      >
                        {tab === "tracks" ? "Tracks" : "+ Add"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Tracks section */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 60 }}>
              {activeAlbumTab === "tracks" && (
                <>
                  {/* Section header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingBottom: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: colors.foreground,
                      }}
                    >
                      Tracks
                    </Text>
                    {hasTrackSearch ? (
                      <Text
                        style={{
                          marginLeft: 8,
                          flex: 1,
                          fontSize: 12,
                          color: colors.mutedForeground,
                          textAlign: "right",
                        }}
                        numberOfLines={1}
                      >
                        {displayedTracks.length} of {tracks.length} matches
                      </Text>
                    ) : null}

                    {selectedTrackCount > 0 && !reorderMode && (
                      <Pressable
                        onPress={clearTrackSelection}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          backgroundColor: colors.muted,
                          borderRadius: 8,
                        }}
                      >
                        <Icon
                          name="X"
                          size={14}
                          className="text-muted-foreground"
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.mutedForeground,
                          }}
                        >
                          Clear
                        </Text>
                      </Pressable>
                    )}

                    {tracks.length > 0 &&
                      !hasTrackSearch &&
                      !reorderMode &&
                      selectedTrackCount === 0 && (
                        <Pressable
                          onPress={enterReorderMode}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            backgroundColor: colors.muted,
                            borderRadius: 8,
                          }}
                        >
                          <Icon
                            name="ListOrdered"
                            size={14}
                            className="text-muted-foreground"
                          />
                          <Text
                            style={{
                              fontSize: 12,
                              color: colors.mutedForeground,
                            }}
                          >
                            Reorder
                          </Text>
                        </Pressable>
                      )}

                    {reorderMode && (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable
                          onPress={cancelReorder}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            backgroundColor: colors.muted,
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: colors.mutedForeground,
                            }}
                          >
                            Cancel
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={commitOrder}
                          disabled={isSavingOrder}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            backgroundColor: colors.primary,
                            borderRadius: 8,
                            opacity: isSavingOrder ? 0.6 : 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: colors.primaryForeground,
                            }}
                          >
                            {isSavingOrder ? "..." : "Save order"}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {tracks.length === 0 ? (
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 48,
                        gap: 10,
                      }}
                    >
                      <Icon
                        name="Music2"
                        size={40}
                        className="text-muted-foreground"
                      />
                      <Text
                        style={{ fontSize: 14, color: colors.mutedForeground }}
                      >
                        No tracks yet
                      </Text>
                    </View>
                  ) : hasTrackSearch && displayedTracks.length === 0 ? (
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 48,
                        gap: 10,
                      }}
                    >
                      <Icon
                        name="SearchX"
                        size={40}
                        className="text-muted-foreground"
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.mutedForeground,
                          textAlign: "center",
                        }}
                      >
                        {`No tracks match "${trackSearchQuery.trim()}"`}
                      </Text>
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
                    displayedTracks.map((media, idx) => {
                      const isActiveTrack = isActiveAlbumTrack(media);
                      return (
                        <TrackRow
                          key={media.id}
                          media={media}
                          displayIndex={idx + 1}
                          isRemoving={
                            isRemovingMedia ||
                            isMovingMedia ||
                            isRemovingSelectedMedia
                          }
                          isSelected={selectedTrackIds.has(media.id)}
                          isActiveTrack={isActiveTrack}
                          isTrackPlaying={isActiveTrack && activeAudioIsPlaying}
                          isTrackLoading={isActiveTrack && activeAudioIsLoading}
                          canPlay={canPlayAlbumTrack(media)}
                          selectionMode={selectedTrackCount > 0}
                          trackAuthorLabel={
                            albumAuthorId ? null : getAuthorDisplayName(media.author)
                          }
                          searchMatch={trackSearchState.matchesById.get(
                            media.id,
                          )}
                          onPlayPress={() =>
                            void handleTrackPlaybackPress(media)
                          }
                          onActions={() => setSelectedTrackForActions(media)}
                          onLongPress={() => startTrackSelection(media.id)}
                          onPress={() => {
                            if (selectedTrackCount > 0) {
                              toggleTrackSelection(media.id);
                              return;
                            }
                            if (media.blog?.id) {
                              router.push(
                                `/blog-view-2/${media.blog.id}` as any,
                              );
                            }
                          }}
                        />
                      );
                    })
                  )}
                </>
              )}

              {/* Suggested media section */}
              {activeAlbumTab === "add" && (
                <View style={{ paddingTop: 6 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingBottom: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ alignItems: "flex-start" }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: colors.foreground,
                        }}
                      >
                        More for this album
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.mutedForeground,
                          marginTop: 2,
                        }}
                      >
                        Add a keyword to search this channel by that keyword.
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={suggestMoreForAlbum}
                        disabled={isFetchingSuggestions || isAddingSuggestions}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          backgroundColor: colors.primary,
                          borderRadius: 8,
                          opacity:
                            isFetchingSuggestions || isAddingSuggestions
                              ? 0.5
                              : 1,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: colors.primaryForeground,
                          }}
                        >
                          {suggestionsRequested ? "Refresh" : "Suggest more"}
                        </Text>
                      </Pressable>
                      {suggestionsRequested &&
                        displayedSuggestedMedia.length > 0 && (
                          <Pressable
                            onPress={
                              selectedSuggestionCount ===
                              displayedSuggestedMedia.length
                                ? clearSuggestionSelection
                                : selectAllSuggestions
                            }
                            disabled={isAddingSuggestions}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              backgroundColor: colors.muted,
                              borderRadius: 8,
                              opacity: isAddingSuggestions ? 0.5 : 1,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.mutedForeground,
                              }}
                            >
                              {selectedSuggestionCount ===
                              displayedSuggestedMedia.length
                                ? "Clear"
                                : "Mark all"}
                            </Text>
                          </Pressable>
                        )}
                    </View>
                  </View>

                  <View style={{ paddingTop: 12, paddingBottom: 4 }}>
                    <TextInput
                      value={suggestionKeyword}
                      onChangeText={(value) => {
                        setSuggestionKeyword(value);
                        setSelectedSuggestionIds(new Set());
                        setDismissedSuggestionIds(new Set());
                      }}
                      placeholder="Keyword, keyword"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        color: colors.foreground,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 14,
                      }}
                      onSubmitEditing={suggestMoreForAlbum}
                      returnKeyType="search"
                    />
                  </View>

                  {!suggestionsRequested ? (
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 36,
                        gap: 8,
                      }}
                    >
                      <Icon
                        name="Search"
                        size={34}
                        className="text-muted-foreground"
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.mutedForeground,
                          textAlign: "center",
                        }}
                      >
                        Enter a keyword or tap Suggest more to find related
                        audios.
                      </Text>
                    </View>
                  ) : isFetchingSuggestions ? (
                    <View style={{ alignItems: "center", paddingVertical: 28 }}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  ) : displayedSuggestedMedia.length === 0 &&
                    suggestedMedia.length > 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 36 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.mutedForeground,
                          textAlign: "center",
                        }}
                      >
                        No more result
                      </Text>
                    </View>
                  ) : displayedSuggestedMedia.length === 0 ? (
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 36,
                        gap: 8,
                      }}
                    >
                      <Icon
                        name="SearchX"
                        size={34}
                        className="text-muted-foreground"
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.mutedForeground,
                          textAlign: "center",
                        }}
                      >
                        No matching audio suggestions yet.
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.mutedForeground,
                          textAlign: "center",
                        }}
                      >
                        Try another keyword or refresh the album-based
                        suggestions.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <FlatList
                        data={displayedSuggestedMedia}
                        keyExtractor={(item) => String(item.id)}
                        scrollEnabled={false}
                        removeClippedSubviews={false}
                        renderItem={({ item }) => (
                          <SwipeDeleteRow
                            onDelete={() => dismissSuggestion(item.id)}
                            disabled={
                              isAddingSuggestions ||
                              addingSuggestionIds.has(item.id)
                            }
                          >
                            <SuggestedMediaRow
                              media={item}
                              selected={selectedSuggestionIds.has(item.id)}
                              onPress={() => toggleSuggestion(item.id)}
                              onAdd={() => void addOneSuggestion(item)}
                              onAddLongPress={() =>
                                openSingleSuggestionAlbumModal(item.id)
                              }
                              isAdding={addingSuggestionIds.has(item.id)}
                            />
                          </SwipeDeleteRow>
                        )}
                      />
                      {hasNoMoreSuggestions && (
                        <Text
                          style={{
                            textAlign: "center",
                            fontSize: 12,
                            color: colors.mutedForeground,
                            paddingTop: 16,
                            paddingBottom: 6,
                          }}
                        >
                          No more result
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          </KeyboardAwareScrollView>
        )}
      </SafeArea>
      <ScrollToTopButton
        visible={albumScroll.showScrollTop}
        onPress={albumScroll.scrollToTop}
      />

      {albumModalMediaIds && (
        <Modal
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setAlbumModalMediaIds(null)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/60"
            onPress={() => setAlbumModalMediaIds(null)}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{ width: "100%" }}
            >
              <AddToAlbumModal
                mediaIds={albumModalMediaIds}
                authorId={album?.author?.id}
                onAdded={handleAlbumModalAdded}
                onClose={() => setAlbumModalMediaIds(null)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <DeleteSuggestionConfirmSheet
        visible={deleteSuggestionConfirmVisible}
        count={selectedSuggestionCount}
        isDeleting={isDeletingSuggestions}
        onCancel={() => setDeleteSuggestionConfirmVisible(false)}
        onConfirm={() => {
          void confirmDeleteSelectedSuggestions();
        }}
      />

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
      <AuthorEditorModal
        visible={Boolean(authorEditorState)}
        title={
          authorEditorState?.mode === "edit" ? "Edit author" : "Add author"
        }
        initialAuthor={authorEditorState?.author}
        isSaving={isCreatingAuthor || isUpdatingAuthor || isUpdating}
        onClose={() => setAuthorEditorState(null)}
        onSave={(values) => {
          void saveAuthor(values);
        }}
      />
      <ManageAlbumBooksModal
        visible={bookManagerVisible}
        books={libraryBooks}
        attachedReferences={attachedBookReferences}
        isAttaching={isAttachingBook}
        isDetaching={isDetachingBook}
        onClose={() => setBookManagerVisible(false)}
        onAttach={(bookId) => attachBook({ albumId: id, bookId })}
        onDetach={(referenceId) => detachBook({ id: referenceId })}
        onOpenBook={(bookId) => {
          setBookManagerVisible(false);
          router.push(`/books/${bookId}` as any);
        }}
      />
      <TrackActionsSheet
        visible={Boolean(selectedTrackForActions)}
        media={selectedTrackForActions}
        isBusy={isRemovingMedia || isMovingMedia || isResettingTrack}
        onClose={() => setSelectedTrackForActions(null)}
        onMoveRequest={openTrackMovePicker}
        onOpenPost={() => openSelectedTrackPost(false)}
        onShare={() => {
          void shareSelectedTrackPost();
        }}
        onComment={() => openSelectedTrackPost(true)}
        onTranscribe={() => {
          void queueSelectedTrackTranscription();
        }}
        onResetTranscription={resetSelectedTrackTranscription}
        onRemove={() => {
          if (selectedTrackForActions?.id) {
            removeTrackFromAlbum(selectedTrackForActions.id);
          }
        }}
      />
      <TrackMoveAlbumSheet
        visible={Boolean(trackMoveTarget)}
        media={trackMoveTarget}
        albums={albums}
        currentAlbumId={id}
        isBusy={isMovingMedia}
        onClose={() => setTrackMoveTarget(null)}
        onMove={moveTrackToAlbum}
      />
    </View>
  );
}
