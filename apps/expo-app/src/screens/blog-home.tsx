import { Text, View } from "react-native";
import { LegendList } from "@legendapp/list";

import { BlogCard } from "@/components/blog-card";
import { BlogHomeCategoryTabs } from "@/components/blog-home/blog-home-category-tabs";
import { BlogHomeChannels } from "@/components/blog-home/blog-home-channels";
import { BlogHomeFeatured } from "@/components/blog-home/blog-home-featured";
import { BlogHomeRecentlyPlayed } from "@/components/blog-home/blog-home-recently-played";
import { BlogHomeHeader } from "@/components/blog-home/blog-home-header";
import { BlogHomeMiniPlayer } from "@/components/blog-home/blog-home-mini-player";
import { HomeBottomNav } from "@/components/home-bottom-footer";
import { useInfiniteLoader } from "@/components/infinite-loader";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";

export default function BlogHomeScreen() {
  const {
    data: posts,
    hasNextPage,
    isFetching,
    fetchNextPage,
  } = useInfiniteLoader({
    route: _trpc?.blog.posts,
  });

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
                <BlogHomeFeatured />
                <BlogHomeChannels />
                <BlogHomeRecentlyPlayed />
                <BlogHomeCategoryTabs />
                <Text className="px-4 pt-4 pb-2 text-base font-bold text-foreground">
                  Latest Posts
                </Text>
              </>
            }
            ListFooterComponent={<View className="h-36 px-4" />}
            ItemSeparatorComponent={() => <View className="h-3" />}
            onEndReached={() => {
              if (hasNextPage && !isFetching) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.4}
          />
          <BlogHomeMiniPlayer />
        </View>
      </SafeArea>
      <HomeBottomNav />
    </View>
  );
}
