import { Pressable } from "@/components/ui/pressable";
import { formatDate } from "@acme/utils/dayjs";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  SwipeDirection,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import { LegendList } from "@legendapp/list";

import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import {
  getSwipeDeleteThreshold,
  SwipeDeleteAction,
} from "@/components/ui/swipe-delete-action";
import { Toast } from "@/components/ui/toast";
import { useInfiniteLoader } from "@/components/infinite-loader";
import { minuteToString } from "@/lib/utils";
import { AddToAlbumModal } from "@/components/channel-chat/add-to-album-modal";
import { AddToPlaylistModal } from "@/components/channel-chat/add-to-playlist-modal";
import type { BlogItem } from "@/components/blog-card";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animatePostListChange() {
  LayoutAnimation.configureNext({
    duration: 220,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

function compactTags(tags?: (string | undefined)[] | null): string[] {
  return tags?.filter((tag): tag is string => Boolean(tag)) ?? [];
}

// ── Date divider ─────────────────────────────────────────────────────────────

function DateDivider({ date }: { date: string | Date | null | undefined }) {
  if (!date) return null;
  return (
    <View className="items-center py-2">
      <View className="px-3 py-1 rounded-full bg-muted">
        <Text className="text-[10px] font-medium text-muted-foreground">
          {formatDate(date, "MMMM D, YYYY")}
        </Text>
      </View>
    </View>
  );
}

// ── Tag row helper ────────────────────────────────────────────────────────────

function TagRow({
  tags,
  activeTag,
  onTagPress,
}: {
  tags: string[];
  activeTag: string | null;
  onTagPress: (tag: string) => void;
}) {
  const colors = useColors();
  if (!tags || tags.length === 0) return null;
  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}
    >
      {tags.slice(0, 4).map((tag) => (
        <Pressable key={tag} onPress={() => onTagPress(tag)} hitSlop={4}>
          <Text
            style={{
              fontSize: 10,
              color:
                activeTag === tag ? colors.primaryForeground : colors.primary,
              backgroundColor:
                activeTag === tag ? colors.primary : "transparent",
              paddingHorizontal: activeTag === tag ? 5 : 0,
              paddingVertical: activeTag === tag ? 1 : 0,
              borderRadius: 4,
              fontWeight: activeTag === tag ? "700" : "400",
            }}
          >
            #{tag}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Bubble content ────────────────────────────────────────────────────────────

function TextBubble({
  post,
  selected,
  activeTag,
  onTagPress,
}: {
  post: BlogItem;
  selected?: boolean;
  activeTag: string | null;
  onTagPress: (tag: string) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        borderRadius: 16,
        borderBottomRightRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: selected
          ? withAlpha(colors.primary, 0.18)
          : colors.card,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          color: colors.foreground,
          lineHeight: 21,
          textAlign: "right",
          writingDirection: "rtl",
        }}
      >
        {post.content}
      </Text>
      <TagRow
        tags={compactTags(post.tags)}
        activeTag={activeTag}
        onTagPress={onTagPress}
      />
      <View className="flex-row items-center justify-end gap-2 mt-1">
        {(post._count as any)?.comments > 0 && (
          <View className="flex-row items-center gap-0.5">
            <Icon
              name="MessageCircle"
              size={10}
              className="text-muted-foreground"
            />
            <Text className="text-[9px] text-muted-foreground">
              {(post._count as any).comments}
            </Text>
          </View>
        )}
        <Text className="text-[10px] text-muted-foreground">
          {formatDate(post.date, "hh:mm A")}
        </Text>
      </View>
    </View>
  );
}

function AudioBubble({
  post,
  selected,
  activeTag,
  onTagPress,
}: {
  post: BlogItem;
  selected?: boolean;
  activeTag: string | null;
  onTagPress: (tag: string) => void;
}) {
  const title = post.caption || post.audio?.title || "Audio";
  const router = useRouter();
  const colors = useColors();
  return (
    <View
      style={{
        borderRadius: 16,
        borderBottomRightRadius: 4,
        padding: 12,
        backgroundColor: selected
          ? withAlpha(colors.primary, 0.18)
          : colors.card,
      }}
    >
      <Text
        className="text-sm font-bold text-foreground text-right mb-2"
        numberOfLines={2}
      >
        {title}
      </Text>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => router.push(`/blog-view-2/${post.id}` as any)}
          className="size-10 rounded-full bg-primary items-center justify-center active:opacity-80 shrink-0"
        >
          <Icon
            name="Play"
            size={18}
            className="text-primary-foreground ml-0.5"
          />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-0.5 h-8">
          {[4, 8, 5, 12, 6, 10, 3, 9, 7, 11, 4, 8, 6, 10, 5].map((h, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                borderRadius: 9999,
                backgroundColor: colors.border,
                height: h * 2,
              }}
            />
          ))}
        </View>
        <Text className="text-[10px] text-muted-foreground shrink-0">
          {minuteToString(post.audio?.duration)}
        </Text>
      </View>
      <TagRow
        tags={compactTags(post.tags)}
        activeTag={activeTag}
        onTagPress={onTagPress}
      />
      <View className="flex-row items-center justify-end gap-2 mt-1.5">
        {(post._count as any)?.comments > 0 && (
          <View className="flex-row items-center gap-0.5">
            <Icon
              name="MessageCircle"
              size={10}
              className="text-muted-foreground"
            />
            <Text className="text-[9px] text-muted-foreground">
              {(post._count as any).comments}
            </Text>
          </View>
        )}
        <Text className="text-[10px] text-muted-foreground">
          {formatDate(post.date, "hh:mm A")}
        </Text>
      </View>
    </View>
  );
}

function ImageBubble({
  post,
  selected,
  activeTag,
  onTagPress,
}: {
  post: BlogItem;
  selected?: boolean;
  activeTag: string | null;
  onTagPress: (tag: string) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        borderRadius: 16,
        borderBottomRightRadius: 4,
        overflow: "hidden",
        backgroundColor: selected ? withAlpha(colors.primary, 0.18) : undefined,
      }}
    >
      <View className="h-40 bg-muted items-center justify-center">
        <Icon name="Image" size={32} className="text-muted-foreground" />
      </View>
      {post.caption && (
        <View className="px-3 pt-2">
          <Text
            className="text-sm text-foreground text-right"
            numberOfLines={3}
          >
            {post.caption}
          </Text>
        </View>
      )}
      <View className="px-3 pb-2 mt-1">
        <TagRow
          tags={compactTags(post.tags)}
          activeTag={activeTag}
          onTagPress={onTagPress}
        />
        <View className="flex-row items-center justify-end gap-2 mt-1">
          {(post._count as any)?.comments > 0 && (
            <View className="flex-row items-center gap-0.5">
              <Icon
                name="MessageCircle"
                size={10}
                className="text-muted-foreground"
              />
              <Text className="text-[9px] text-muted-foreground">
                {(post._count as any).comments}
              </Text>
            </View>
          )}
          <Text className="text-[10px] text-muted-foreground">
            {formatDate(post.date, "hh:mm A")}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  post: BlogItem;
  onClose: () => void;
  onDelete: (post: BlogItem) => void;
  onAddToAlbum: (post: BlogItem) => void;
  onAddToPlaylist: (post: BlogItem) => void;
  onStartMerge: (id: number) => void;
}

