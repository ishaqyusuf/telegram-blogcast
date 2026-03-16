import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

const FEATURED_ITEMS = [
  { label: "Daily Reflections", color: "#4c1d95" },
  { label: "History", color: "#7c2d12" },
  { label: "Popular Now", color: "#14532d" },
  { label: "Religion", color: "#1e3a5f" },
  { label: "Following", color: "#3b0764" },
  { label: "New Releases", color: "#7f1d1d" },
];

function getInitials(label: string) {
  return label
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function BlogHomeFeatured() {
  return (
    <View className="px-4 pt-4 pb-2">
      <View className="flex-row flex-wrap gap-2">
        {FEATURED_ITEMS.map((item) => (
          <Pressable
            key={item.label}
            className="w-[48%] active:opacity-80"
          >
            <View className="flex-row items-center rounded-lg overflow-hidden bg-card h-14">
              <View
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: item.color,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Text className="text-sm font-bold text-white">
                  {getInitials(item.label)}
                </Text>
              </View>
              <Text
                className="flex-1 px-3 text-sm font-bold text-foreground"
                numberOfLines={2}
              >
                {item.label}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
