import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

const FEATURED_ITEMS = [
  { label: "Daily Reflections", color: "#1e40af" },
  { label: "History", color: "#0f766e" },
  { label: "Popular Now", color: "#b45309" },
  { label: "Religion", color: "#4f46e5" },
  { label: "Following", color: "#0369a1" },
  { label: "New Releases", color: "#be123c" },
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
