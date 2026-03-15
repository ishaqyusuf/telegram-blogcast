import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

const CATEGORIES = ["All", "Following", "Popular", "History", "Religion"];

export function BlogHomeCategoryTabs() {
  const [active, setActive] = useState("All");

  return (
    <View className="py-3 pl-4 bg-background">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pr-4"
      >
        {CATEGORIES.map((cat) => {
          const isActive = cat === active;
          return (
            <Pressable
              key={cat}
              onPress={() => setActive(cat)}
              className={`px-4 h-8 rounded-full items-center justify-center ${
                isActive ? "bg-primary" : "bg-muted"
              }`}
            >
              <Text
                className={`text-sm ${
                  isActive
                    ? "text-primary-foreground font-bold"
                    : "text-muted-foreground font-medium"
                }`}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
