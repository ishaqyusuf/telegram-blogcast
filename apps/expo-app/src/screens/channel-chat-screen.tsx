import { Pressable } from "@/components/ui/pressable";
import { formatDate } from "@acme/utils/dayjs";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { I18nManager, Modal, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { LegendList } from "@legendapp/list";

import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useInfiniteLoader } from "@/components/infinite-loader";
import { minuteToString } from "@/lib/utils";
import { AddToAlbumModal } from "@/components/channel-chat/add-to-album-modal";
import type { BlogItem } from "@/components/blog-card";

const isRTL = I18nManager.isRTL;

// ── Date divider ─────────────────────────────────────────────────────────────

function DateDivider({ date }: { date: string | null | undefined }) {
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

function TagRow({ tags, activeTag, onTagPress }: { tags: string[]; activeTag: string | null; onTagPress: (tag: string) => void }) {
  if (!tags || tags.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {tags.slice(0, 4).map((tag) => (
        <Pressable key={tag} onPress={() => onTagPress(tag)} hitSlop={4}>
          <Text
            style={{
              fontSize: 10,
              color: activeTag === tag ? "#fff" : "#1DB954",
              backgroundColor: activeTag === tag ? "#1DB954" : "transparent",
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
  return (
    <View
      style={{
        borderRadius: 16,
        borderBottomRightRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: selected ? "rgba(29,185,84,0.18)" : "#1e1e1e",
      }}
    >
      <Text
        style={{ fontSize: 14, color: "#ffffff", lineHeight: 21, textAlign: "right", writingDirection: "rtl" }}
      >
        {post.content}
      </Text>
      <TagRow tags={post.tags ?? []} activeTag={activeTag} onTagPress={onTagPress} />
      <View className="flex-row items-center justify-end gap-2 mt-1">
        {(post._count as any)?.comments > 0 && (
          <View className="flex-row items-center gap-0.5">
            <Icon name="MessageCircle" size={10} className="text-muted-foreground" />
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
  return (
    <View
      style={{
        borderRadius: 16,
        borderBottomRightRadius: 4,
        padding: 12,
        backgroundColor: selected ? "rgba(29,185,84,0.18)" : "#1e1e1e",
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
          <Icon name="Play" size={18} className="text-primary-foreground ml-0.5" />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-0.5 h-8">
          {[4, 8, 5, 12, 6, 10, 3, 9, 7, 11, 4, 8, 6, 10, 5].map((h, i) => (
            <View
              key={i}
              style={{ flex: 1, borderRadius: 9999, backgroundColor: "#282828", height: h * 2 }}
            />
          ))}
        </View>
        <Text className="text-[10px] text-muted-foreground shrink-0">
          {minuteToString(post.audio?.duration)}
        </Text>
      </View>
      <TagRow tags={post.tags ?? []} activeTag={activeTag} onTagPress={onTagPress} />
      <View className="flex-row items-center justify-end gap-2 mt-1.5">
        {(post._count as any)?.comments > 0 && (
          <View className="flex-row items-center gap-0.5">
            <Icon name="MessageCircle" size={10} className="text-muted-foreground" />
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
  return (
    <View
      style={{
        borderRadius: 16,
        borderBottomRightRadius: 4,
        overflow: "hidden",
        backgroundColor: selected ? "rgba(29,185,84,0.18)" : undefined,
      }}
    >
      <View className="h-40 bg-muted items-center justify-center">
        <Icon name="Image" size={32} className="text-muted-foreground" />
      </View>
      {post.caption && (
        <View className="px-3 pt-2">
          <Text className="text-sm text-foreground text-right" numberOfLines={3}>
            {post.caption}
          </Text>
        </View>
      )}
      <View className="px-3 pb-2 mt-1">
        <TagRow tags={post.tags ?? []} activeTag={activeTag} onTagPress={onTagPress} />
        <View className="flex-row items-center justify-end gap-2 mt-1">
          {(post._count as any)?.comments > 0 && (
            <View className="flex-row items-center gap-0.5">
              <Icon name="MessageCircle" size={10} className="text-muted-foreground" />
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
  onDelete: (id: number) => void;
  onAddToAlbum: (post: BlogItem) => void;
  onStartMerge: (id: number) => void;
}

function ContextMenu({ post, onClose, onDelete, onAddToAlbum, onStartMerge }: ContextMenuProps) {
  return (
    <View className="bg-card rounded-2xl overflow-hidden mx-4 shadow-xl">
      <Pressable
        onPress={() => { onAddToAlbum(post); onClose(); }}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-muted border-b border-border"
      >
        <Icon name="Music2" size={18} className="text-foreground" />
        <Text className="text-sm font-medium text-foreground">Add to Album</Text>
      </Pressable>
      <Pressable
        onPress={() => { onStartMerge(post.id); onClose(); }}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-muted border-b border-border"
      >
        <Icon name="Layers" size={18} className="text-foreground" />
        <Text className="text-sm font-medium text-foreground">Merge Selected</Text>
      </Pressable>
      <Pressable
        onPress={() => { onDelete(post.id); onClose(); }}
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
  onLongPress: (post: BlogItem) => void;
  onDelete: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onTagPress: (tag: string) => void;
}

function BubbleRow({
  post,
  selected,
  isSelectMode,
  activeTag,
  onLongPress,
  onDelete,
  onToggleSelect,
  onTagPress,
}: BubbleRowProps) {
  const router = useRouter();

  const renderRightActions = useCallback(() => {
    return (
      <Pressable
        onPress={() => onDelete(post.id)}
        className="bg-destructive items-center justify-center px-5 rounded-2xl my-0.5 active:opacity-80"
      >
        <Icon name="Trash2" size={22} className="text-white" />
      </Pressable>
    );
  }, [post.id, onDelete]);

  const handlePress = () => {
    if (isSelectMode) {
      onToggleSelect(post.id);
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
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
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
                  borderColor: selected ? "#1DB954" : "#888",
                  backgroundColor: selected ? "#1DB954" : "transparent",
                }}
              >
                {selected && <Icon name="Check" size={11} className="text-white" />}
              </View>
            </View>
          )}
          {bubble}
        </View>
      </Pressable>
    </Swipeable>
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
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#0d1f0d",
        borderBottomWidth: 1,
        borderBottomColor: "#1DB954",
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
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#1DB954" }}>
          #{tag}
        </Text>
        <Text style={{ fontSize: 10, color: "#6b7280" }}>
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
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const id = Number(channelId);

  const listRef = useRef<any>(null);

  const { data: channel } = useQuery(
    _trpc.channel.getChannel.queryOptions({ id })
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

  const reversedPosts = [...(posts ?? [])].reverse();

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

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation(
    _trpc.blog.deleteBlog.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          _trpc.blog.posts.queryOptions({ channelId: id } as any)
        );
      },
    })
  );

  function handleDelete(blogId: number) {
    deleteMutation.mutate({ id: blogId });
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

  // ── Add to Album modal ────────────────────────────────────────────────────
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [albumMediaIds, setAlbumMediaIds] = useState<number[]>([]);
  const [albumAuthorId, setAlbumAuthorId] = useState<number | undefined>();

  function openAlbumModal(mediaIds: number[], authorId?: number) {
    setAlbumMediaIds(mediaIds);
    setAlbumAuthorId(authorId);
    setShowAlbumModal(true);
  }

  function handleAddToAlbum(post: BlogItem) {
    const mediaId = post.audio?.id;
    if (mediaId) openAlbumModal([mediaId], post.audio?.authorId ?? undefined);
  }

  function handleBulkAddToAlbum() {
    const selectedPosts = (posts ?? []).filter((p) => selectedIds.has(p.id));
    const mediaIds = selectedPosts
      .map((p) => p.audio?.id)
      .filter((id): id is number => !!id);
    openAlbumModal(mediaIds, selectedPosts[0]?.audio?.authorId ?? undefined);
  }

  return (
    <View className="flex-1 bg-background">
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
            <Icon name={isSelectMode ? "X" : "ArrowLeft"} className="text-foreground" />
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
                <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
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
          inverted
          renderItem={({ item, index }) => {
            const prevPost = index < reversedPosts.length - 1 ? reversedPosts[index + 1] : null;
            const showDate =
              !prevPost ||
              formatDate(item.date, "YYYY-MM-DD") !== formatDate(prevPost.date, "YYYY-MM-DD");
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
              <Icon name="MessageCircle" size={48} className="text-muted-foreground mb-3" />
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
            <Pressable
              onPress={handleBulkAddToAlbum}
              className="flex-1 h-11 rounded-xl bg-primary items-center justify-center flex-row gap-2 active:opacity-80"
            >
              <Icon name="Music2" size={16} className="text-primary-foreground" />
              <Text className="text-sm font-bold text-primary-foreground">
                Add {selectedIds.size} to Album
              </Text>
            </Pressable>
            <Pressable
              onPress={clearSelection}
              className="h-11 px-4 rounded-xl bg-muted items-center justify-center active:opacity-70"
            >
              <Text className="text-sm font-semibold text-foreground">Cancel</Text>
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
            <Pressable onPress={(e) => e.stopPropagation()} className="max-h-[70%]">
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
    </View>
  );
}
