import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { minuteToString } from "@/lib/utils";
import { useColors } from "@/hooks/use-color";
import {
  useRecentlyViewedStore,
  type RecentlyViewedItem,
} from "@/store/recently-viewed-store";

type ActivityTab = "played" | "blog" | "pdf";

const ACTIVITY_TABS: { key: ActivityTab; label: string }[] = [
  { key: "played", label: "Recently played" },
  { key: "blog", label: "Blog" },
  { key: "pdf", label: "Pdf" },
];

const VIEWED_TYPE_ICONS = {
  audio: "Headphones",
  video: "Play",
  text: "FileText",
  image: "Image",
  pdf: "FileText",
  document: "FileText",
} as const;

const VIEWED_TYPE_LABELS: Record<string, string> = {
  audio: "Audio",
  video: "Video",
  text: "Blog",
  image: "Image",
  pdf: "Pdf",
  document: "Pdf",
};

function formatProgress(progressMs: number, durationSec?: number | null) {
  const posMin = Math.floor(progressMs / 60000);
  const posSec = Math.floor((progressMs % 60000) / 1000);
  const pos = `${String(posMin).padStart(2, "0")}:${String(posSec).padStart(2, "0")}`;
  if (!durationSec) return pos;
  const dur = minuteToString(durationSec);
  return `${pos} / ${dur}`;
}

function getViewedHref(item: RecentlyViewedItem) {
  if (item.type === "audio") return `/blog-view-2/${item.id}`;
  if (item.type === "text") return `/blog-view-text/${item.id}`;
  return `/blog-view/${item.id}`;
}

export function BlogHomeRecentlyPlayed() {
  const router = useRouter();
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<ActivityTab>("played");
  const viewedItems = useRecentlyViewedStore((state) => state.items);
  const { data: history = [] } = useQuery(
    _trpc.blog.getRecentlyPlayed.queryOptions({ limit: 10 }),
  );

  const blogItems = useMemo(
    () =>
      viewedItems
        .filter((item) => !["audio", "pdf", "document"].includes(item.type))
        .slice(0, 10),
    [viewedItems],
  );
  const pdfItems = useMemo(
    () =>
      viewedItems
        .filter((item) => item.type === "pdf" || item.type === "document")
        .slice(0, 10),
    [viewedItems],
  );
  const counts = {
    played: history.length,
    blog: blogItems.length,
    pdf: pdfItems.length,
  };
  const hasActivity = counts.played > 0 || counts.blog > 0 || counts.pdf > 0;
  if (!hasActivity) return null;

  const selectedTab = activeTab;
  const selectedViewedItems = selectedTab === "blog" ? blogItems : pdfItems;
  const emptyLabel =
    selectedTab === "played"
      ? "No recently played audio"
      : selectedTab === "blog"
        ? "No recent blog activity"
        : "No recent PDF activity";

  return (
    <View className="pt-4 pb-2">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text
          className="text-base font-bold text-foreground"
          style={{ color: colors.foreground }}
        >
          Recent Activity
        </Text>
        {selectedTab === "played" ? (
          <Pressable
            onPress={() => router.push("/play-history" as any)}
            className="active:opacity-70"
          >
            <Text
              className="text-sm font-medium text-primary"
              style={{ color: colors.primary }}
            >
              See all
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => useRecentlyViewedStore.getState().clear()}
            className="active:opacity-70"
          >
            <Text
              className="text-xs text-muted-foreground"
              style={{ color: colors.mutedForeground }}
            >
              Clear
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 pb-3"
      >
        {ACTIVITY_TABS.map((tab) => {
          const active = selectedTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="h-9 flex-row items-center justify-center rounded-full px-3 active:opacity-80"
              style={{
                backgroundColor: active ? colors.primary : colors.muted,
              }}
            >
              <Text
                className="text-xs font-bold"
                style={{
                  color: active ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
      >
        {selectedTab === "played" &&
          history.map((item) => {
          const duration = item.Media?.file?.duration;
          const title = getAudioDisplayTitle({
            content: item.Media?.blog?.content?.slice(0, 40),
            media: item.Media,
          });
          const progressPct =
            duration && duration > 0
              ? Math.min((item.progress / 1000 / duration) * 100, 100)
              : 0;

          return (
            <Pressable
              key={item.id}
              onPress={() =>
                item.Media?.blog?.id &&
                router.push(`/blog-view-2/${item.Media.blog.id}` as any)
              }
              className="w-[130px] active:opacity-80"
            >
              {/* Thumbnail */}
              <View
                className="w-full h-24 rounded-xl bg-muted items-center justify-center mb-2 relative overflow-hidden"
                style={{ backgroundColor: colors.muted }}
              >
                <Icon
                  name="Headphones"
                  size={32}
                  className="text-muted-foreground"
                />
                {/* Progress bar at bottom */}
                <View
                  className="absolute bottom-0 left-0 right-0 h-1 bg-muted"
                  style={{ backgroundColor: colors.muted }}
                >
                  <View
                    style={{
                      height: "100%",
                      backgroundColor: colors.primary,
                      width: `${progressPct}%`,
                    }}
                  />
                </View>
              </View>
              <Text
                className="text-xs font-bold text-foreground"
                numberOfLines={2}
                style={{ color: colors.foreground }}
              >
                {title}
              </Text>
              <View className="flex-row items-center gap-1 mt-0.5">
                <Icon
                  name="Clock"
                  size={10}
                  className="text-muted-foreground"
                />
                <Text
                  className="text-[10px] text-muted-foreground"
                  style={{ color: colors.mutedForeground }}
                >
                  {formatProgress(item.progress, duration)}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {selectedTab !== "played" &&
          selectedViewedItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(getViewedHref(item) as any)}
              className="w-[112px] active:opacity-80"
            >
              <View
                className="h-24 w-full items-center justify-center rounded-xl border border-border bg-card mb-2 relative"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <View
                  className="absolute right-2 top-2 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text
                    className="text-[9px] font-bold"
                    style={{ color: colors.primaryForeground }}
                  >
                    {VIEWED_TYPE_LABELS[item.type] ?? "Blog"}
                  </Text>
                </View>
                <Icon
                  name={
                    VIEWED_TYPE_ICONS[
                      item.type as keyof typeof VIEWED_TYPE_ICONS
                    ] ?? "FileText"
                  }
                  size={28}
                  className="text-muted-foreground"
                />
              </View>
              <Text
                className="text-xs font-bold text-foreground"
                numberOfLines={2}
                style={{ color: colors.foreground }}
              >
                {item.title}
              </Text>
            </Pressable>
          ))}

        {counts[selectedTab] === 0 && (
          <View
            className="h-24 justify-center rounded-xl border border-border bg-card px-4"
            style={{
              width: 220,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-sm font-medium text-muted-foreground"
              style={{ color: colors.mutedForeground }}
            >
              {emptyLabel}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
