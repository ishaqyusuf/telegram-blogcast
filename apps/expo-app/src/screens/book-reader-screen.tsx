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
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="rgb(29, 185, 84)" />
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
    <View className="flex-1 bg-background">
      <SafeArea>
        <View className="flex-row items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Pressable
            onPress={() => router.back()}
            className="size-[34px] items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" size={20} className="text-foreground" />
          </Pressable>

          <View style={{ flex: 1, alignItems: "flex-end" }}>
            {page.chapterTitle && (
              <Text
                className="text-sm font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
                numberOfLines={1}
              >
                {page.chapterTitle}
              </Text>
            )}
            <Text className="text-xs text-muted-foreground">
              {page.printedPageNo != null ? `ص ${page.printedPageNo}` : `#${page.shamelaPageNo}`}
              {page.volume ? `  •  ج ${page.volume.number}` : ""}
            </Text>
          </View>

          <Pressable
            onPress={toggleBookmark}
            className={bookmarked ? "size-[34px] items-center justify-center rounded-full bg-primary/15" : "size-[34px] items-center justify-center rounded-full bg-card"}
          >
            <Icon
              name="Bookmark"
              size={18}
              className={bookmarked ? "text-primary" : "text-foreground"}
            />
          </Pressable>

          <Pressable
            onPress={() => { setHighlightedMarker(null); footnotesRef.current?.present(); }}
            className="size-[34px] items-center justify-center rounded-full bg-card"
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
                className="mb-4 text-center text-[15px] font-semibold text-primary"
                style={{ writingDirection: "rtl" }}
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
                <Text className="text-right text-sm font-bold text-foreground" style={{ writingDirection: "rtl" }}>
                  التعليقات ({comments.length})
                </Text>
                {comments.map((comment) => (
                  <View
                    key={comment.localId}
                    className="flex-row-reverse items-start gap-2 rounded-lg bg-card p-2.5"
                  >
                    <Text
                      className="flex-1 text-right text-sm text-foreground"
                      style={{ writingDirection: "rtl" }}
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

          <View className="flex-row items-center gap-2 border-t border-border bg-background px-4 py-3">
            <Pressable
              onPress={() => setShowCommentInput(!showCommentInput)}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-card py-2.5"
            >
              <Icon name="MessageSquare" size={16} className="text-foreground" />
              <Text className="text-[13px] font-semibold text-foreground">تعليق</Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center justify-center gap-1.5 rounded-xl bg-card px-4 py-2.5"
            >
              <Icon name="ChevronRight" size={18} className="text-foreground" />
              <Text className="text-[13px] text-foreground">السابقة</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                fetchNext({ bookId: bookIdNum, currentShamelaPageNo: page.shamelaPageNo })
              }
              className="flex-row items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5"
            >
              {isFetchingNext ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Text className="text-[13px] font-bold text-primary-foreground">التالية</Text>
                  <Icon name="ChevronLeft" size={18} className="text-background" />
                </>
              )}
            </Pressable>
          </View>

          {showCommentInput && (
            <View className="flex-row items-center gap-2 border-t border-border bg-card px-3 py-3">
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={
                  selectedParagraphId
                    ? "تعليق على الفقرة المحددة..."
                    : "أضف تعليقاً..."
                }
                placeholderTextColor="#666"
                className="flex-1 text-right text-sm text-foreground"
                style={{ writingDirection: "rtl", maxHeight: 80 }}
                multiline
                autoFocus
              />
              <Pressable
                onPress={submitComment}
                className="rounded-lg bg-primary px-3.5 py-2.5"
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
