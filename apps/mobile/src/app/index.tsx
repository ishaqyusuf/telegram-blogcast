import { Platform, SafeAreaView, StatusBar, View } from "react-native";
import { HomeFeedHeader } from "@/components/home-feed/home-feed-header";
import { HomeFeedFilterChips } from "@/components/home-feed/home-feed-filter-chips";
import { HomeFeedPostCard } from "@/components/home-feed/home-feed-post-card";
import { DUMMY_FEED_DATA } from "@/components/home-feed/__mocks__/data";
import { HomeFeedFAB } from "@/components/home-feed/home-feed-fab";
import { HomeFeedMiniPlayer } from "@/components/home-feed/home-feed-mini-player";
import { HomeFeedBottomNav } from "@/components/home-feed/home-feed-bottom-nav";
import { LegendList } from "@legendapp/list";
import { useInfiniteLoader } from "@/components/infinite-loader";
import { _trpc } from "@/components/static-trpc";
import { useRef } from "react";
import { RefreshControl } from "react-native-gesture-handler";
import { ListEmptyComponent } from "@/components/list-empty-component";

export default function Home() {
  const {
    data: posts,
    ref: loadMoreRef,
    refetch,
    isRefetching,
  } = useInfiniteLoader({
    // filter: ,
    route: _trpc?.podcasts.posts, //["~types"].output['data'][],
  });
  const listRef = useRef(null);
  return (
    <View
      style={{
        flex: 1,
        paddingTop: Platform.OS == "android" ? StatusBar.currentHeight : 0,
      }}
      className=""
    >
      {/* <StatusBar style="dark" /> */}
      <HomeFeedHeader />
      <LegendList
        ref={listRef}
        refreshControl={
          // Add refresh control
          <RefreshControl
            refreshing={isRefetching} // Bind refreshing state
            onRefresh={refetch} // Bind refresh handler
          />
        }
        data={posts}
        renderItem={({ item }) => <HomeFeedPostCard post={item} />}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={<HomeFeedFilterChips />}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={{
          paddingBottom: 200,
          paddingTop: 16,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        recycleItems
        // numColumns={2}
        columnWrapperStyle={{ gap: 8 }}
        ListEmptyComponent={ListEmptyComponent}
      />
      <HomeFeedFAB />
      <HomeFeedMiniPlayer />
      <HomeFeedBottomNav />
    </View>
  );
}
