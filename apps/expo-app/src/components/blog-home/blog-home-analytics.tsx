import { useQuery } from "@/lib/react-query";
import { Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";

const STATS = [
  { key: "totalPosts", label: "Posts", icon: "FileText" as const, color: "#1e40af" },
  { key: "audioPosts", label: "Audio", icon: "Headphones" as const, color: "#0f766e" },
  { key: "totalViews", label: "Views", icon: "Eye" as const, color: "#b45309" },
  { key: "totalReactions", label: "Reactions", icon: "Heart" as const, color: "#be123c" },
] as const;

export function BlogHomeAnalytics() {
  const { data } = useQuery(_trpc.blog.getAnalytics.queryOptions());

  return (
    <View className="px-4 pt-3 pb-1">
      <View className="flex-row gap-2">
        {STATS.map((stat) => (
          <View
            key={stat.key}
            style={{
              flex: 1,
              borderRadius: 12,
              padding: 12,
              gap: 4,
              alignItems: "center",
              backgroundColor: stat.color + "33",
            }}
          >
            <Icon name={stat.icon} size={18} style={{ color: stat.color + "cc" } as any} />
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
