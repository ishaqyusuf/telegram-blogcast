import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  Text,
  UIManager,
  View,
} from "react-native";
import { LegendList } from "@legendapp/list";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { BlogCard } from "@/components/blog-card";
import { AddToAlbumModal } from "@/components/channel-chat/add-to-album-modal";
import { BlogHomeAlbums } from "@/components/blog-home/blog-home-albums";
import { BlogHomeAnalytics } from "@/components/blog-home/blog-home-analytics";
import { BlogHomeBooks } from "@/components/blog-home/blog-home-books";
import { BlogHomeBooksCta } from "@/components/blog-home/blog-home-books-cta";
import type { BlogItem } from "@/components/blog-card";
import {
  BlogCategory,
  BlogHomeCategoryTabs,
} from "@/components/blog-home/blog-home-category-tabs";
import { BlogHomeChannels } from "@/components/blog-home/blog-home-channels";
import { BlogHomeFab } from "@/components/blog-home/blog-home-fab";
import { BlogHomeHeader } from "@/components/blog-home/blog-home-header";
import { BlogHomeRecentlyPlayed } from "@/components/blog-home/blog-home-recently-played";
import { BlogHomeRecentlyViewed } from "@/components/blog-home/blog-home-recently-viewed";
import { useInfiniteLoader } from "@/components/infinite-loader";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast } from "@/components/ui/toast";
import { invalidateQueries } from "@/lib/trpc";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AUDIO_BAR_SCROLL_HIDE_THRESHOLD = 28;
const AUDIO_BAR_SCROLL_SHOW_THRESHOLD = -18;

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

export function BlogHomeSkeleton() {
  const colors = useColors();

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <BlogHomeHeader />
        <View className="flex-1 relative">
          <View className="px-4">
            <BlogHomeCategoryTabs selected="All" onSelect={() => undefined} />
          </View>
          <View className="h-4" />
          <View className="flex-1 border-t border-border">
            {[0, 1, 2].map((key) => (
              <View
                key={key}
                className="border-b border-border bg-background p-4"
                style={{
                  backgroundColor: colors.background,
                  borderBottomColor: colors.border,
                }}
              >
                <View className="mb-3 flex-row items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <View className="flex-1 gap-2">
                    <Skeleton className="h-4 w-2/5 rounded-md" />
                    <Skeleton className="h-3 w-1/4 rounded-md" />
                  </View>
                </View>
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="mt-3 h-4 w-full rounded-md" />
                <Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
                <Skeleton className="mt-4 h-48 w-full rounded-xl" />
              </View>
            ))}
          </View>
          <BlogHomeFab />
        </View>
      </SafeArea>
    </View>
  );
}

