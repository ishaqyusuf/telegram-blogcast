import { useQuery } from "@/lib/react-query";
import { Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

const STATS = [
  {
    key: "totalPosts",
    label: "Posts",
    icon: "FileText" as const,
    tone: "primary",
  },
  {
    key: "audioPosts",
    label: "Audio",
    icon: "Headphones" as const,
    tone: "success",
  },
  { key: "totalViews", label: "Views", icon: "Eye" as const, tone: "warn" },
  {
    key: "totalReactions",
    label: "Reactions",
    icon: "Heart" as const,
    tone: "destructive",
  },
] as const;

export function BlogHomeAnalytics() {
  const { data } = useQuery(_trpc.blog.getAnalytics.queryOptions());
  const colors = useColors();

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
              backgroundColor: withAlpha(colors[stat.tone], 0.14),
            }}
          >
            <Icon
              name={stat.icon}
              className={
                stat.tone === "primary"
                  ? "size-sm text-primary"
                  : stat.tone === "success"
                    ? "size-sm text-success"
                    : stat.tone === "warn"
                      ? "size-sm text-warn"
                      : "size-sm text-destructive"
              }
            />
            <Text
              className="text-base font-bold text-foreground"
              style={{ color: colors.foreground }}
            >
              {data?.[stat.key] ?? "—"}
            </Text>
            <Text
              className="text-[10px] text-muted-foreground"
              style={{ color: colors.mutedForeground }}
            >
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
