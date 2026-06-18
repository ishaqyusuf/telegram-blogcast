import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { ChapterTree, type TocNode } from "@/components/book/chapter-tree";
import { saveBookDownloadToLocalDb } from "@/lib/book-offline-download";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";
import { toAbsoluteShamelaUrl } from "@/lib/shamela-url";

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

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const colors = useColors();
  const bookIdNum = Number(bookId);

  const [fetchUrl, setFetchUrl] = useState("");
  const [showFetchInput, setShowFetchInput] = useState(false);
  const fetchingPageId = null;
  const [isDownloadingBook, setIsDownloadingBook] = useState(false);
  const [chapterQuery, setChapterQuery] = useState("");

  // ── Auto-fetch all ─────────────────────────────────────────────────────────
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const [autoFetchProgress, setAutoFetchProgress] = useState({
    done: 0,
    total: 0,
  });
  const autoFetchCancelRef = useRef(false);

  // ── Reading progress + bookmarks ───────────────────────────────────────────
  const getLastPage = useBookOfflineStore((s) => s.getLastPage);
  const getBookmarks = useBookOfflineStore((s) => s.getBookmarks);
  const removeBookmark = useBookOfflineStore((s) => s.removeBookmark);
  const setDownloaded = useBookOfflineStore((s) => s.setDownloaded);
  const setDownloadProgress = useBookOfflineStore((s) => s.setDownloadProgress);
  const clearDownloadProgress = useBookOfflineStore(
    (s) => s.clearDownloadProgress,
  );
  const downloadProgress = useBookOfflineStore(
    (s) => s.downloadProgress[bookIdNum] ?? 0,
  );
  const [showBookmarks, setShowBookmarks] = useState(false);

  const { data: book, isLoading } = useQuery(
    _trpc.book.getBook.queryOptions({ id: bookIdNum }),
  );
  const { data: pageImportHistory } = useQuery(
    _trpc.book.getBookPageImportHistory.queryOptions({
      bookId: bookIdNum,
      limit: 8,
    }),
  );

  // Offline features
  const { mutate: fetchPage, isPending: isFetching } = useMutation(
    _trpc.book.fetchPage.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: _trpc.book.getBook.queryKey({ id: bookIdNum }),
        });
        setFetchUrl("");
        setShowFetchInput(false);
      },
      onError: (e) => Alert.alert(t("error"), e.message),
    }),
  );

  const { mutate: fetchNext, isPending: isFetchingNext } = useMutation(
    _trpc.book.fetchNextPage.mutationOptions({
      onSuccess: (page) => {
        qc.invalidateQueries({
          queryKey: _trpc.book.getBook.queryKey({ id: bookIdNum }),
        });
        router.push(`/books/${bookId}/reader/${page.id}` as any);
      },
      onError: (e) => Alert.alert(t("error"), e.message),
    }),
  );

  // ── Auto-fetch all pending pages sequentially ──────────────────────────────
  async function startAutoFetch() {
    if (!book) return;
    const pending = book.pages
      .filter((p) => p.status !== "fetched" && p.shamelaUrl)
      .sort((a, b) => a.shamelaPageNo - b.shamelaPageNo);

    if (pending.length === 0) {
      Alert.alert(t("allCaughtUp"), t("allPagesFetched"));
      return;
    }

    setIsAutoFetching(true);
    autoFetchCancelRef.current = false;
    setAutoFetchProgress({ done: 0, total: pending.length });

    let done = 0;
    for (const p of pending) {
      if (autoFetchCancelRef.current) break;
      try {
        await vanillaTrpc.book.fetchPage.mutate({
          bookId: bookIdNum,
          shamelaUrl: p.shamelaUrl!,
        });
        done++;
        setAutoFetchProgress({ done, total: pending.length });
        qc.invalidateQueries({
          queryKey: _trpc.book.getBook.queryKey({ id: bookIdNum }),
        });
      } catch {
        // skip failed, continue with rest
      }
    }

    setIsAutoFetching(false);
  }

  async function downloadBookForOffline() {
    if (isDownloadingBook || !Number.isFinite(bookIdNum)) return;

    setIsDownloadingBook(true);
    setDownloadProgress(bookIdNum, 0.08);

    try {
      const payload = await vanillaTrpc.book.getBookForDownload.query({
        bookId: bookIdNum,
      });
      setDownloadProgress(bookIdNum, 0.55);

      const meta = await saveBookDownloadToLocalDb(payload);
      setDownloaded(meta);
      setDownloadProgress(bookIdNum, 1);
      Alert.alert(t("savedOffline"), t("downloadOffline"));
    } catch (e) {
      Alert.alert(t("error"), e instanceof Error ? e.message : String(e));
    } finally {
      setIsDownloadingBook(false);
      clearDownloadProgress(bookIdNum);
    }
  }

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!book) return null;

  const lastFetchedPage = [...(book.pages ?? [])]
    .filter((p) => p.status === "fetched")
    .sort((a, b) => b.shamelaPageNo - a.shamelaPageNo)[0];
  const nextPageCandidate = lastFetchedPage
    ? [...(book.pages ?? [])]
        .filter((p) => p.shamelaPageNo > lastFetchedPage.shamelaPageNo)
        .sort((a, b) => a.shamelaPageNo - b.shamelaPageNo)[0]
    : [...(book.pages ?? [])].sort(
        (a, b) => a.shamelaPageNo - b.shamelaPageNo,
      )[0];

  const fetchedCount = book.pages.filter((p) => p.status === "fetched").length;
  const totalCount = book.pages.length;
  const isImportedBook =
    book.editable === false ||
    book.sourceType === "shamela" ||
    Boolean(book.shamelaId || book.shamelaUrl);

  const continuePageId = getLastPage(bookIdNum);
  const bookmarks = getBookmarks(bookIdNum);

  const openReader = (targetPageId: number) => {
    router.push(`/books/${bookId}/reader/${targetPageId}` as any);
  };

  const openCaptureBrowser = (targetUrl: string) => {
    const absoluteUrl = toAbsoluteShamelaUrl(targetUrl);
    router.push(
      `/book-fetch-browser?url=${encodeURIComponent(absoluteUrl)}&bookId=${bookIdNum}` as any,
    );
  };
  const tocNodes = (((book as any).tocNodes ?? []) as TocNode[]);
  const normalizedChapterQuery = normalizeChapterSearch(chapterQuery);
  const visibleTocNodes = filterTocNodes(tocNodes, normalizedChapterQuery);
  const visiblePages = normalizedChapterQuery
    ? book.pages.filter((page) =>
        pageMatchesChapterSearch(page, normalizedChapterQuery),
      )
    : book.pages;
  const visibleChapterCount = tocNodes.length
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
        <View className="flex-row items-center gap-3 px-4 py-3">
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
            {book.nameAr ?? book.nameEn}
          </Text>

          {bookmarks.length > 0 && (
            <Pressable
              onPress={() => setShowBookmarks(!showBookmarks)}
              className={
                showBookmarks
                  ? "size-9 items-center justify-center rounded-full bg-primary/15"
                  : "size-9 items-center justify-center rounded-full bg-card"
              }
            >
              <Icon
                name="Bookmark"
                size={18}
                className={showBookmarks ? "text-primary" : "text-foreground"}
              />
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push(`/books/${bookId}/search` as any)}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="Search" size={18} className="text-foreground" />
          </Pressable>
        </View>

        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 14,
              paddingHorizontal: 16,
              marginBottom: 20,
            }}
          >
            <View
              style={{
                width: 110,
                height: 154,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: book.coverColor ?? colors.primary,
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {book.coverUrl ? (
                <Image
                  source={{ uri: book.coverUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    color: "white",
                    textAlign: "center",
                    writingDirection: "rtl",
                  }}
                >
                  {(book.nameAr ?? book.nameEn ?? t("bookTitle")).slice(0, 2)}
                </Text>
              )}
            </View>

            <View style={{ flex: 1, gap: 6, justifyContent: "center" }}>
              <Text
                className="text-right text-lg font-extrabold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {book.nameAr ?? book.nameEn}
              </Text>
              {book.nameEn && (
                <Text className="text-[13px] text-muted-foreground">
                  {book.nameEn}
                </Text>
              )}
              {book.authors.length > 0 && (
                <Text
                  className="text-right text-sm text-primary"
                  style={{ writingDirection: "rtl" }}
                >
                  {book.authors.map((a) => a.nameAr ?? a.name).join("، ")}
                </Text>
              )}
              {book.shelf && (
                <View className="self-end rounded-md bg-card px-2 py-0.5">
                  <Text
                    className="text-xs text-muted-foreground"
                    style={{ writingDirection: "rtl" }}
                  >
                    {book.shelf.nameAr ?? book.shelf.name}
                  </Text>
                </View>
              )}
              {book.category && (
                <Text
                  className="text-right text-xs text-muted-foreground"
                  style={{ writingDirection: "rtl" }}
                >
                  {book.category}
                </Text>
              )}
            </View>
          </View>

          {isImportedBook && (
            <View
              className="mx-4 mb-3 rounded-xl border border-border bg-card px-4 py-3"
              style={{ gap: 5 }}
            >
              <Text
                className="text-right text-[13px] font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                Imported read-only book
              </Text>
              <Text
                className="text-right text-[12px] text-muted-foreground"
                style={{ writingDirection: "rtl" }}
              >
                Pages can be refreshed from the Shamela source. Direct editing
                stays disabled.
              </Text>
              {book.shamelaUrl ? (
                <Text
                  className="text-left text-[11px] text-muted-foreground"
                  numberOfLines={1}
                >
                  {book.shamelaUrl}
                </Text>
              ) : null}
            </View>
          )}

          {continuePageId && (
            <Pressable
              onPress={() => openReader(continuePageId)}
              className="mx-4 mb-3 flex-row-reverse items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3"
            >
              <View className="size-9 items-center justify-center rounded-full bg-primary">
                <Icon name="BookOpen" size={18} className="text-background" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  className="text-right text-[13px] font-bold text-primary"
                  style={{ writingDirection: "rtl" }}
                >
                  {t("continueReading")}
                </Text>
                <Text
                  className="text-right text-[11px] text-muted-foreground"
                  style={{ writingDirection: "rtl" }}
                >
                  {t("backToLastPage")}
                </Text>
              </View>
              <Icon name="ChevronLeft" size={18} className="text-primary" />
            </Pressable>
          )}

          {showBookmarks && bookmarks.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Text
                className="mb-2 text-right text-sm font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {t("bookmarks", { count: bookmarks.length })}
              </Text>
              {bookmarks.map((bm) => (
                <View
                  key={bm.pageId}
                  className="mb-1.5 flex-row-reverse items-center gap-2.5 rounded-xl bg-card px-3 py-2.5"
                >
                  <Icon name="Bookmark" size={15} className="text-primary" />
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => openReader(bm.pageId)}
                  >
                    <Text
                      className="text-right text-[13px] text-foreground"
                      style={{ writingDirection: "rtl" }}
                      numberOfLines={1}
                    >
                      {bm.chapterTitle ??
                        `${t("page")} ${bm.pageNo ?? bm.pageId}`}
                    </Text>
                    {bm.pageNo && (
                      <Text className="text-[11px] text-muted-foreground">
                        {t("pageShort", { number: bm.pageNo })}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => removeBookmark(bookIdNum, bm.pageId)}
                    hitSlop={10}
                  >
                    <Icon
                      name="X"
                      size={15}
                      className="text-muted-foreground"
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {book.blog.content && (
            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
              <Text
                className="text-right text-sm leading-[22px] text-muted-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {book.blog.content}
              </Text>
            </View>
          )}

          <View style={{ paddingHorizontal: 16, marginBottom: 20, gap: 8 }}>
            {showFetchInput ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
              >
                <View className="flex-row items-center gap-2 rounded-xl bg-card p-2.5">
                  <TextInput
                    value={fetchUrl}
                    onChangeText={setFetchUrl}
                    placeholder={t("pageLink")}
                    placeholderTextColor={colors.mutedForeground}
                    className="flex-1 text-right text-[13px] text-foreground"
                    autoFocus
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => {
                      if (!fetchUrl.trim()) return;
                      fetchPage({
                        bookId: bookIdNum,
                        shamelaUrl: fetchUrl.trim(),
                      });
                    }}
                    className="rounded-lg bg-primary px-3.5 py-2"
                  >
                    {isFetching ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primaryForeground}
                      />
                    ) : (
                      <Text className="text-[13px] font-bold text-primary-foreground">
                        {t("fetch")}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => setShowFetchInput(false)}>
                    <Icon
                      name="X"
                      size={18}
                      className="text-muted-foreground"
                    />
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            ) : (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => setShowFetchInput(true)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5"
                  >
                    <Icon
                      name="Download"
                      size={16}
                      className="text-background"
                    />
                    <Text className="text-sm font-bold text-primary-foreground">
                      {t("fetchPage")}
                    </Text>
                  </Pressable>

                  {lastFetchedPage && (
                    <Pressable
                      onPress={() => {
                        if (nextPageCandidate?.status === "fetched") {
                          openReader(nextPageCandidate.id);
                          return;
                        }
                        fetchNext({
                          bookId: bookIdNum,
                          currentShamelaPageNo: lastFetchedPage.shamelaPageNo,
                        });
                      }}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-card py-2.5"
                    >
                      {isFetchingNext ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <>
                          <Icon
                            name="ChevronRight"
                            size={16}
                            className="text-primary"
                          />
                          <Text className="text-sm font-semibold text-primary">
                            {nextPageCandidate?.status === "fetched"
                              ? t("next")
                              : nextPageCandidate
                                ? `Import #${nextPageCandidate.shamelaPageNo}`
                                : t("next")}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>

                {totalCount > fetchedCount && (
                  <Pressable
                    onPress={() => {
                      if (isAutoFetching) {
                        autoFetchCancelRef.current = true;
                        setIsAutoFetching(false);
                      } else {
                        startAutoFetch();
                      }
                    }}
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-card py-2.5"
                    style={{
                      borderWidth: isAutoFetching ? 1 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    {isAutoFetching ? (
                      <>
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                        <Text className="text-[13px] font-semibold text-primary">
                          {t("fetchAllProgress", {
                            done: autoFetchProgress.done,
                            total: autoFetchProgress.total,
                          })}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {t("stopFetch")}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Icon
                          name="RefreshCw"
                          size={15}
                          className="text-muted-foreground"
                        />
                        <Text className="text-[13px] font-semibold text-muted-foreground">
                          {t("fetchAll", { count: totalCount - fetchedCount })}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

                <Pressable
                  onPress={downloadBookForOffline}
                  disabled={isDownloadingBook}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-card py-2.5"
                  style={{ opacity: isDownloadingBook ? 0.65 : 1 }}
                >
                  {isDownloadingBook ? (
                    <>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text className="text-[13px] font-semibold text-primary">
                        {Math.round(downloadProgress * 100)}%
                      </Text>
                    </>
                  ) : (
                    <>
                      <Icon
                        name="Download"
                        size={15}
                        className="text-muted-foreground"
                      />
                      <Text className="text-[13px] font-semibold text-muted-foreground">
                        {t("downloadOffline")}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {pageImportHistory?.length ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 20, gap: 8 }}>
              <Text
                className="text-right text-sm font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {t("history")}
              </Text>
              {pageImportHistory.map((entry) => (
                <View
                  key={entry.id}
                  className="rounded-xl bg-card px-3 py-3"
                  style={{ gap: 6 }}
                >
                  <View className="flex-row items-center justify-between">
                    <View
                      className={
                        entry.status === "success"
                          ? "rounded-full bg-primary/15 px-2 py-1"
                          : entry.status === "failed"
                            ? "rounded-full bg-destructive/10 px-2 py-1"
                            : "rounded-full bg-secondary px-2 py-1"
                      }
                    >
                      <Text
                        className={
                          entry.status === "success"
                            ? "text-[11px] font-semibold text-primary"
                            : entry.status === "failed"
                              ? "text-[11px] font-semibold text-destructive"
                              : "text-[11px] font-semibold text-muted-foreground"
                        }
                      >
                        {entry.status === "success"
                          ? t("importSuccess")
                          : entry.status === "failed"
                            ? t("importFailed")
                            : t("importPending")}
                      </Text>
                    </View>
                    <Text className="text-[11px] text-muted-foreground">
                      #{entry.id}
                    </Text>
                  </View>

                  <Text
                    className="text-right text-[13px] font-semibold text-foreground"
                    style={{ writingDirection: "rtl" }}
                  >
                    {entry.chapterTitle ??
                      entry.topicTitle ??
                      `${t("page")} ${entry.shamelaPageNo ?? "-"}`}
                  </Text>
                  <Text
                    className="text-right text-[12px] text-muted-foreground"
                    style={{ writingDirection: "rtl" }}
                  >
                    {entry.importMethod === "manual_paste"
                      ? t("entryManual")
                      : t("bookImportTitle")}
                    {entry.paragraphCount
                      ? ` - ${t("paragraphCount", { count: entry.paragraphCount })}`
                      : ""}
                  </Text>
                  {entry.errorMessage ? (
                    <Text
                      className="text-right text-[12px] text-destructive"
                      style={{ writingDirection: "rtl" }}
                    >
                      {entry.errorMessage}
                    </Text>
                  ) : null}

                  {entry.sourceUrl ? (
                    <Pressable
                      onPress={() => {
                        setFetchUrl(entry.sourceUrl ?? "");
                        setShowFetchInput(true);
                      }}
                      className="items-center rounded-lg bg-background py-2"
                    >
                      <Text className="text-[12px] font-semibold text-primary">
                        {t("reuseLink")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {totalCount > 0 && (
            <View style={{ paddingHorizontal: 14 }}>
              <View
                className="mb-3 flex-row-reverse items-center gap-2 rounded-xl bg-card px-3 py-2.5"
                style={{ backgroundColor: colors.card }}
              >
                <Icon name="Search" size={16} className="text-muted-foreground" />
                <TextInput
                  value={chapterQuery}
                  onChangeText={setChapterQuery}
                  placeholder={t("searchChapters")}
                  placeholderTextColor={colors.mutedForeground}
                  className="flex-1 text-right text-[14px] text-foreground"
                  style={{ writingDirection: "rtl" }}
                  returnKeyType="search"
                />
                {chapterQuery.length > 0 ? (
                  <Pressable onPress={() => setChapterQuery("")}>
                    <Icon name="X" size={16} className="text-muted-foreground" />
                  </Pressable>
                ) : null}
              </View>

              <View
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text
                  className="text-[15px] font-bold text-foreground"
                  style={{ writingDirection: "rtl" }}
                >
                  {t("index", { count: visibleChapterCount })}
                </Text>
                {fetchedCount > 0 && (
                  <Text className="text-xs text-muted-foreground">
                    {t("fetchedRemaining", {
                      fetched: fetchedCount,
                      remaining: totalCount - fetchedCount,
                    })}
                  </Text>
                )}
              </View>

              <ChapterTree
                pages={visiblePages}
                volumes={book.volumes}
                tocNodes={visibleTocNodes}
                fetchingPageId={fetchingPageId}
                onPagePress={(page) => {
                  if (page.status === "fetched") {
                    openReader(page.id);
                  } else if (page.shamelaUrl && !fetchingPageId) {
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
            </View>
          )}
        </ScrollView>
      </SafeArea>
    </View>
  );
}
