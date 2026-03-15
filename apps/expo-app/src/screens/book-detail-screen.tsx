import { useMutation, useQuery, useQueryClient } from "@acme/ui/tanstack";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";

const STATUS_COLORS: Record<string, string> = {
  pending: "#6b7280",
  fetched: "#1DB954",
  error: "#ef4444",
};

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [fetchUrl, setFetchUrl] = useState("");
  const [showFetchInput, setShowFetchInput] = useState(false);
  const [fetchingPageId, setFetchingPageId] = useState<number | null>(null);

  const { data: book, isLoading } = useQuery(
    _trpc.book.getBook.queryOptions({ id: Number(bookId) })
  );

  const { mutate: fetchPage, isPending: isFetching } = useMutation(
    _trpc.book.fetchPage.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: Number(bookId) }) });
        setFetchUrl("");
        setShowFetchInput(false);
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  const { mutate: fetchChapterPage } = useMutation(
    _trpc.book.fetchPage.mutationOptions({
      onSuccess: (page) => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: Number(bookId) }) });
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
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: Number(bookId) }) });
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

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
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#282828",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", flex: 1, textAlign: "right", writingDirection: "rtl" }} numberOfLines={1}>
            {book.nameAr ?? book.nameEn}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Hero */}
          <View style={{ flexDirection: "row", gap: 14, paddingHorizontal: 16, marginBottom: 20 }}>
            <View
              style={{
                width: 110,
                height: 154,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: book.coverColor ?? "#4c1d95",
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
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
                <View
                  style={{
                    alignSelf: "flex-end",
                    backgroundColor: "#282828",
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
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
            </View>
          </View>

          {/* Blog description */}
          {book.blog.content && (
            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: "#b3b3b3", lineHeight: 22, writingDirection: "rtl", textAlign: "right" }}>
                {book.blog.content}
              </Text>
            </View>
          )}

          {/* Fetch Page Section */}
          <View style={{ paddingHorizontal: 16, marginBottom: 20, gap: 8 }}>
            {showFetchInput ? (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    backgroundColor: "#282828",
                    borderRadius: 10,
                    padding: 10,
                    alignItems: "center",
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
                      fetchPage({ bookId: Number(bookId), shamelaUrl: fetchUrl.trim() });
                    }}
                    style={{
                      backgroundColor: "#1DB954",
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
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
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setShowFetchInput(true)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    backgroundColor: "#1DB954",
                    borderRadius: 10,
                    paddingVertical: 10,
                  }}
                >
                  <Icon name="Download" size={16} className="text-background" />
                  <Text style={{ fontWeight: "700", color: "#000", fontSize: 14 }}>جلب صفحة</Text>
                </Pressable>
                {lastFetchedPage && (
                  <Pressable
                    onPress={() =>
                      fetchNext({ bookId: Number(bookId), currentShamelaPageNo: lastFetchedPage.shamelaPageNo })
                    }
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: "#282828",
                      borderRadius: 10,
                      paddingVertical: 10,
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
            )}
          </View>

          {/* Volumes */}
          {book.volumes.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", marginBottom: 8, textAlign: "right", writingDirection: "rtl" }}>
                الأجزاء ({book.volumes.length})
              </Text>
              <View style={{ gap: 6 }}>
                {book.volumes.map((vol) => (
                  <View
                    key={vol.id}
                    style={{
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      backgroundColor: "#282828",
                      borderRadius: 8,
                      padding: 10,
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: "#fff", fontWeight: "600" }}>
                      الجزء {vol.number}
                    </Text>
                    {vol.title && (
                      <Text style={{ fontSize: 13, color: "#b3b3b3", flex: 1, textAlign: "right", writingDirection: "rtl" }} numberOfLines={1}>
                        {vol.title}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Chapter / Pages list */}
          {totalCount > 0 && (
            <View style={{ paddingHorizontal: 16 }}>
              {/* Header with counts */}
              <View
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", writingDirection: "rtl" }}>
                  الفهرس ({totalCount})
                </Text>
                {fetchedCount > 0 && (
                  <Text style={{ fontSize: 12, color: "#b3b3b3" }}>
                    {fetchedCount} مجلوب · {totalCount - fetchedCount} متبقي
                  </Text>
                )}
              </View>

              <View style={{ gap: 4 }}>
                {book.pages.map((page) => {
                  const isLoadingThis = fetchingPageId === page.id;
                  return (
                    <Pressable
                      key={page.id}
                      onPress={() => {
                        if (page.status === "fetched") {
                          router.push(`/books/${bookId}/reader/${page.id}` as any);
                        } else if (page.shamelaUrl && !fetchingPageId) {
                          setFetchingPageId(page.id);
                          fetchChapterPage({ bookId: Number(bookId), shamelaUrl: page.shamelaUrl });
                        }
                      }}
                      style={{
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        backgroundColor: isLoadingThis ? "rgba(29,185,84,0.08)" : "#282828",
                        borderRadius: 8,
                        padding: 10,
                        gap: 8,
                        borderWidth: isLoadingThis ? 1 : 0,
                        borderColor: isLoadingThis ? "rgba(29,185,84,0.3)" : "transparent",
                      }}
                    >
                      {/* Status indicator */}
                      {isLoadingThis ? (
                        <ActivityIndicator size="small" color="#1DB954" style={{ flexShrink: 0 }} />
                      ) : (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: STATUS_COLORS[page.status] ?? "#6b7280",
                            flexShrink: 0,
                          }}
                        />
                      )}

                      <Text
                        style={{ fontSize: 13, color: "#b3b3b3", flex: 1, textAlign: "right", writingDirection: "rtl" }}
                        numberOfLines={1}
                      >
                        {page.chapterTitle ?? page.topicTitle ?? "صفحة"}
                      </Text>

                      {/* Page number or fetch hint */}
                      {page.status === "fetched" ? (
                        <Text style={{ fontSize: 12, color: "#6b7280", flexShrink: 0 }}>
                          {page.printedPageNo != null ? `ص ${page.printedPageNo}` : `#${page.shamelaPageNo}`}
                        </Text>
                      ) : (
                        <Icon name="Download" size={14} className="text-muted-foreground" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeArea>
    </View>
  );
}
