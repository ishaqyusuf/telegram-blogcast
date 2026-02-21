import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";

interface BlogSearchProps {
  onBackPress: () => void;
}

const RecentSearchItem = ({ text }: { text: string }) => (
  <View className="flex-row items-center justify-between py-3 border-b border-border">
    <View className="flex-row items-center gap-3">
      <Icon name="Clock" className="size-[18px] text-muted-foreground" />
      <Text className="text-foreground font-medium">{text}</Text>
    </View>
    <Pressable className="p-1 active:opacity-50">
      <Icon name="X" className="size-4 text-muted-foreground" />
    </Pressable>
  </View>
);

const Tag = ({ text }: { text: string }) => (
  <Pressable className="bg-card border border-border px-4 py-2 rounded-full active:bg-muted">
    <Text className="text-sm text-foreground">{text}</Text>
  </Pressable>
);

export default function BlogSearch({ onBackPress }: BlogSearchProps) {
  const [searchText, setSearchText] = useState("");

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        {/* Header with Search Input */}
        <View className="flex-row items-center px-4 py-3 gap-3 border-b border-border">
          <Pressable
            onPress={onBackPress}
            className="p-2 -ml-2 rounded-full active:bg-muted"
          >
            <Icon name="ArrowLeft" className="size-16 text-foreground" />
          </Pressable>

          <View className="flex-1 flex-row items-center bg-card h-10 rounded-full px-3 gap-2 border border-border">
            <Icon name="Search" className="size-[18px] text-muted-foreground" />
            <TextInput
              className="flex-1 text-foreground text-sm h-full"
              placeholder="Search topics, tags..."
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText("")}>
                <Icon name="X" className="size-[18px] text-muted-foreground" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
          {/* Recent Searches */}
          <View className="mb-6">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Recent
            </Text>
            <RecentSearchItem text="Digital Nomadism" />
            <RecentSearchItem text="Mindfulness Meditation" />
            <RecentSearchItem text="Kyoto Travel Guide" />
          </View>

          {/* Discover Tags */}
          <View>
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Discover
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Tag text="#Technology" />
              <Tag text="#Design" />
              <Tag text="#Photography" />
              <Tag text="#Culture" />
              <Tag text="#RemoteWork" />
              <Tag text="#Productivity" />
              <Tag text="#Art" />
            </View>
          </View>
        </ScrollView>
      </SafeArea>
    </View>
  );
}