function ContextMenu({
  post,
  onClose,
  onDelete,
  onAddToAlbum,
  onAddToPlaylist,
  onStartMerge,
}: ContextMenuProps) {
  return (
    <View className="bg-card rounded-2xl overflow-hidden mx-4 shadow-xl">
      <Pressable
        onPress={() => {
          onAddToAlbum(post);
          onClose();
        }}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-muted border-b border-border"
      >
        <Icon name="Music2" size={18} className="text-foreground" />
        <Text className="text-sm font-medium text-foreground">
          Add to Album
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onAddToPlaylist(post);
          onClose();
        }}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-muted border-b border-border"
      >
        <Icon name="ListMusic" size={18} className="text-foreground" />
        <Text className="text-sm font-medium text-foreground">
          Add to Playlist
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onStartMerge(post.id);
          onClose();
        }}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-muted border-b border-border"
      >
        <Icon name="Layers" size={18} className="text-foreground" />
        <Text className="text-sm font-medium text-foreground">
          Merge Selected
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onDelete(post);
          onClose();
        }}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-muted"
      >
        <Icon name="Trash2" size={18} className="text-destructive" />
        <Text className="text-sm font-medium text-destructive">Delete</Text>
      </Pressable>
    </View>
  );
}

// ── Swipeable bubble row ──────────────────────────────────────────────────────

