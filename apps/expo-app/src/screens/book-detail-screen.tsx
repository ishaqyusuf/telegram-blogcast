import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView,
  Platform, ScrollView, Text, TextInput, View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { ChapterTree } from "@/components/book/chapter-tree";
import { useBookOffline } from "@/hooks/use-book-offline";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { vanillaTrpc } from "@/trpc/vanilla-client";

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const bookIdNum = Number(bookId);

  const [fetchUrl, setFetchUrl] = useState("");
  const [showFetchInput, setShowFetchInput] = useState(false);
  const [fetchingPageId, setFetchingPageId] = useState<number | null>(null);

  // ── Auto-fetch all ─────────────────────────────────────────────────────────
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const [autoFetchProgress, setAutoFetchProgress] = useState({ done: 0, total: 0 });
  const autoFetchCancelRef = useRef(false);

  // ── Reading progress + bookmarks ───────────────────────────────────────────
  const getLastPage  = useBookOfflineStore((s) => s.getLastPage);
  const getBookmarks = useBookOfflineStore((s) => s.getBookmarks);
  const removeBookmark = useBookOfflineStore((s) => s.removeBookmark);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const { data: book, isLoading } = useQuery(
    _trpc.book.getBook.queryOptions({ id: bookIdNum })
  );
  const { data: pageImportHistory } = useQuery(
    _trpc.book.getBookPageImportHistory.queryOptions({
      bookId: bookIdNum,
      limit: 8,
    })
  );

  // Offline features
  const {
    isDownloaded,
    isDownloading,
    hasUpdate,
    isOnline,
    progress,
    download,
    removeOffline,
  } = useBookOffline(bookIdNum);

  const { mutate: fetchPage, isPending: isFetching } = useMutation(
    _trpc.book.fetchPage.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: bookIdNum }) });
        setFetchUrl("");
        setShowFetchInput(false);
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  const { mutate: fetchChapterPage } = useMutation(
    _trpc.book.fetchPage.mutationOptions({
      onSuccess: (page) => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: bookIdNum }) });
        setFetchingPageId(null);
        router.push(`/books/${bookId}/reader/${page.id}` as any);
      },
      onError: (e) => {
        setFetchingPageId(null);
        Alert.alert("خطأ", e.message);
      },
    })
  );

  const { mutate: fetchNext, isPending: isFetchingNext } = useMutation(
    _trpc.book.fetchNextPage.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: bookIdNum }) });
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  // ── Auto-fetch all pending pages sequentially ──────────────────────────────
  async function startAutoFetch() {
    if (!book) return;
    const pending = book.pages
      .filter((p) => p.status !== "fetched" && p.shamelaUrl)
      .sort((a, b) => a.shamelaPageNo - b.shamelaPageNo);

    if (pending.length === 0) {
      Alert.alert("جاهز", "جميع الصفحات مجلوبة بالفعل.");
      return;
    }

    setIsAutoFetching(true);
    autoFetchCancelRef.current = false;
    setAutoFetchProgress({ done: 0, total: pending.length });

    let done = 0;
    for (const p of pending) {
      if (autoFetchCancelRef.current) break;
      try {
        await vanillaTrpc.book.fetchPage.mutate({ bookId: bookIdNum, shamelaUrl: p.shamelaUrl! });
        done++;
        setAutoFetchProgress({ done, total: pending.length });
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: bookIdNum }) });
      } catch {
        // skip failed, continue with rest
      }
    }

    setIsAutoFetching(false);
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="rgb(29, 185, 84)" />
      </View>
    );
  }

  if (!book) return null;

  const lastFetchedPage = [...(book.pages ?? [])]
    .filter((p) => p.status === "fetched")
    .sort((a, b) => b.shamelaPageNo - a.shamelaPageNo)[0];

  const fetchedCount = book.pages.filter((p) => p.status === "fetched").length;
  const totalCount = book.pages.length;

  const continuePageId = getLastPage(bookIdNum);
  const bookmarks = getBookmarks(bookIdNum);

  return (
    <View className="flex-1 bg-background">
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
              className={showBookmarks ? "size-9 items-center justify-center rounded-full bg-primary/15" : "size-9 items-center justify-center rounded-full bg-card"}
            >
              <Icon name="Bookmark" size={18} className={showBookmarks ? "text-primary" : "text-foreground"} />
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push(`/books/${bookId}/search` as any)}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="Search" size={18} className="text-foreground" />
          </Pressable>
        </View>

        {hasUpdate && (
          <Pressable
            onPress={download}
            className="mx-4 mb-2 flex-row-reverse items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-3.5 py-2.5"
          >
            <Icon name="RefreshCw" size={15} className="text-primary" />
            <Text className="flex-1 text-right text-[13px] text-primary" style={{ writingDirection: "rtl" }}>
              محتوى جديد متاح — اضغط للتحديث
            </Text>
          </Pressable>
        )}

        {!isOnline && (
          <View className="mx-4 mb-2 flex-row-reverse items-center gap-1.5 rounded-lg bg-card px-3 py-1.5">
            <Icon name="WifiOff" size={13} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">
              {isDownloaded ? "وضع بلا إنترنت — يتم القراءة من التخزين المحلي" : "لا يوجد اتصال بالإنترنت"}
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ flexDirection: "row", gap: 14, paddingHorizontal: 16, marginBottom: 20 }}>
            <View
              style={{
                width: 110, height: 154, borderRadius: 10, overflow: "hidden",
                backgroundColor: book.coverColor ?? "#4c1d95",
                flexShrink: 0, alignItems: "center", justifyContent: "center",
              }}
            >
              {book.coverUrl ? (
                <Image source={{ uri: book.coverUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 24, fontWeight: "bold", color: "white", textAlign: "center", writingDirection: "rtl" }}>
                  {(book.nameAr ?? "ك").slice(0, 2)}
                </Text>
              )}
            </View>

            <View style={{ flex: 1, gap: 6, justifyContent: "center" }}>
              <Text className="text-right text-lg font-extrabold text-foreground" style={{ writingDirection: "rtl" }}>
                {book.nameAr ?? book.nameEn}
              </Text>
              {book.nameEn && (
                <Text className="text-[13px] text-muted-foreground">{book.nameEn}</Text>
              )}
              {book.authors.length > 0 && (
                <Text className="text-right text-sm text-primary" style={{ writingDirection: "rtl" }}>
                  {book.authors.map((a) => a.nameAr ?? a.name).join("، ")}
                </Text>
              )}
              {book.shelf && (
                <View className="self-end rounded-md bg-card px-2 py-0.5">
                  <Text className="text-xs text-muted-foreground" style={{ writingDirection: "rtl" }}>
                    {book.shelf.nameAr ?? book.shelf.name}
                  </Text>
                </View>
              )}
              {book.category && (
                <Text className="text-right text-xs text-muted-foreground" style={{ writingDirection: "rtl" }}>
                  {book.category}
                </Text>
              )}

              <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 4 }}>
                {isDownloaded ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        "إزالة من التخزين",
                        "هل تريد حذف النسخة المحلية من هذا الكتاب؟",
                        [
                          { text: "إلغاء", style: "cancel" },
                          { text: "حذف", style: "destructive", onPress: removeOffline },
                        ]
                      )
                    }
                    className="flex-row-reverse items-center gap-1 rounded-lg bg-primary/12 px-2.5 py-1.5"
                  >
                    <Icon name="HardDrive" size={13} className="text-primary" />
                    <Text className="text-xs text-primary">محفوظ</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={download}
                    disabled={isDownloading || !isOnline}
                    className="flex-row-reverse items-center gap-1 rounded-lg bg-card px-2.5 py-1.5"
                    style={{ opacity: !isOnline ? 0.5 : 1 }}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#1DB954" />
                    ) : (
                      <Icon name="Download" size={13} className="text-muted-foreground" />
                    )}
                    <Text className="text-xs text-muted-foreground">
                      {isDownloading ? `${Math.round(progress * 100)}%` : "تحميل للقراءة دون اتصال"}
                    </Text>
                  </Pressable>
                )}
              </View>

              {isDownloading && (
                <View className="mt-1 h-[3px] overflow-hidden rounded-full bg-card">
                  <View
                    style={{
                      height: "100%",
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: "#1DB954",
                      borderRadius: 2,
                    }}
                  />
                </View>
              )}
            </View>
          </View>

          {continuePageId && (
            <Pressable
              onPress={() => router.push(`/books/${bookId}/reader/${continuePageId}` as any)}
              className="mx-4 mb-3 flex-row-reverse items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3"
            >
              <View
                className="size-9 items-center justify-center rounded-full bg-primary"
              >
                <Icon name="BookOpen" size={18} className="text-background" />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-right text-[13px] font-bold text-primary" style={{ writingDirection: "rtl" }}>
                  متابعة القراءة
                </Text>
                <Text className="text-right text-[11px] text-muted-foreground" style={{ writingDirection: "rtl" }}>
                  اضغط للعودة إلى آخر صفحة
                </Text>
              </View>
              <Icon name="ChevronLeft" size={18} className="text-primary" />
            </Pressable>
          )}

          {showBookmarks && bookmarks.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Text className="mb-2 text-right text-sm font-bold text-foreground" style={{ writingDirection: "rtl" }}>
                العلامات المرجعية ({bookmarks.length})
              </Text>
              {bookmarks.map((bm) => (
                <View
                  key={bm.pageId}
                  className="mb-1.5 flex-row-reverse items-center gap-2.5 rounded-xl bg-card px-3 py-2.5"
                >
                  <Icon name="Bookmark" size={15} className="text-primary" />
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => router.push(`/books/${bookId}/reader/${bm.pageId}` as any)}
                  >
                    <Text
                      className="text-right text-[13px] text-foreground"
                      style={{ writingDirection: "rtl" }}
                      numberOfLines={1}
                    >
                      {bm.chapterTitle ?? `صفحة ${bm.pageNo ?? bm.pageId}`}
                    </Text>
                    {bm.pageNo && (
                      <Text className="text-[11px] text-muted-foreground">ص {bm.pageNo}</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => removeBookmark(bookIdNum, bm.pageId)} hitSlop={10}>
                    <Icon name="X" size={15} className="text-muted-foreground" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {book.blog.content && (
            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
              <Text className="text-right text-sm leading-[22px] text-muted-foreground" style={{ writingDirection: "rtl" }}>
                {book.blog.content}
              </Text>
            </View>
          )}

          <View style={{ paddingHorizontal: 16, marginBottom: 20, gap: 8 }}>
            {showFetchInput ? (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View className="flex-row items-center gap-2 rounded-xl bg-card p-2.5">
                  <TextInput
                    value={fetchUrl}
                    onChangeText={setFetchUrl}
                    placeholder="رابط صفحة الشاملة..."
                    placeholderTextColor="#666"
                    className="flex-1 text-right text-[13px] text-foreground"
                    autoFocus
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => {
                      if (!fetchUrl.trim()) return;
                      fetchPage({ bookId: bookIdNum, shamelaUrl: fetchUrl.trim() });
                    }}
                    className="rounded-lg bg-primary px-3.5 py-2"
                  >
                    {isFetching ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text className="text-[13px] font-bold text-primary-foreground">جلب</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => setShowFetchInput(false)}>
                    <Icon name="X" size={18} className="text-muted-foreground" />
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
                    <Icon name="Download" size={16} className="text-background" />
                    <Text className="text-sm font-bold text-primary-foreground">استيراد/إعادة صفحة</Text>
                  </Pressable>

                  {lastFetchedPage && (
                    <Pressable
                      onPress={() =>
                        fetchNext({ bookId: bookIdNum, currentShamelaPageNo: lastFetchedPage.shamelaPageNo })
                      }
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-card py-2.5"
                    >
                      {isFetchingNext ? (
                        <ActivityIndicator size="small" color="#1DB954" />
                      ) : (
                        <>
                          <Icon name="ChevronRight" size={16} className="text-primary" />
                          <Text className="text-sm font-semibold text-primary">التالية</Text>
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
                    style={{ borderWidth: isAutoFetching ? 1 : 0, borderColor: "rgb(29, 185, 84)" }}
                  >
                    {isAutoFetching ? (
                      <>
                        <ActivityIndicator size="small" color="#1DB954" />
                        <Text className="text-[13px] font-semibold text-primary">
                          جلب الكل... {autoFetchProgress.done}/{autoFetchProgress.total}
                        </Text>
                        <Text className="text-xs text-muted-foreground">اضغط للإيقاف</Text>
                      </>
                    ) : (
                      <>
                        <Icon name="RefreshCw" size={15} className="text-muted-foreground" />
                        <Text className="text-[13px] font-semibold text-muted-foreground">
                          جلب الكل ({totalCount - fetchedCount} متبقي)
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {pageImportHistory?.length ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 20, gap: 8 }}>
              <Text
                className="text-right text-sm font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                سجل استيراد الصفحات
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
                          ? "ناجح"
                          : entry.status === "failed"
                            ? "فشل"
                            : "قيد التنفيذ"}
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
                    {entry.chapterTitle ?? entry.topicTitle ?? `صفحة ${entry.shamelaPageNo ?? "-"}`}
                  </Text>
                  <Text
                    className="text-right text-[12px] text-muted-foreground"
                    style={{ writingDirection: "rtl" }}
                  >
                    {entry.importMethod === "manual_paste"
                      ? "إدخال يدوي"
                      : "استيراد بالرابط"}
                    {entry.paragraphCount ? ` • ${entry.paragraphCount} فقرات` : ""}
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
                        إعادة استخدام الرابط
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
                style={{
                  flexDirection: "row-reverse", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 12,
                }}
              >
                <Text className="text-[15px] font-bold text-foreground" style={{ writingDirection: "rtl" }}>
                  الفهرس ({totalCount})
                </Text>
                {fetchedCount > 0 && (
                  <Text className="text-xs text-muted-foreground">
                    {fetchedCount} مجلوب · {totalCount - fetchedCount} متبقي
                  </Text>
                )}
              </View>

              <ChapterTree
                pages={book.pages}
                volumes={book.volumes}
                fetchingPageId={fetchingPageId}
                onPagePress={(page) => {
                  if (page.status === "fetched") {
                    router.push(`/books/${bookId}/reader/${page.id}` as any);
                  } else if (page.shamelaUrl && !fetchingPageId) {
                    setFetchingPageId(page.id);
                    fetchChapterPage({ bookId: bookIdNum, shamelaUrl: page.shamelaUrl });
                  }
                }}
              />
            </View>
          )}
        </ScrollView>
      </SafeArea>
    </View>
  );
}
