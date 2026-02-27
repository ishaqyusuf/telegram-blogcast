import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { LegendList } from "@legendapp/list";
import { useLocalSearchParams, useRouter } from "expo-router";

import { BlogCard } from "@/components/blog-card";
import { BlogHomeAlbums } from "@/components/blog-home/blog-home-albums";
import { BlogHomeAnalytics } from "@/components/blog-home/blog-home-analytics";
import { BlogHomeBooks } from "@/components/blog-home/blog-home-books";
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

  useEffect(() => {
    refetch();
  }, [category, refetch]);

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <BlogHomeHeader />
        <View className="flex-1 relative">
          <LegendList
            data={posts}
            renderItem={({ item }) => (
              <View className="px-4">
                <BlogCard post={item} />
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
