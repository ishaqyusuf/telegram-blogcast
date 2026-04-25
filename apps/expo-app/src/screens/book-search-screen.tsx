import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { localDb, withLocalDb } from "@/db/local-db";
import { localParagraphs, localPages } from "@/db/local-schema";
import { eq, sql } from "drizzle-orm";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";

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
  const { t } = useTranslation();
  const colors = useColors();
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
      const results = await withLocalDb(async () => {
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
        const nextResults: SearchResult[] = [];

        for (const p of titleMatches) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            nextResults.push({
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
              nextResults.push({
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

        return nextResults;
      });
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
      className="gap-1 border-b border-border/40 px-4 py-3"
    >
      <Text
        className="text-right text-sm font-bold text-foreground"
        style={{ writingDirection: "rtl" }}
        numberOfLines={1}
      >
        {item.chapterTitle ?? item.topicTitle ?? t("page")}
      </Text>

      {item.snippet && (
        <Text
          className="text-right text-[13px] leading-5 text-muted-foreground"
          style={{ writingDirection: "rtl" }}
          numberOfLines={2}
        >
          {item.snippet}
        </Text>
      )}

      <View className="mt-0.5 flex-row-reverse items-center gap-2">
        <Text className="text-[11px] text-muted-foreground">
          {item.printedPageNo != null
            ? t("pageShort", { number: item.printedPageNo })
            : `#${item.shamelaPageNo}`}
        </Text>
        <View
          className={
            item.matchType === "title"
              ? "rounded-md bg-primary/15 px-1.5 py-0.5"
              : "rounded-md bg-sky-500/15 px-1.5 py-0.5"
          }
        >
          <Text
            className={item.matchType === "title" ? "text-[10px] font-semibold text-primary" : "text-[10px] font-semibold text-sky-400"}
          >
            {item.matchType === "title" ? t("title") : t("paragraph")}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View className="flex-row items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Pressable
            onPress={() => router.back()}
            className="size-[34px] items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" size={20} className="text-foreground" />
          </Pressable>

          <View className="flex-1 flex-row-reverse items-center gap-2 rounded-xl bg-card px-3 py-2">
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("searchBook")}
              placeholderTextColor={colors.mutedForeground}
              className="flex-1 text-right text-[15px] text-foreground"
              style={{ writingDirection: "rtl" }}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(""); setOfflineResults(null); }}>
                <Icon name="X" size={16} className="text-muted-foreground" />
              </Pressable>
            )}
          </View>

          {isDownloaded && (
            <View className="rounded-lg bg-primary/12 px-2 py-1">
              <Text className="text-[11px] text-primary">{t("local")}</Text>
            </View>
          )}
        </View>

        {isSearching && debouncedQuery.length >= 2 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : debouncedQuery.length < 2 ? (
          <View className="flex-1 items-center justify-center gap-2">
            <Icon name="Search" size={40} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">{t("searchHint")}</Text>
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-2">
            <Icon name="SearchX" size={40} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">
              {t("noResultsFor", { query: debouncedQuery })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.pageId}-${item.matchType}`}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View className="flex-row-reverse items-center px-4 py-2">
                <Text className="text-xs text-muted-foreground">
                  {t("resultsCount", { count: results.length })}
                </Text>
              </View>
            }
          />
        )}
      </SafeArea>
    </View>
  );
}
