import { ChapterTree, type TocNode } from "@/components/book/chapter-tree";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@/lib/react-query";
import { toAbsoluteShamelaUrl } from "@/lib/shamela-url";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";

function normalizeChapterSearch(value: string) {
  return value.trim().toLowerCase();
}

function pageMatchesChapterSearch(
  page: {
    chapterTitle: string | null;
    topicTitle: string | null;
    shamelaPageNo: number;
    printedPageNo: number | null;
  },
  query: string,
) {
  if (!query) return true;
  return [
    page.chapterTitle,
    page.topicTitle,
    String(page.shamelaPageNo),
    page.printedPageNo != null ? String(page.printedPageNo) : null,
  ].some((value) => value?.toLowerCase().includes(query));
}

function filterTocNodes(nodes: TocNode[], query: string) {
  if (!query) return nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const byParent = new Map<number | null, TocNode[]>();
  for (const node of nodes) {
    const key = node.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), node]);
  }
  const included = new Set<number>();

  const includeDescendants = (node: TocNode) => {
    for (const child of byParent.get(node.id) ?? []) {
      included.add(child.id);
      includeDescendants(child);
    }
  };

  for (const node of nodes) {
    const matches = [
      node.title,
      node.shamelaPageNo != null ? String(node.shamelaPageNo) : null,
      node.page?.printedPageNo != null ? String(node.page.printedPageNo) : null,
    ].some((value) => value?.toLowerCase().includes(query));
    if (!matches) continue;

    let current: TocNode | undefined = node;
    while (current) {
      included.add(current.id);
      current = current.parentId != null ? byId.get(current.parentId) : undefined;
    }
    includeDescendants(node);
  }

  return nodes.filter((node) => included.has(node.id));
}

export default function BookChaptersScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const bookIdNum = Number(bookId);
  const [query, setQuery] = useState("");

  const { data: book, isLoading } = useQuery(
    _trpc.book.getBook.queryOptions({ id: bookIdNum }),
  );

  const openReader = (targetPageId: number) => {
    router.push(`/books/${bookId}/reader/${targetPageId}` as any);
  };

  const openCaptureBrowser = (targetUrl: string) => {
    const absoluteUrl = toAbsoluteShamelaUrl(targetUrl);
    router.push(
      `/book-fetch-browser?url=${encodeURIComponent(absoluteUrl)}&bookId=${bookIdNum}` as any,
    );
  };

  const normalizedQuery = normalizeChapterSearch(query);
  const tocNodes = (((book as any)?.tocNodes ?? []) as TocNode[]);
  const visibleTocNodes = filterTocNodes(tocNodes, normalizedQuery);
  const visiblePages = normalizedQuery
    ? (book?.pages ?? []).filter((page) =>
        pageMatchesChapterSearch(page, normalizedQuery),
      )
    : (book?.pages ?? []);
  const visibleCount = tocNodes.length
    ? visibleTocNodes.filter(
        (node) => node.kind !== "volume" && node.shamelaPageNo != null,
      ).length
    : visiblePages.length;

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <View className="gap-3 border-b border-border px-4 py-3">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="size-9 items-center justify-center rounded-full bg-card"
            >
              <Icon name="ChevronLeft" size={22} className="text-foreground" />
            </Pressable>
            <Text
              className="flex-1 text-right text-[17px] font-bold text-foreground"
              style={{ writingDirection: "rtl" }}
              numberOfLines={1}
            >
              {book?.nameAr ?? book?.nameEn ?? t("index", { count: visibleCount })}
            </Text>
          </View>

          <View
            className="flex-row-reverse items-center gap-2 rounded-xl bg-card px-3 py-2.5"
            style={{ backgroundColor: colors.card }}
          >
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("searchChapters")}
              placeholderTextColor={colors.mutedForeground}
              className="flex-1 text-right text-[14px] text-foreground"
              style={{ writingDirection: "rtl" }}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")}>
                <Icon name="X" size={16} className="text-muted-foreground" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isLoading || !book ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={{ backgroundColor: colors.background }}
            contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-3 flex-row-reverse items-center justify-between">
              <Text
                className="text-[15px] font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {t("index", { count: visibleCount })}
              </Text>
              {query.trim().length > 0 ? (
                <Text className="text-xs text-muted-foreground">
                  {t("resultsCount", { count: visibleCount })}
                </Text>
              ) : null}
            </View>

            <ChapterTree
              pages={visiblePages}
              volumes={book.volumes}
              tocNodes={visibleTocNodes}
              fetchingPageId={null}
              onPagePress={(page) => {
                if (page.status === "fetched") {
                  openReader(page.id);
                } else if (page.shamelaUrl) {
                  openCaptureBrowser(page.shamelaUrl);
                }
              }}
              onTocNodePress={(node) => {
                if (node.page?.status === "fetched" && node.page.id) {
                  openReader(node.page.id);
                  return;
                }
                const targetUrl = node.page?.shamelaUrl ?? node.shamelaPath;
                if (targetUrl) openCaptureBrowser(targetUrl);
              }}
            />
          </ScrollView>
        )}
      </SafeArea>
    </View>
  );
}
