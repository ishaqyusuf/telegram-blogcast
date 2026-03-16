import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, ScrollView, Text, TextInput, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { getBlogHref } from "@/components/blog-card/utils";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const inputRef = useRef<TextInput>(null);

  const { data: recentSearches = [] } = useQuery(
    _trpc.blog.getRecentSearches.queryOptions()
  );

  const { data: tags = [] } = useQuery(_trpc.blog.getTags.queryOptions());

  const { data: results = [] } = useQuery(
    _trpc.blog.search.queryOptions({ q: submitted }),
    { enabled: submitted.length > 0 }
  );

  const saveSearch = useMutation(_trpc.blog.saveSearch.mutationOptions());

  function handleSubmit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
    saveSearch.mutate({ term: trimmed });
  }

  function handleTagPress(tag: string) {
    setQuery(tag);
    handleSubmit(tag);
  }

  function handleRecentPress(term: string) {
    setQuery(term);
    handleSubmit(term);
  }

  const showResults = submitted.length > 0;

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        {/* Search bar row */}
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 rounded-full bg-card items-center justify-center active:opacity-70"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <View className="flex-1 flex-row items-center bg-card rounded-xl px-3 h-10 gap-2">
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <TextInput
              ref={inputRef}
              placeholder="Search posts, tags…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => handleSubmit(query)}
              autoFocus
              returnKeyType="search"
              style={{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: 0 }}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setSubmitted("");
                }}
                className="active:opacity-70"
              >
                <Icon name="X" size={16} className="text-muted-foreground" />
              </Pressable>
            )}
          </View>
        </View>

        {showResults ? (
          /* ── Results ── */
          results.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-2">
              <Icon name="SearchX" size={40} className="text-muted-foreground" />
              <Text className="text-muted-foreground">No results for "{submitted}"</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item: any) => String(item.id)}
              contentContainerClassName="px-4 pb-8"
              ItemSeparatorComponent={() => <View className="h-2" />}
              renderItem={({ item }: { item: any }) => (
                <Pressable
                  onPress={() =>
                    router.push(
                      getBlogHref({ id: item.id, type: item.type } as any) as any,
                    )
                  }
                  className="bg-card rounded-xl px-4 py-3 active:opacity-80"
                >
                  <View className="flex-row items-center gap-2 mb-1.5">
                    <View className="px-2 py-0.5 rounded-md bg-muted">
                      <Text className="text-[10px] font-medium text-muted-foreground capitalize">
                        {item.type}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="text-sm text-foreground leading-relaxed"
                    numberOfLines={3}
                  >
                    {item.content}
                  </Text>
                  {item.blogTags?.length > 0 && (
                    <View className="flex-row gap-1.5 mt-2 flex-wrap">
                      {item.blogTags.slice(0, 3).map((bt: any, i: number) => (
                        <View key={i} className="px-2 py-0.5 rounded-md bg-muted">
                          <Text className="text-[10px] font-medium text-muted-foreground">
                            #{bt.tags?.title}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              )}
            />
          )
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <View className="px-4 pt-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-bold text-foreground">
                    Recent Searches
                  </Text>
                </View>
                <View className="gap-1">
                  {recentSearches.map((item: any) => (
                    <Pressable
                      key={item.id ?? item.searchTerm}
                      onPress={() => handleRecentPress(item.searchTerm)}
                      className="flex-row items-center gap-3 py-2.5 active:opacity-70"
                    >
                      <Icon name="Clock" size={16} className="text-muted-foreground" />
                      <Text className="flex-1 text-sm text-foreground">{item.searchTerm}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Discover Tags */}
            {tags.length > 0 && (
              <View className="px-4 pt-6">
                <Text className="text-base font-bold text-foreground mb-3">
                  Browse Tags
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {tags.map((tag: string) => (
                    <Pressable
                      key={tag}
                      onPress={() => handleTagPress(tag)}
                      className="px-3 py-1.5 rounded-full bg-card active:opacity-70"
                    >
                      <Text className="text-sm font-medium text-foreground">#{tag}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeArea>
    </View>
  );
}