interface BubbleRowProps {
  post: BlogItem;
  selected: boolean;
  isSelectMode: boolean;
  activeTag: string | null;
  actionWidth: number;
  fullSwipeThreshold: number;
  onLongPress: (post: BlogItem) => void;
  onDelete: (post: BlogItem) => Promise<void> | void;
  onToggleSelect: (id: number) => void;
  onTagPress: (tag: string) => void;
}

function BubbleRow({
  post,
  selected,
  isSelectMode,
  activeTag,
  actionWidth,
  fullSwipeThreshold,
  onLongPress,
  onDelete,
  onToggleSelect,
  onTagPress,
}: BubbleRowProps) {
  const router = useRouter();
  const colors = useColors();
  const swipeRef = useRef<any>(null);
  const isDeletingRef = useRef(false);

  const handleSwipeWillOpen = async (direction: SwipeDirection) => {
    if (direction !== SwipeDirection.LEFT || isDeletingRef.current) return;

    isDeletingRef.current = true;
    swipeRef.current?.close();

    try {
      await onDelete(post);
    } finally {
      isDeletingRef.current = false;
    }
  };

  const renderRightActions = useCallback(
    (progress: SharedValue<number>, translation: SharedValue<number>) => (
      <SwipeDeleteAction
        progress={progress}
        translation={translation}
        actionWidth={actionWidth}
        fullSwipeThreshold={fullSwipeThreshold}
      />
    ),
    [actionWidth, fullSwipeThreshold],
  );

  const handlePress = () => {
    if (isSelectMode) {
      onToggleSelect(post.id);
    } else if (post.type === "text") {
      router.push(`/blog-view-text/${post.id}` as any);
    } else if (post.type === "image") {
      router.push(`/blog-image-view?blogId=${post.id}` as any);
    } else {
      router.push(`/blog-view-2/${post.id}` as any);
    }
  };

  const sharedBubbleProps = { post, selected, activeTag, onTagPress };

  const bubble =
    post.type === "audio" ? (
      <AudioBubble {...sharedBubbleProps} />
    ) : post.type === "image" ? (
      <ImageBubble {...sharedBubbleProps} />
    ) : (
      <TextBubble {...sharedBubbleProps} />
    );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      enabled={!isSelectMode}
      friction={1.15}
      overshootFriction={8}
      overshootRight
      rightThreshold={fullSwipeThreshold}
      onSwipeableWillOpen={handleSwipeWillOpen}
      renderRightActions={renderRightActions}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={() => onLongPress(post)}
        delayLongPress={400}
        className="px-4"
      >
        <View className="max-w-[88%] self-end">
          {isSelectMode && (
            <View className="absolute -left-6 top-2 z-10">
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 9999,
                  borderWidth: 2,
                  alignItems: "center",
                  justifyContent: "center",
                  borderColor: selected
                    ? colors.primary
                    : colors.mutedForeground,
                  backgroundColor: selected ? colors.primary : "transparent",
                }}
              >
                {selected && (
                  <Icon name="Check" size={11} className="text-white" />
                )}
              </View>
            </View>
          )}
          {bubble}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

