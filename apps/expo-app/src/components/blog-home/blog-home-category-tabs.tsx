import { Pressable, ScrollView, Text, View } from "react-native";

const CATEGORIES = ["All", "Following", "Popular", "History", "Religion"];

export function BlogHomeCategoryTabs() {
  return (
    <View className="py-3 pl-4 border-b border-border bg-background">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pr-4"
      >
        {CATEGORIES.map((cat, index) => {
          const isActive = index === 0;
          return (
            <Pressable
              key={cat}
              className={`px-4 h-9 rounded-full items-center justify-center border ${
                isActive
                  ? "bg-accent border-accent"
                  : "bg-card border-border active:bg-muted"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isActive
                    ? "text-accent-foreground font-bold"
                    : "text-muted-foreground"
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
