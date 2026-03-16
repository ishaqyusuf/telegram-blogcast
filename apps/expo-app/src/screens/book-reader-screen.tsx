import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { BookPageView } from "@/components/book/book-page-view";
import { FootnotesSheet } from "@/components/book/footnotes-sheet";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

export default function BookReaderScreen() {
  const { bookId, pageId } = useLocalSearchParams<{ bookId: string; pageId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const footnotesRef = useRef<BottomSheetModal>(null);
  const [highlightedMarker, setHighlightedMarker] = useState<string | null>(null);
  const [selectedParagraphId, setSelectedParagraphId] = useState<number | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");

  const { data: page, isLoading } = useQuery(
    _trpc.book.getPage.queryOptions({ pageId: Number(pageId) })
  );

  const { mutate: fetchNext, isPending: isFetchingNext } = useMutation(
    _trpc.book.fetchNextPage.mutationOptions({
      onSuccess: (newPage) => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: Number(bookId) }) });
        router.replace(`/books/${bookId}/reader/${newPage.id}` as any);
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  const { mutate: addComment, isPending: isAddingComment } = useMutation(
    _trpc.book.addPageComment.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: _trpc.book.getPage.queryKey({ pageId: Number(pageId) }) });
        setCommentText("");
        setShowCommentInput(false);
      },
      onError: (e) => Alert.alert("خطأ", e.message),
    })
  );

  const { mutate: deleteComment } = useMutation(
    _trpc.book.deletePageComment.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: _trpc.book.getPage.queryKey({ pageId: Number(pageId) }) });
      },
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

  const submitComment = () => {
    if (!commentText.trim()) return;
    addComment({
      pageId: Number(pageId),
      content: commentText.trim(),
      paragraphId: selectedParagraphId ?? undefined,
    });
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
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "#282828",
              alignItems: "center",
              justifyContent: "center",
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
          <Pressable
            onPress={() => {
              setHighlightedMarker(null);
              footnotesRef.current?.present();
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "#282828",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="BookMarked" size={18} className="text-foreground" />
          </Pressable>
        </View>

        {/* Page content */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 100,
            }}
          >
            {page.topicTitle && (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: "#1DB954",
                  textAlign: "center",
                  marginBottom: 16,
                  writingDirection: "rtl",
                }}
              >
                {page.topicTitle}
              </Text>
            )}

            <BookPageView
              paragraphs={page.paragraphs}
              onFootnotePress={openFootnotes}
              onLongPress={(para) => {
                setSelectedParagraphId(para.id === selectedParagraphId ? null : para.id);
              }}
              selectedParagraphId={selectedParagraphId}
            />

            {/* Comments section */}
            {page.comments.length > 0 && (
              <View style={{ marginTop: 24, gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff", textAlign: "right", writingDirection: "rtl" }}>
                  التعليقات ({page.comments.length})
                </Text>
                {page.comments.map((comment) => (
                  <View
                    key={comment.id}
                    style={{
                      backgroundColor: "#282828",
                      borderRadius: 8,
                      padding: 10,
                      flexDirection: "row-reverse",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: 14, color: "#e8e8e8", writingDirection: "rtl", textAlign: "right" }}>
                      {comment.content}
                    </Text>
                    <Pressable onPress={() => deleteComment({ id: comment.id })}>
                      <Icon name="Trash2" size={14} className="text-muted-foreground" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Comment input */}
            {showCommentInput && (
              <View
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  gap: 8,
                  backgroundColor: "#282828",
                  borderRadius: 10,
                  padding: 10,
                  alignItems: "center",
                }}
              >
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="أضف تعليقاً..."
                  placeholderTextColor="#666"
                  style={{ flex: 1, fontSize: 14, color: "#fff", textAlign: "right" }}
                  multiline
                  autoFocus
                />
                <Pressable
                  onPress={submitComment}
                  style={{
                    backgroundColor: "#1DB954",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  {isAddingComment ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Icon name="Send" size={16} className="text-background" />
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Bottom nav */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: "#282828",
              gap: 8,
            }}
          >
            {/* Add comment */}
            <Pressable
              onPress={() => setShowCommentInput(!showCommentInput)}
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
              <Icon name="MessageSquare" size={16} className="text-foreground" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>تعليق</Text>
            </Pressable>

            {/* Previous page */}
            <Pressable
              onPress={() => router.back()}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: "#282828",
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 16,
              }}
            >
              <Icon name="ChevronRight" size={18} className="text-foreground" />
              <Text style={{ fontSize: 13, color: "#fff" }}>السابقة</Text>
            </Pressable>

            {/* Next page */}
            <Pressable
              onPress={() =>
                fetchNext({
                  bookId: Number(bookId),
                  currentShamelaPageNo: page.shamelaPageNo,
                })
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: "#1DB954",
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 16,
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
