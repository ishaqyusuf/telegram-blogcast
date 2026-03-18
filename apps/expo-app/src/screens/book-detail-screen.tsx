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
      <View style={{ flex: 1, backgroundColor: "#121212", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1DB954" />
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
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <SafeArea>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: "#282828", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>

          <Text
            style={{ fontSize: 17, fontWeight: "700", color: "#fff", flex: 1, textAlign: "right", writingDirection: "rtl" }}
            numberOfLines={1}
          >
            {book.nameAr ?? book.nameEn}
          </Text>

          {/* Bookmarks toggle */}
          {bookmarks.length > 0 && (
            <Pressable
              onPress={() => setShowBookmarks(!showBookmarks)}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: showBookmarks ? "rgba(29,185,84,0.15)" : "#282828",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="Bookmark" size={18} className={showBookmarks ? "text-primary" : "text-foreground"} />
            </Pressable>
          )}

          {/* Search button */}
          <Pressable
            onPress={() => router.push(`/books/${bookId}/search` as any)}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: "#282828", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name="Search" size={18} className="text-foreground" />
          </Pressable>
        </View>

        {/* Update available banner */}
        {hasUpdate && (
          <Pressable
            onPress={download}
            style={{
              marginHorizontal: 16, marginBottom: 8,
              backgroundColor: "rgba(29,185,84,0.12)",
              borderRadius: 10, borderWidth: 1, borderColor: "rgba(29,185,84,0.3)",
              paddingHorizontal: 14, paddingVertical: 10,
              flexDirection: "row-reverse", alignItems: "center", gap: 8,
            }}
          >
            <Icon name="RefreshCw" size={15} className="text-primary" />
            <Text style={{ flex: 1, fontSize: 13, color: "#1DB954", writingDirection: "rtl", textAlign: "right" }}>
              محتوى جديد متاح — اضغط للتحديث
            </Text>
          </Pressable>
        )}

        {/* Offline badge */}
        {!isOnline && (
          <View
            style={{
              marginHorizontal: 16, marginBottom: 8,
              backgroundColor: "#282828", borderRadius: 8,
              paddingHorizontal: 12, paddingVertical: 6,
              flexDirection: "row-reverse", alignItems: "center", gap: 6,
            }}
          >
            <Icon name="WifiOff" size={13} className="text-muted-foreground" />
            <Text style={{ fontSize: 12, color: "#6b7280" }}>
              {isDownloaded ? "وضع بلا إنترنت — يتم القراءة من التخزين المحلي" : "لا يوجد اتصال بالإنترنت"}
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Hero */}
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
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", writingDirection: "rtl", textAlign: "right" }}>
                {book.nameAr ?? book.nameEn}
              </Text>
              {book.nameEn && (
                <Text style={{ fontSize: 13, color: "#b3b3b3" }}>{book.nameEn}</Text>
              )}
              {book.authors.length > 0 && (
                <Text style={{ fontSize: 14, color: "#1DB954", writingDirection: "rtl", textAlign: "right" }}>
                  {book.authors.map((a) => a.nameAr ?? a.name).join("، ")}
                </Text>
              )}
              {book.shelf && (
                <View style={{ alignSelf: "flex-end", backgroundColor: "#282828", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, color: "#b3b3b3", writingDirection: "rtl" }}>
                    {book.shelf.nameAr ?? book.shelf.name}
                  </Text>
                </View>
              )}
              {book.category && (
                <Text style={{ fontSize: 12, color: "#b3b3b3", writingDirection: "rtl", textAlign: "right" }}>
                  {book.category}
                </Text>
              )}

              {/* Offline / download row */}
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
                    style={{
                      flexDirection: "row-reverse", alignItems: "center", gap: 4,
                      backgroundColor: "rgba(29,185,84,0.12)",
                      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                    }}
                  >
                    <Icon name="HardDrive" size={13} className="text-primary" />
                    <Text style={{ fontSize: 12, color: "#1DB954" }}>محفوظ</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={download}
                    disabled={isDownloading || !isOnline}
                    style={{
                      flexDirection: "row-reverse", alignItems: "center", gap: 4,
                      backgroundColor: isDownloading ? "rgba(255,255,255,0.06)" : "#282828",
                      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                      opacity: !isOnline ? 0.5 : 1,
                    }}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#1DB954" />
                    ) : (
                      <Icon name="Download" size={13} className="text-muted-foreground" />
                    )}
                    <Text style={{ fontSize: 12, color: "#b3b3b3" }}>
                      {isDownloading ? `${Math.round(progress * 100)}%` : "تحميل للقراءة دون اتصال"}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Download progress bar */}
              {isDownloading && (
                <View style={{ height: 3, backgroundColor: "#282828", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
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

          {/* ── Continue Reading banner ──────────────────────────────────────── */}
          {continuePageId && (
            <Pressable
              onPress={() => router.push(`/books/${bookId}/reader/${continuePageId}` as any)}
              style={{
                marginHorizontal: 16, marginBottom: 12,
                backgroundColor: "rgba(29,185,84,0.1)",
                borderRadius: 12, borderWidth: 1, borderColor: "rgba(29,185,84,0.25)",
                paddingHorizontal: 16, paddingVertical: 12,
                flexDirection: "row-reverse", alignItems: "center", gap: 10,
              }}
            >
              <View
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: "#1DB954", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icon name="BookOpen" size={18} className="text-background" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#1DB954", writingDirection: "rtl", textAlign: "right" }}>
                  متابعة القراءة
                </Text>
                <Text style={{ fontSize: 11, color: "#6b7280", writingDirection: "rtl", textAlign: "right" }}>
                  اضغط للعودة إلى آخر صفحة
                </Text>
              </View>
              <Icon name="ChevronLeft" size={18} className="text-primary" />
            </Pressable>
          )}

          {/* ── Bookmarks list ───────────────────────────────────────────────── */}
          {showBookmarks && bookmarks.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff", textAlign: "right", writingDirection: "rtl", marginBottom: 8 }}>
                العلامات المرجعية ({bookmarks.length})
              </Text>
              {bookmarks.map((bm) => (
                <View
                  key={bm.pageId}
                  style={{
                    flexDirection: "row-reverse", alignItems: "center", gap: 10,
                    backgroundColor: "#1E1E1E", borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
                  }}
                >
                  <Icon name="Bookmark" size={15} className="text-primary" />
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => router.push(`/books/${bookId}/reader/${bm.pageId}` as any)}
                  >
                    <Text
                      style={{ fontSize: 13, color: "#fff", writingDirection: "rtl", textAlign: "right" }}
                      numberOfLines={1}
                    >
                      {bm.chapterTitle ?? `صفحة ${bm.pageNo ?? bm.pageId}`}
                    </Text>
                    {bm.pageNo && (
                      <Text style={{ fontSize: 11, color: "#6b7280" }}>ص {bm.pageNo}</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => removeBookmark(bookIdNum, bm.pageId)} hitSlop={10}>
                    <Icon name="X" size={15} className="text-muted-foreground" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Blog description */}
          {book.blog.content && (
            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: "#b3b3b3", lineHeight: 22, writingDirection: "rtl", textAlign: "right" }}>
                {book.blog.content}
              </Text>
            </View>
          )}

          {/* ── Fetch Page Section ───────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 16, marginBottom: 20, gap: 8 }}>
            {showFetchInput ? (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View
                  style={{
                    flexDirection: "row", gap: 8, backgroundColor: "#282828",
                    borderRadius: 10, padding: 10, alignItems: "center",
                  }}
                >
                  <TextInput
                    value={fetchUrl}
                    onChangeText={setFetchUrl}
                    placeholder="رابط صفحة الشاملة..."
                    placeholderTextColor="#666"
                    style={{ flex: 1, fontSize: 13, color: "#fff", textAlign: "right" }}
                    autoFocus
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => {
                      if (!fetchUrl.trim()) return;
                      fetchPage({ bookId: bookIdNum, shamelaUrl: fetchUrl.trim() });
                    }}
                    style={{ backgroundColor: "#1DB954", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    {isFetching ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={{ fontWeight: "700", color: "#000", fontSize: 13 }}>جلب</Text>
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
                    style={{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: 6, backgroundColor: "#1DB954", borderRadius: 10, paddingVertical: 10,
                    }}
                  >
                    <Icon name="Download" size={16} className="text-background" />
                    <Text style={{ fontWeight: "700", color: "#000", fontSize: 14 }}>جلب صفحة</Text>
                  </Pressable>

                  {lastFetchedPage && (
                    <Pressable
                      onPress={() =>
                        fetchNext({ bookId: bookIdNum, currentShamelaPageNo: lastFetchedPage.shamelaPageNo })
                      }
                      style={{
                        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                        gap: 6, backgroundColor: "#282828", borderRadius: 10, paddingVertical: 10,
                      }}
                    >
                      {isFetchingNext ? (
                        <ActivityIndicator size="small" color="#1DB954" />
                      ) : (
                        <>
                          <Icon name="ChevronRight" size={16} className="text-primary" />
                          <Text style={{ fontWeight: "600", color: "#1DB954", fontSize: 14 }}>التالية</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>

                {/* ── Auto-fetch All ─────────────────────────────────────── */}
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
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: 8, backgroundColor: "#282828", borderRadius: 10, paddingVertical: 10,
                      borderWidth: isAutoFetching ? 1 : 0, borderColor: "#1DB954",
                    }}
                  >
                    {isAutoFetching ? (
                      <>
                        <ActivityIndicator size="small" color="#1DB954" />
                        <Text style={{ color: "#1DB954", fontWeight: "600", fontSize: 13 }}>
                          جلب الكل... {autoFetchProgress.done}/{autoFetchProgress.total}
                        </Text>
                        <Text style={{ color: "#6b7280", fontSize: 12 }}>اضغط للإيقاف</Text>
                      </>
                    ) : (
                      <>
                        <Icon name="RefreshCw" size={15} className="text-muted-foreground" />
                        <Text style={{ color: "#b3b3b3", fontWeight: "600", fontSize: 13 }}>
                          جلب الكل ({totalCount - fetchedCount} متبقي)
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* ── Chapter Tree ─────────────────────────────────────────────────── */}
          {totalCount > 0 && (
            <View style={{ paddingHorizontal: 14 }}>
              <View
                style={{
                  flexDirection: "row-reverse", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", writingDirection: "rtl" }}>
                  الفهرس ({totalCount})
                </Text>
                {fetchedCount > 0 && (
                  <Text style={{ fontSize: 12, color: "#6b7280" }}>
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
