import { SafeAreaView, View } from "react-native";
import { HomeFeedHeader } from "@/components/home-feed/home-feed-header";
import { HomeFeedFilterChips } from "@/components/home-feed/home-feed-filter-chips";
import { HomeFeedPostCard } from "@/components/home-feed/home-feed-post-card";
import { DUMMY_FEED_DATA } from "@/components/home-feed/__mocks__/data";
import { HomeFeedFAB } from "@/components/home-feed/home-feed-fab";
import { HomeFeedMiniPlayer } from "@/components/home-feed/home-feed-mini-player";
import { HomeFeedBottomNav } from "@/components/home-feed/home-feed-bottom-nav";
import { StatusBar } from "expo-status-bar";
import { LegendList } from "@legendapp/list";

export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1 }} className="">
      {/* <StatusBar style="dark" /> */}
      <HomeFeedHeader />
      <LegendList
        data={DUMMY_FEED_DATA}
        renderItem={({ item }) => <HomeFeedPostCard post={item} />}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<HomeFeedFilterChips />}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={{
          paddingBottom: 200,
          paddingTop: 16,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      />
      <HomeFeedFAB />
      <HomeFeedMiniPlayer />
      <HomeFeedBottomNav />
    </SafeAreaView>
  );
}