export default function BlogHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const setGlobalAudioBarScrollHidden = useGlobalAudioBarStore(
    (s) => s.setScrollHidden,
  );
  const lastScrollYRef = useRef(0);
  const scrollDeltaAccumulatorRef = useRef(0);
  const audioBarScrollHiddenRef = useRef(false);

  const selectedCategory = useMemo<BlogCategory>(() => {
    const map: Record<string, BlogCategory> = {
      all: "All",
      audio: "Audio",
      text: "Text",
      picture: "Picture",
      video: "Video",
      likes: "Likes",
      saved: "Saved",
    };
    return map[(params.category || "all").toLowerCase()] ?? "All";
  }, [params.category]);

  const category = useMemo(() => {
    const map: Record<
      BlogCategory,
      "all" | "audio" | "text" | "picture" | "video" | "likes" | "saved"
    > = {
      All: "all",
      Audio: "audio",
      Text: "text",
      Picture: "picture",
      Video: "video",
      Likes: "likes",
      Saved: "saved",
    };
    return map[selectedCategory];
  }, [selectedCategory]);

  const onSelectCategory = (value: BlogCategory) => {
    const map: Record<
      BlogCategory,
      "all" | "audio" | "text" | "picture" | "video" | "likes" | "saved"
    > = {
      All: "all",
      Audio: "audio",
      Text: "text",
      Picture: "picture",
      Video: "video",
      Likes: "likes",
      Saved: "saved",
    };
    router.setParams({ category: map[value] });
  };

  const {
    data: posts,
    hasNextPage,
    isFetching,
    isRefetching,
    fetchNextPage,
    refetch,
  } = useInfiniteLoader({
    filter: {
      category,
    },
    route: _trpc?.blog.posts,
  });
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<number>>(new Set());
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [albumMediaIds, setAlbumMediaIds] = useState<number[]>([]);
  const [albumAuthorId, setAlbumAuthorId] = useState<number | undefined>();
  const deleteBlogMutation = useMutation(
    _trpc.blog.deleteBlog.mutationOptions({
      onSettled: () => {
        invalidateQueries("infinite", ["blog.posts"]);
      },
    }),
  );
  const restoreBlogMutation = useMutation(
    _trpc.blog.restoreBlog.mutationOptions({
      onSettled: () => {
        invalidateQueries("infinite", ["blog.posts"]);
      },
    }),
  );
  const visiblePosts = useMemo(
    () => posts.filter((post) => !hiddenPostIds.has(post.id)),
    [posts, hiddenPostIds],
  );
  const handleDeletePost = useCallback(
    async (post: BlogItem) => {
      setHiddenPostIds((prev) => new Set(prev).add(post.id));
      let deleteFailed = false;
      const deletePromise = deleteBlogMutation
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
          await restoreBlogMutation.mutateAsync({ id: post.id });
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
    [deleteBlogMutation, restoreBlogMutation],
  );

  const handleAddToAlbum = useCallback((post: BlogItem) => {
    const mediaId = post.audio?.mediaId;
    if (!mediaId) return;
    setAlbumMediaIds([mediaId]);
    setAlbumAuthorId(post.audio?.authorId ?? undefined);
    setShowAlbumModal(true);
  }, []);

  useEffect(() => {
    setHiddenPostIds(new Set());
    refetch();
  }, [category, refetch]);

  const onRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    setHiddenPostIds(new Set());
    try {
      await refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const handleScroll = useCallback(
    (event: any) => {
      const currentY = event.nativeEvent.contentOffset?.y ?? 0;
      const deltaY = currentY - lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      if (currentY <= 0) {
        scrollDeltaAccumulatorRef.current = 0;
        if (audioBarScrollHiddenRef.current) {
          audioBarScrollHiddenRef.current = false;
          setGlobalAudioBarScrollHidden(false);
        }
        return;
      }

      if (Math.abs(deltaY) < 2) return;

      const previousAccumulated = scrollDeltaAccumulatorRef.current;
      const changedDirection =
        (previousAccumulated > 0 && deltaY < 0) ||
        (previousAccumulated < 0 && deltaY > 0);

      scrollDeltaAccumulatorRef.current = changedDirection
        ? deltaY
        : previousAccumulated + deltaY;

      if (
        scrollDeltaAccumulatorRef.current > AUDIO_BAR_SCROLL_HIDE_THRESHOLD &&
        !audioBarScrollHiddenRef.current
      ) {
        audioBarScrollHiddenRef.current = true;
        scrollDeltaAccumulatorRef.current = 0;
        setGlobalAudioBarScrollHidden(true);
      } else if (
        scrollDeltaAccumulatorRef.current < AUDIO_BAR_SCROLL_SHOW_THRESHOLD &&
        audioBarScrollHiddenRef.current
      ) {
        audioBarScrollHiddenRef.current = false;
        scrollDeltaAccumulatorRef.current = 0;
        setGlobalAudioBarScrollHidden(false);
      }
    },
    [setGlobalAudioBarScrollHidden],
  );

  useEffect(() => {
    return () => {
      audioBarScrollHiddenRef.current = false;
      setGlobalAudioBarScrollHidden(false);
    };
  }, [setGlobalAudioBarScrollHidden]);

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <BlogHomeHeader />
        <View className="flex-1 relative">
          <LegendList
            style={{ backgroundColor: colors.background }}
            data={visiblePosts}
            renderItem={({ item }) => (
              <View>
                <BlogCard
                  post={item}
                  onDelete={handleDeletePost}
                  onAddToAlbum={handleAddToAlbum}
                />
              </View>
            )}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={
              <>
                <BlogHomeAnalytics />
                <BlogHomeBooksCta />
                <BlogHomeChannels />
                <BlogHomeRecentlyViewed />
                <BlogHomeRecentlyPlayed />
                <BlogHomeAlbums />
                <BlogHomeBooks />
                <BlogHomeCategoryTabs
                  selected={selectedCategory}
                  onSelect={onSelectCategory}
                />
                <Text className="px-4 pt-4 pb-2 text-base font-bold text-foreground">
                  {t("latestPosts")}
                </Text>
                <View
                  className="border-t border-border"
                  style={{ borderTopColor: colors.border }}
                />
              </>
            }
            ListFooterComponent={<View className="h-40 px-4" />}
            refreshing={isPullRefreshing || isRefetching}
            onRefresh={onRefresh}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onEndReached={() => {
              if (hasNextPage && !isFetching) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.4}
          />
          <BlogHomeFab />
        </View>
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
                    invalidateQueries("infinite", ["blog.posts"]);
                  }}
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </SafeArea>
    </View>
  );
}
