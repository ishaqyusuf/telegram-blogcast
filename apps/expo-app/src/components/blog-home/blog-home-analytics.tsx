import { useQuery } from "@acme/ui/tanstack";
import { Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";

const STATS = [
  { key: "totalPosts", label: "Posts", icon: "FileText" as const, color: "#4c1d95" },
  { key: "audioPosts", label: "Audio", icon: "Headphones" as const, color: "#14532d" },
  { key: "totalViews", label: "Views", icon: "Eye" as const, color: "#1e3a5f" },
  { key: "totalReactions", label: "Reactions", icon: "Heart" as const, color: "#7c2d12" },
] as const;

export function BlogHomeAnalytics() {
  const { data } = useQuery(_trpc.blog.getAnalytics.queryOptions());

  return (
    <View className="px-4 pt-3 pb-1">
      <View className="flex-row gap-2">
        {STATS.map((stat) => (
          <View
            key={stat.key}
            className="flex-1 rounded-xl p-3 gap-1 items-center"
            style={{ backgroundColor: stat.color + "33" }}
          >
            <Icon name={stat.icon} size={18} className="text-foreground" style={{ color: stat.color + "cc" } as any} />
            <Text className="text-base font-bold text-foreground">
              {data?.[stat.key] ?? "—"}
            </Text>
            <Text className="text-[10px] text-muted-foreground">{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
