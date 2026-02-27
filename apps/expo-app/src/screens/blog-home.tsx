import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { LegendList } from "@legendapp/list";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { BlogCard } from "@/components/blog-card";
import { BlogHomeAlbums } from "@/components/blog-home/blog-home-albums";
import { BlogHomeAnalytics } from "@/components/blog-home/blog-home-analytics";
import { BlogHomeBooks } from "@/components/blog-home/blog-home-books";
import type { BlogItem } from "@/components/blog-card";
import {
  BlogCategory,
  BlogHomeCategoryTabs,
} from "@/components/blog-home/blog-home-category-tabs";
import { BlogHomeChannels } from "@/components/blog-home/blog-home-channels";
import { BlogHomeFab } from "@/components/blog-home/blog-home-fab";
import { BlogHomeFeatured } from "@/components/blog-home/blog-home-featured";
import { BlogHomeHeader } from "@/components/blog-home/blog-home-header";
import { BlogHomeMiniPlayer } from "@/components/blog-home/blog-home-mini-player";
import { BlogHomeRecentlyPlayed } from "@/components/blog-home/blog-home-recently-played";
import { BlogHomeRecentlyViewed } from "@/components/blog-home/blog-home-recently-viewed";
import { HomeBottomNav } from "@/components/home-bottom-footer";
import { useInfiniteLoader } from "@/components/infinite-loader";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { invalidateQueries } from "@/lib/trpc";

export default function BlogHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();

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
    fetchNextPage,
    refetch,
  } = useInfiniteLoader({
    filter: {
      category,
    },
    route: _trpc?.blog.posts,
  });
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<number>>(new Set());
  const deleteBlogMutation = useMutation(
    _trpc.blog.deleteBlog.mutationOptions({
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
      try {
        await deleteBlogMutation.mutateAsync({ id: post.id });
      } catch {
        setHiddenPostIds((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
        Alert.alert("Delete failed", "Could not delete this post. Try again.");
      }
    },
    [deleteBlogMutation],
  );

  useEffect(() => {
    setHiddenPostIds(new Set());
    refetch();
  }, [category, refetch]);

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <BlogHomeHeader />
        <View className="flex-1 relative">
          <LegendList
            data={visiblePosts}
            renderItem={({ item }) => (
              <View className="px-4">
                <BlogCard post={item} onDelete={handleDeletePost} />
              </View>
            )}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={
              <>
                <BlogHomeAnalytics />
                <BlogHomeFeatured />
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
                  Latest Posts
                </Text>
                <View className="h-4" />
              </>
            }
            ListFooterComponent={<View className="h-40 px-4" />}
            ItemSeparatorComponent={() => <View className="h-4" />}
            onEndReached={() => {
              if (hasNextPage && !isFetching) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.4}
          />
          <BlogHomeFab />
          <BlogHomeMiniPlayer />
        </View>
      </SafeArea>
      <HomeBottomNav />
    </View>
  );
}
