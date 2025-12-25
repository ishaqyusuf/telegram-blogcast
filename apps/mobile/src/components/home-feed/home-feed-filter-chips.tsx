import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { DUMMY_FILTERS } from "./__mocks__/data";

export function HomeFeedFilterChips() {
  const [activeFilter, setActiveFilter] = useState("All");

  return (
    <View className="py-3 pl-4 border-b border-slate-200 dark:border-slate-800/50 bg-background-light dark:bg-background-dark">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 pr-4">
          {DUMMY_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => setActiveFilter(filter)}
              className={`px-4 h-9 rounded-full items-center justify-center transition-colors ${
                activeFilter === filter
                  ? "bg-slate-900 dark:bg-white"
                  : "bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700"
              }`}
            >
              <Text
                className={`text-sm font-medium whitespace-nowrap ${
                  activeFilter === filter
                    ? "text-white dark:text-slate-900 font-bold"
                    : "text-foreground"
                }`}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