// ── Active tag bar ────────────────────────────────────────────────────────────

function TagScrollBar({
  tag,
  matchCount,
  currentMatchIdx,
  onPrev,
  onNext,
  onClear,
}: {
  tag: string;
  matchCount: number;
  currentMatchIdx: number;
  onPrev: () => void;
  onNext: () => void;
  onClear: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: withAlpha(colors.primary, 0.12),
        borderBottomWidth: 1,
        borderBottomColor: colors.primary,
        gap: 8,
      }}
    >
      <Pressable onPress={onPrev} style={{ padding: 4 }}>
        <Icon name="ChevronUp" size={18} className="text-primary" />
      </Pressable>
      <Pressable onPress={onNext} style={{ padding: 4 }}>
        <Icon name="ChevronDown" size={18} className="text-primary" />
      </Pressable>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text
          style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}
        >
          #{tag}
        </Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
          {matchCount === 0
            ? "لا توجد نتائج"
            : `${currentMatchIdx + 1} / ${matchCount}`}
        </Text>
      </View>
      <Pressable onPress={onClear} style={{ padding: 4 }}>
        <Icon name="X" size={16} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function ChannelChatScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const id = Number(channelId);

  const listRef = useRef<any>(null);

  const { data: channel } = useQuery(
    _trpc.channel.getChannel.queryOptions({ id }),
  );

  const {
    data: posts,
    hasNextPage,
    isFetching,
    fetchNextPage,
  } = useInfiniteLoader({
    route: _trpc?.blog.posts,
    input: { channelId: id },
    queryOptions: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  });

  const [hiddenPostIds, setHiddenPostIds] = useState<Set<number>>(new Set());
  const visiblePosts = useMemo(
    () => (posts ?? []).filter((post) => !hiddenPostIds.has(post.id)),
    [hiddenPostIds, posts],
  );
  const reversedPosts = useMemo(
    () => [...visiblePosts].reverse(),
    [visiblePosts],
  );
  const fullSwipeThreshold = useMemo(
    () => getSwipeDeleteThreshold(width),
    [width],
  );

  // ── Tag scroll ────────────────────────────────────────────────────────────
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagMatchIndices, setTagMatchIndices] = useState<number[]>([]);
  const [tagMatchIdx, setTagMatchIdx] = useState(0);

  function handleTagPress(tag: string) {
    if (activeTag === tag) {
      // Cycle to next match
      const nextIdx = (tagMatchIdx + 1) % Math.max(tagMatchIndices.length, 1);
      setTagMatchIdx(nextIdx);
      const targetIndex = tagMatchIndices[nextIdx];
      if (targetIndex != null) {
        listRef.current?.scrollToIndex({ index: targetIndex, animated: true });
      }
      return;
    }

    setActiveTag(tag);
    const indices = reversedPosts
      .map((p, i) => ({ i, match: (p.tags ?? []).includes(tag) }))
      .filter((x) => x.match)
      .map((x) => x.i);
    setTagMatchIndices(indices);
    setTagMatchIdx(0);
    if (indices.length > 0) {
      listRef.current?.scrollToIndex({ index: indices[0], animated: true });
    }
  }

  function prevTagMatch() {
    const prevIdx =
      (tagMatchIdx - 1 + Math.max(tagMatchIndices.length, 1)) %
      Math.max(tagMatchIndices.length, 1);
    setTagMatchIdx(prevIdx);
    const targetIndex = tagMatchIndices[prevIdx];
    if (targetIndex != null) {
      listRef.current?.scrollToIndex({ index: targetIndex, animated: true });
    }
  }

  function nextTagMatch() {
    const nextIdx = (tagMatchIdx + 1) % Math.max(tagMatchIndices.length, 1);
    setTagMatchIdx(nextIdx);
    const targetIndex = tagMatchIndices[nextIdx];
    if (targetIndex != null) {
      listRef.current?.scrollToIndex({ index: targetIndex, animated: true });
    }
  }

  function clearActiveTag() {
    setActiveTag(null);
    setTagMatchIndices([]);
    setTagMatchIdx(0);
  }

  // ── Long-press context menu ───────────────────────────────────────────────
  const [contextPost, setContextPost] = useState<BlogItem | null>(null);

  // ── Multi-select / merge ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const isSelectMode = selectedIds.size > 0;

  function toggleSelect(postId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation(
    _trpc.blog.deleteBlog.mutationOptions({
      onSettled: () => {
        queryClient.invalidateQueries(
          _trpc.blog.posts.queryOptions({ channelId: id } as any),
        );
      },
    }),
  );

  const restoreMutation = useMutation(
    _trpc.blog.restoreBlog.mutationOptions({
      onSettled: () => {
        queryClient.invalidateQueries(
          _trpc.blog.posts.queryOptions({ channelId: id } as any),
        );
      },
    }),
  );

  const handleDelete = useCallback(
    async (post: BlogItem) => {
      animatePostListChange();
      setHiddenPostIds((prev) => new Set(prev).add(post.id));
      setSelectedIds((prev) => {
        if (!prev.has(post.id)) return prev;
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });

      let deleteFailed = false;
      const deletePromise = deleteMutation
        .mutateAsync({ id: post.id })
        .catch((error) => {
          deleteFailed = true;
          throw error;
        });
      let didRestore = false;

      const restorePost = async () => {
        if (didRestore) return;

        didRestore = true;
        animatePostListChange();
        setHiddenPostIds((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });

        try {
          await deletePromise;
          await restoreMutation.mutateAsync({ id: post.id });
        } catch {
          if (deleteFailed) {
            animatePostListChange();
            setHiddenPostIds((prev) => {
              const next = new Set(prev);
              next.delete(post.id);
              return next;
            });
            return;
          }

          animatePostListChange();
          setHiddenPostIds((prev) => new Set(prev).add(post.id));
          Alert.alert("Undo failed", "Could not restore this post. Try again.");
        }
      };

      const toastId = Toast.show("Post deleted", {
        action: {
          label: "Undo",
          onPress: () => {
            void restorePost();
          },
        },
        duration: 5000,
        position: "bottom",
        type: "default",
      });

      try {
        await deletePromise;
      } catch {
        if (toastId) {
          Toast.dismiss(toastId);
        }
        animatePostListChange();
        setHiddenPostIds((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
        Alert.alert("Delete failed", "Could not delete this post. Try again.");
      }
    },
    [deleteMutation, restoreMutation],
  );

  function handleLongPress(post: BlogItem) {
    if (isSelectMode) {
      toggleSelect(post.id);
    } else {
      setContextPost(post);
    }
  }

  function handleStartMerge(postId: number) {
    setSelectedIds(new Set([postId]));
  }

  const mergeMutation = useMutation(
    _trpc.blog.mergeBlogs.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          _trpc.blog.posts.queryOptions({ channelId: id } as any),
        );
        clearSelection();
      },
      onError: (error) => Alert.alert("Merge failed", error.message),
    }),
  );

  function handleMergeSelected() {
    const selectedPosts = (posts ?? []).filter((post) =>
      selectedIds.has(post.id),
    );
    if (selectedPosts.length !== 2 || mergeMutation.isPending) return;
    const [first, second] = selectedPosts;
    const primary = first.audio?.mediaId
      ? first
      : second.audio?.mediaId
        ? second
        : first;
    const secondary = primary.id === first.id ? second : first;
    Alert.alert(
      "Merge selected posts?",
      "This will keep one post, move media/comments/tags into it, and hide the other post.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Merge",
          style: "default",
          onPress: () =>
            mergeMutation.mutate({
              primaryBlogId: primary.id,
              secondaryBlogId: secondary.id,
              contentStrategy:
                primary.id === first.id ? "primary-first" : "secondary-first",
            }),
        },
      ],
    );
  }

  // ── Add to Album modal ────────────────────────────────────────────────────
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [albumMediaIds, setAlbumMediaIds] = useState<number[]>([]);
  const [albumAuthorId, setAlbumAuthorId] = useState<number | undefined>();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistMediaIds, setPlaylistMediaIds] = useState<number[]>([]);

  function openAlbumModal(mediaIds: number[], authorId?: number) {
    setAlbumMediaIds(mediaIds);
    setAlbumAuthorId(authorId);
    setShowAlbumModal(true);
  }

  function handleAddToAlbum(post: BlogItem) {
    const mediaId = post.audio?.mediaId;
    if (mediaId) openAlbumModal([mediaId], post.audio?.authorId ?? undefined);
  }

  function openPlaylistModal(mediaIds: number[]) {
    setPlaylistMediaIds(mediaIds);
    setShowPlaylistModal(true);
  }

  function handleAddToPlaylist(post: BlogItem) {
    const mediaId = post.audio?.mediaId;
    if (mediaId) openPlaylistModal([mediaId]);
  }

  function handleBulkAddToAlbum() {
    const selectedPosts = (posts ?? []).filter((p) => selectedIds.has(p.id));
    const mediaIds = selectedPosts
      .map((p) => p.audio?.mediaId)
      .filter((id): id is number => !!id);
    if (mediaIds.length === 0) {
      Alert.alert(
        "No audio selected",
        "Select at least one audio post to add it to an album.",
      );
      return;
    }
    openAlbumModal(mediaIds, selectedPosts[0]?.audio?.authorId ?? undefined);
  }

  function handleBulkAddToPlaylist() {
    const selectedPosts = (posts ?? []).filter((p) => selectedIds.has(p.id));
    const mediaIds = selectedPosts
      .map((p) => p.audio?.mediaId)
      .filter((mediaId): mediaId is number => !!mediaId);
    if (mediaIds.length === 0) {
      Alert.alert(
        "No audio selected",
        "Select at least one audio post to add it to a playlist.",
      );
      return;
    }
    openPlaylistModal(mediaIds);
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        {/* Header */}
        <View className="flex-row items-center px-3 py-2 border-b border-border gap-3">
          <Pressable
            onPress={() => {
              if (isSelectMode) clearSelection();
              else router.back();
            }}
            className="size-10 items-center justify-center rounded-full active:bg-muted"
          >
            <Icon
              name={isSelectMode ? "X" : "ArrowLeft"}
              className="text-foreground"
            />
          </Pressable>

          {isSelectMode ? (
            <Text className="flex-1 text-sm font-bold text-foreground">
              {selectedIds.size} selected
            </Text>
          ) : (
            <>
              <View className="size-10 rounded-full bg-primary/20 items-center justify-center">
                <Icon name="Radio" size={18} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-bold text-foreground"
                  numberOfLines={1}
                >
                  {channel?.title ?? channel?.username ?? "Channel"}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {channel?.stats.totalBlogs ?? "…"} posts
                </Text>
              </View>
            </>
          )}

          <Pressable className="size-10 items-center justify-center rounded-full active:bg-muted">
            <Icon name="Search" className="text-muted-foreground" />
          </Pressable>
        </View>

        {/* Active tag navigation bar */}
        {activeTag && (
          <TagScrollBar
            tag={activeTag}
            matchCount={tagMatchIndices.length}
            currentMatchIdx={tagMatchIdx}
            onPrev={prevTagMatch}
            onNext={nextTagMatch}
            onClear={clearActiveTag}
          />
        )}

        {/* Messages */}
        <LegendList
          ref={listRef}
          data={reversedPosts}
          keyExtractor={(item) => String(item.id)}
          // @ts-expect-error LegendList supports inverted at runtime, but this package version's types omit it.
          inverted
          renderItem={({ item, index }) => {
            const prevPost =
              index < reversedPosts.length - 1
                ? reversedPosts[index + 1]
                : null;
            const showDate =
              !prevPost ||
              formatDate(item.date, "YYYY-MM-DD") !==
                formatDate(prevPost.date, "YYYY-MM-DD");
            const isTagMatch = activeTag
              ? (item.tags ?? []).includes(activeTag)
              : false;

            return (
              <View style={{ opacity: activeTag && !isTagMatch ? 0.35 : 1 }}>
                <BubbleRow
                  post={item}
                  selected={selectedIds.has(item.id)}
                  isSelectMode={isSelectMode}
                  activeTag={activeTag}
                  actionWidth={width}
                  fullSwipeThreshold={fullSwipeThreshold}
                  onLongPress={handleLongPress}
                  onDelete={handleDelete}
                  onToggleSelect={toggleSelect}
                  onTagPress={handleTagPress}
                />
                {showDate && (
                  <View className="px-4">
                    <DateDivider date={item.date} />
                  </View>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListFooterComponent={<View className="h-4" />}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 80,
                transform: [{ scaleY: -1 }],
              }}
            >
              <Icon
                name="MessageCircle"
                size={48}
                className="text-muted-foreground mb-3"
              />
              <Text className="text-sm text-muted-foreground">
                {isFetching ? "Loading messages…" : "No messages yet"}
              </Text>
            </View>
          }
          onEndReached={() => {
            if (hasNextPage && !isFetching) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
        />

        {/* Multi-select bottom bar */}
        {isSelectMode && (
          <View className="px-4 py-3 bg-card border-t border-border flex-row gap-3">
            {selectedIds.size === 2 && (
              <Pressable
                onPress={handleMergeSelected}
                disabled={mergeMutation.isPending}
                className="h-11 px-4 rounded-xl bg-muted items-center justify-center flex-row gap-2 active:opacity-70 disabled:opacity-50"
              >
                <Icon name="Layers" size={16} className="text-foreground" />
                <Text className="text-sm font-semibold text-foreground">
                  Merge
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleBulkAddToAlbum}
              className="flex-1 h-11 rounded-xl bg-primary items-center justify-center flex-row gap-2 active:opacity-80"
            >
              <Icon
                name="Music2"
                size={16}
                className="text-primary-foreground"
              />
              <Text className="text-sm font-bold text-primary-foreground">
                Add {selectedIds.size} to Album
              </Text>
            </Pressable>
            <Pressable
              onPress={handleBulkAddToPlaylist}
              className="h-11 px-4 rounded-xl bg-muted items-center justify-center active:opacity-70"
            >
              <Icon name="ListMusic" size={16} className="text-foreground" />
            </Pressable>
            <Pressable
              onPress={clearSelection}
              className="h-11 px-4 rounded-xl bg-muted items-center justify-center active:opacity-70"
            >
              <Text className="text-sm font-semibold text-foreground">
                Cancel
              </Text>
            </Pressable>
          </View>
        )}
      </SafeArea>

      {/* Long-press context menu overlay */}
      {contextPost && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setContextPost(null)}
        >
          <Pressable
            className="flex-1 bg-black/60 items-center justify-center"
            onPress={() => setContextPost(null)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <ContextMenu
                post={contextPost}
                onClose={() => setContextPost(null)}
                onDelete={handleDelete}
                onAddToAlbum={handleAddToAlbum}
                onAddToPlaylist={handleAddToPlaylist}
                onStartMerge={handleStartMerge}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Add to Album bottom sheet */}
      {showAlbumModal && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setShowAlbumModal(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/60"
            onPress={() => setShowAlbumModal(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="max-h-[70%]"
            >
              <AddToAlbumModal
                mediaIds={albumMediaIds}
                authorId={albumAuthorId}
                onClose={() => {
                  setShowAlbumModal(false);
                  clearSelection();
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <AddToPlaylistModal
        visible={showPlaylistModal}
        mediaIds={playlistMediaIds}
        onClose={() => setShowPlaylistModal(false)}
      />
    </View>
  );
}
