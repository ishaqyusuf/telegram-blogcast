import { useInfiniteLoader } from "@/components/infinite-loader";
import { View } from "react-native";
import { LegendList } from "@legendapp/list";
import { BlogListItem } from "@/components/blog-list-item";
import { ListEmptyComponent } from "@/components/list-empty-component";
import { _trpc } from "@/components/static-trpc";
import { useRef } from "react";
import { RefreshControl } from "react-native-gesture-handler";
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
    <View>
      <LegendList
        ref={listRef}
        data={posts}
        refreshControl={
          // Add refresh control
          <RefreshControl
            refreshing={isRefetching} // Bind refreshing state
            onRefresh={refetch} // Bind refresh handler
          />
        }
        renderItem={({ item }) => <BlogListItem item={item} />}
        // keyExtractor={({ id }) => id.toString()}
        keyExtractor={(item) => item?.id.toString()}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        recycleItems
        numColumns={2}
        columnWrapperStyle={{ gap: 8 }}
        ListHeaderComponent={() => <></>}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmptyComponent}
      />
    </View>
  );
}
