import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Text, TextInput, View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { BookPageView } from "@/components/book/book-page-view";
import { FootnotesSheet } from "@/components/book/footnotes-sheet";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import { useHighlightsSync, pullServerHighlights, syncPendingHighlights } from "@/hooks/use-highlights-sync";
import { useCommentsSync, pullServerComments, syncPendingComments } from "@/hooks/use-comments-sync";
import { useBookOfflineStore } from "@/store/book-offline-store";

export default function BookReaderScreen() {
  const { bookId, pageId } = useLocalSearchParams<{ bookId: string; pageId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const bookIdNum = Number(bookId);
  const pageIdNum = Number(pageId);

  // ── Reading progress + bookmarks ────────────────────────────────────────────
  const setLastPage   = useBookOfflineStore((s) => s.setLastPage);
  const isBookmarked  = useBookOfflineStore((s) => s.isBookmarked);
  const addBookmark   = useBookOfflineStore((s) => s.addBookmark);
  const removeBookmark = useBookOfflineStore((s) => s.removeBookmark);

  const footnotesRef = useRef<BottomSheetModal>(null);
  const [highlightedMarker, setHighlightedMarker] = useState<string | null>(null);
  const [selectedParagraphId, setSelectedParagraphId] = useState<number | null>(null);
  const [showToolbarForParagraphId, setShowToolbarForParagraphId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);

  // ── Server data ────────────────────────────────────────────────────────────
  const { data: page, isLoading } = useQuery(
    _trpc.book.getPage.queryOptions({ pageId: pageIdNum })
  );

  // ── Offline-first highlights ───────────────────────────────────────────────
  const { highlights, addHighlight, deleteHighlight, reload: reloadHighlights } =
    useHighlightsSync(bookIdNum, pageIdNum);

  // ── Offline-first comments ─────────────────────────────────────────────────
  const { comments, addComment, deleteComment } =
    useCommentsSync(bookIdNum, pageIdNum);

  // ── Save reading progress on every page open ───────────────────────────────
  useEffect(() => {
    setLastPage(bookIdNum, pageIdNum);
  }, [bookIdNum, pageIdNum]);

  // Pull from server on mount (merge into SQLite)
  useEffect(() => {
    pullServerHighlights(bookIdNum).catch(() => {}).then(reloadHighlights);
    pullServerComments(bookIdNum).catch(() => {});
    // Background sync of any pending items
    syncPendingHighlights(bookIdNum).catch(() => {});
    syncPendingComments(bookIdNum).catch(() => {});
  }, [bookIdNum]);

  // ── Next page ──────────────────────────────────────────────────────────────
  const { mutate: fetchNext, isPending: isFetchingNext } = useMutation(
    _trpc.book.fetchNextPage.mutationOptions({
      onSuccess: (newPage) => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: bookIdNum }) });
        router.replace(`/books/${bookId}/reader/${newPage.id}` as any);
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

  if (!page) return null;

  const openFootnotes = (marker: string) => {
    setHighlightedMarker(marker);
    footnotesRef.current?.present();
  };

  const handleLongPress = (para: { id: number }) => {
    const newId = para.id === showToolbarForParagraphId ? null : para.id;
    setShowToolbarForParagraphId(newId);
    setSelectedParagraphId(newId);
  };

  const handleHighlightColor = async (paragraphId: number, color: string) => {
    await addHighlight(paragraphId, color);
    setShowToolbarForParagraphId(null);
    setSelectedParagraphId(null);
  };

  const handleHighlightDelete = async (localId: string) => {
    await deleteHighlight(localId);
    setShowToolbarForParagraphId(null);
    setSelectedParagraphId(null);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    await addComment(commentText.trim(), selectedParagraphId ?? undefined);
    setCommentText("");
    setShowCommentInput(false);
    setSelectedParagraphId(null);
  };

  const bookmarked = isBookmarked(bookIdNum, pageIdNum);
  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(bookIdNum, pageIdNum);
    } else {
      addBookmark({
        pageId: pageIdNum,
        bookId: bookIdNum,
        chapterTitle: page.chapterTitle ?? null,
        pageNo: page.printedPageNo ?? null,
        createdAt: Date.now(),
      });
    }
  };

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

          <View style={{ flex: 1, alignItems: "flex-end" }}>
            {page.chapterTitle && (
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: "#fff", writingDirection: "rtl" }}
                numberOfLines={1}
              >
                {page.chapterTitle}
              </Text>
            )}
            <Text style={{ fontSize: 12, color: "#b3b3b3" }}>
              {page.printedPageNo != null ? `ص ${page.printedPageNo}` : `#${page.shamelaPageNo}`}
              {page.volume ? `  •  ج ${page.volume.number}` : ""}
            </Text>
          </View>

          {/* Bookmark toggle */}
          <Pressable
            onPress={toggleBookmark}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: bookmarked ? "rgba(29,185,84,0.15)" : "#282828",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon
              name="Bookmark"
              size={18}
              className={bookmarked ? "text-primary" : "text-foreground"}
            />
          </Pressable>

          <Pressable
            onPress={() => { setHighlightedMarker(null); footnotesRef.current?.present(); }}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: "#282828", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name="BookMarked" size={18} className="text-foreground" />
          </Pressable>
        </View>

        {/* Content + keyboard */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            {page.topicTitle && (
              <Text
                style={{
                  fontSize: 15, fontWeight: "600", color: "#1DB954",
                  textAlign: "center", marginBottom: 16, writingDirection: "rtl",
                }}
              >
                {page.topicTitle}
              </Text>
            )}

            <BookPageView
              paragraphs={page.paragraphs}
              highlights={highlights.map((h) => ({
                localId: h.localId,
                paragraphId: h.paragraphId,
                color: h.color,
              }))}
              onFootnotePress={openFootnotes}
              onLongPress={handleLongPress}
              selectedParagraphId={selectedParagraphId}
              showToolbarForParagraphId={showToolbarForParagraphId}
              onHighlightColor={handleHighlightColor}
              onHighlightDelete={handleHighlightDelete}
              onDismissHighlight={() => {
                setShowToolbarForParagraphId(null);
                setSelectedParagraphId(null);
              }}
            />

            {/* Comments list */}
            {comments.length > 0 && (
              <View style={{ marginTop: 24, gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff", textAlign: "right", writingDirection: "rtl" }}>
                  التعليقات ({comments.length})
                </Text>
                {comments.map((comment) => (
                  <View
                    key={comment.localId}
                    style={{
                      backgroundColor: "#282828",
                      borderRadius: 8,
                      padding: 10,
                      flexDirection: "row-reverse",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <Text
                      style={{
                        flex: 1, fontSize: 14, color: "#e8e8e8",
                        writingDirection: "rtl", textAlign: "right",
                      }}
                    >
                      {comment.content}
                    </Text>
                    {comment.syncStatus === "pending_create" && (
                      <Icon name="Clock" size={12} className="text-muted-foreground" />
                    )}
                    <Pressable onPress={() => deleteComment(comment.localId)}>
                      <Icon name="Trash2" size={14} className="text-muted-foreground" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Bottom toolbar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: "#282828",
              gap: 8,
              backgroundColor: "#121212",
            }}
          >
            {/* Comment toggle */}
            <Pressable
              onPress={() => setShowCommentInput(!showCommentInput)}
              style={{
                flex: 1,
                flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 6, backgroundColor: "#282828", borderRadius: 10, paddingVertical: 10,
              }}
            >
              <Icon name="MessageSquare" size={16} className="text-foreground" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>تعليق</Text>
            </Pressable>

            {/* Prev page */}
            <Pressable
              onPress={() => router.back()}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 6, backgroundColor: "#282828", borderRadius: 10,
                paddingVertical: 10, paddingHorizontal: 16,
              }}
            >
              <Icon name="ChevronRight" size={18} className="text-foreground" />
              <Text style={{ fontSize: 13, color: "#fff" }}>السابقة</Text>
            </Pressable>

            {/* Next page */}
            <Pressable
              onPress={() =>
                fetchNext({ bookId: bookIdNum, currentShamelaPageNo: page.shamelaPageNo })
              }
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 6, backgroundColor: "#1DB954", borderRadius: 10,
                paddingVertical: 10, paddingHorizontal: 16,
              }}
            >
              {isFetchingNext ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#000" }}>التالية</Text>
                  <Icon name="ChevronLeft" size={18} className="text-background" />
                </>
              )}
            </Pressable>
          </View>

          {/* Comment input — fixed above keyboard */}
          {showCommentInput && (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                backgroundColor: "#1E1E1E",
                borderTopWidth: 1,
                borderTopColor: "#282828",
                padding: 12,
                alignItems: "center",
              }}
            >
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={
                  selectedParagraphId
                    ? "تعليق على الفقرة المحددة..."
                    : "أضف تعليقاً..."
                }
                placeholderTextColor="#666"
                style={{
                  flex: 1, fontSize: 14, color: "#fff",
                  textAlign: "right", writingDirection: "rtl",
                  maxHeight: 80,
                }}
                multiline
                autoFocus
              />
              <Pressable
                onPress={submitComment}
                style={{
                  backgroundColor: "#1DB954",
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Icon name="Send" size={16} className="text-background" />
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeArea>

      <FootnotesSheet
        ref={footnotesRef}
        footnotes={page.footnotes}
        highlightedMarker={highlightedMarker}
      />
    </View>
  );
}
