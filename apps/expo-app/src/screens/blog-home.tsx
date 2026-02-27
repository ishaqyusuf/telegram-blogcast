import { useMemo } from "react";
import { View } from "react-native";
import { LegendList } from "@legendapp/list";

import { BlogCard } from "@/components/blog-card";
import { BlogHomeCategoryTabs } from "@/components/blog-home/blog-home-category-tabs";
import { BlogHomeFab } from "@/components/blog-home/blog-home-fab";
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
    route: _trpc?.podcasts.posts,
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
                <BlogHomeCategoryTabs />
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
