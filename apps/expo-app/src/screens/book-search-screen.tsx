import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { localDb } from "@/db/local-db";
import { localParagraphs, localPages } from "@/db/local-schema";
import { eq, sql } from "drizzle-orm";

type SearchResult = {
  pageId: number;
  chapterTitle: string | null;
  topicTitle: string | null;
  printedPageNo: number | null;
  shamelaPageNo: number;
  volumeId: number | null;
  snippet: string | null;
  matchType: "title" | "paragraph";
};

export default function BookSearchScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const bookIdNum = Number(bookId);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [offlineResults, setOfflineResults] = useState<SearchResult[] | null>(null);
  const [isOfflineSearching, setIsOfflineSearching] = useState(false);

  const isDownloaded = useBookOfflineStore((s) => s.isDownloaded(bookIdNum));

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // Server search (when not downloaded, or when online)
  const { data: serverResults, isFetching: isServerSearching } = useQuery({
    ...(_trpc.book.searchBookContent.queryOptions({ bookId: bookIdNum, query: debouncedQuery })),
    enabled: debouncedQuery.length >= 2 && !isDownloaded,
  });

  // Offline SQLite search (when downloaded)
  const searchOffline = useCallback(async (q: string) => {
    if (q.length < 2) { setOfflineResults(null); return; }
    setIsOfflineSearching(true);
    try {
      // FTS5 search on paragraphs — use all() to get named-column rows
      const paraRows = await localDb.all<{ id: number; page_id: number; text: string }>(
        sql`SELECT p.id, p.page_id, p.text FROM local_paragraphs_fts f JOIN local_paragraphs p ON p.id = f.rowid WHERE local_paragraphs_fts MATCH ${q + "*"} LIMIT 30`
      );

      // Title search on pages
      const pageRows = await localDb
        .select()
        .from(localPages)
        .where(eq(localPages.bookId, bookIdNum))
        .limit(30);

      const titleMatches = pageRows.filter(
        (p) =>
          p.chapterTitle?.includes(q) ||
          p.topicTitle?.includes(q)
      );

      const seen = new Set<number>();
      const results: SearchResult[] = [];

      for (const p of titleMatches) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          results.push({
            pageId: p.id,
            chapterTitle: p.chapterTitle,
            topicTitle: p.topicTitle,
            printedPageNo: p.printedPageNo,
            shamelaPageNo: p.shamelaPageNo,
            volumeId: p.volumeId,
            snippet: null,
            matchType: "title",
          });
        }
      }

      // For FTS matches, fetch the page info
      for (const row of paraRows) {
        const pageId = row.page_id;
        if (!seen.has(pageId)) {
          seen.add(pageId);
          const [pg] = await localDb
            .select()
            .from(localPages)
            .where(eq(localPages.id, pageId));
          if (pg) {
            results.push({
              pageId: pg.id,
              chapterTitle: pg.chapterTitle,
              topicTitle: pg.topicTitle,
              printedPageNo: pg.printedPageNo,
              shamelaPageNo: pg.shamelaPageNo,
              volumeId: pg.volumeId,
              snippet: row.text.slice(0, 200),
              matchType: "paragraph",
            });
          }
        }
      }

      setOfflineResults(results);
    } catch (e) {
      console.error("[BookSearch] offline search error", e);
      setOfflineResults([]);
    } finally {
      setIsOfflineSearching(false);
    }
  }, [bookIdNum]);

  useEffect(() => {
    if (isDownloaded) {
      searchOffline(debouncedQuery);
    }
  }, [debouncedQuery, isDownloaded, searchOffline]);

  const results: SearchResult[] = isDownloaded
    ? (offlineResults ?? [])
    : (serverResults ?? []);

  const isSearching = isDownloaded ? isOfflineSearching : isServerSearching;

  const renderItem = ({ item }: { item: SearchResult }) => (
    <Pressable
      onPress={() => router.push(`/books/${bookId}/reader/${item.pageId}` as any)}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.05)",
        gap: 4,
      }}
    >
      {/* Chapter / topic title */}
      <Text
        style={{ fontSize: 14, fontWeight: "700", color: "#fff", writingDirection: "rtl", textAlign: "right" }}
        numberOfLines={1}
      >
        {item.chapterTitle ?? item.topicTitle ?? "صفحة"}
      </Text>

      {/* Snippet (paragraph match) */}
      {item.snippet && (
        <Text
          style={{ fontSize: 13, color: "#b3b3b3", writingDirection: "rtl", textAlign: "right", lineHeight: 20 }}
          numberOfLines={2}
        >
          {item.snippet}
        </Text>
      )}

      {/* Page number + match type badge */}
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 2 }}>
        <Text style={{ fontSize: 11, color: "#4b5563" }}>
          {item.printedPageNo != null ? `ص ${item.printedPageNo}` : `#${item.shamelaPageNo}`}
        </Text>
        <View
          style={{
            backgroundColor:
              item.matchType === "title"
                ? "rgba(29,185,84,0.15)"
                : "rgba(74,158,255,0.15)",
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: item.matchType === "title" ? "#1DB954" : "#4A9EFF",
              fontWeight: "600",
            }}
          >
            {item.matchType === "title" ? "عنوان" : "نص"}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <SafeArea>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: "#282828",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: "#282828", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name="ChevronLeft" size={20} className="text-foreground" />
          </Pressable>

          {/* Search input */}
          <View
            style={{
              flex: 1,
              flexDirection: "row-reverse",
              alignItems: "center",
              backgroundColor: "#1E1E1E",
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              gap: 8,
            }}
          >
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث في الكتاب..."
              placeholderTextColor="#666"
              style={{
                flex: 1, fontSize: 15, color: "#fff",
                textAlign: "right", writingDirection: "rtl",
              }}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(""); setOfflineResults(null); }}>
                <Icon name="X" size={16} className="text-muted-foreground" />
              </Pressable>
            )}
          </View>

          {/* Offline badge */}
          {isDownloaded && (
            <View
              style={{
                backgroundColor: "rgba(29,185,84,0.12)",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 11, color: "#1DB954" }}>محلي</Text>
            </View>
          )}
        </View>

        {/* Results */}
        {isSearching && debouncedQuery.length >= 2 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#1DB954" />
          </View>
        ) : debouncedQuery.length < 2 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="Search" size={40} className="text-muted-foreground" />
            <Text style={{ color: "#4b5563", fontSize: 14 }}>اكتب للبحث في العناوين والنصوص</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="SearchX" size={40} className="text-muted-foreground" />
            <Text style={{ color: "#4b5563", fontSize: 14 }}>لا توجد نتائج لـ "{debouncedQuery}"</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.pageId}-${item.matchType}`}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View
                style={{
                  paddingHorizontal: 16, paddingVertical: 8,
                  flexDirection: "row-reverse", alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 12, color: "#6b7280" }}>
                  {results.length} نتيجة
                </Text>
              </View>
            }
          />
        )}
      </SafeArea>
    </View>
  );
}
