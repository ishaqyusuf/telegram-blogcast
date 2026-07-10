import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Keyboard,
  KeyboardAvoidingView,
  type KeyboardEvent,
  InteractionManager,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Modal, useModal } from "@/components/ui/modal";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { BookPageView } from "@/components/book/book-page-view";
import { BookEditorFooter } from "@/components/book/book-editor-footer";
import {
  BookRichEditor,
  type BookRichEditorCommand,
  type BookRichEditorHandle,
} from "@/components/book/book-rich-editor";
import { FootnotesSheet } from "@/components/book/footnotes-sheet";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import {
  useHighlightsSync,
  pullServerHighlights,
  syncPendingHighlights,
} from "@/hooks/use-highlights-sync";
import {
  useCommentsSync,
  pullServerComments,
  syncPendingComments,
} from "@/hooks/use-comments-sync";
import { useBookPageDraft } from "@/hooks/use-book-page-draft";
import { useBookOfflineStore } from "@/store/book-offline-store";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";
import { toAbsoluteShamelaUrl } from "@/lib/shamela-url";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import {
  createDocumentFromHtml,
  createDocumentFromPlainText,
  getDocumentPlainText,
  serializeDocumentToHtml,
  type RichDocument,
} from "@acme/document/core";

function formatAudioReferenceTime(sec?: number | null) {
  if (sec == null) return "";
  const totalSec = Math.max(0, Math.floor(sec));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const HIGHLIGHT_COLORS = [
  "#8b5cf6",
  "#facc15",
  "#22c55e",
  "#38bdf8",
  "#fb7185",
  "#f97316",
];

type SelectedTextRange = {
  paragraphId: number;
  startOffset: number;
  endOffset: number;
  quoteText: string;
};

function getLineSpacingMultiplier(spacing: "compact" | "normal" | "relaxed") {
  if (spacing === "compact") return 1.55;
  if (spacing === "relaxed") return 2;
  return 1.78;
}

export default function BookReaderScreen() {
  const { bookId, pageId, referenceId, mediaId, seekSec } =
    useLocalSearchParams<{
      bookId: string;
      pageId: string;
      referenceId?: string;
      mediaId?: string;
      seekSec?: string;
    }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const colors = useColors();
  const bookIdNum = Number(bookId);
  const pageIdNum = Number(pageId);
  const referenceIdNum = referenceId ? Number(referenceId) : undefined;
  const mediaIdNum = mediaId ? Number(mediaId) : undefined;
  const seekSecNum = seekSec ? Number(seekSec) : undefined;

  // ── Reading progress + bookmarks ────────────────────────────────────────────
  const setLastPage = useBookOfflineStore((s) => s.setLastPage);
  const isBookmarked = useBookOfflineStore((s) => s.isBookmarked);
  const addBookmark = useBookOfflineStore((s) => s.addBookmark);
  const removeBookmark = useBookOfflineStore((s) => s.removeBookmark);
  const readerFontSize = useAppSettingsStore((s) => s.readerFontSize);
  const readerLineSpacing = useAppSettingsStore((s) => s.readerLineSpacing);
  const readerTheme = useAppSettingsStore((s) => s.readerTheme);
  const setReaderFontSize = useAppSettingsStore((s) => s.setReaderFontSize);
  const setReaderLineSpacing = useAppSettingsStore(
    (s) => s.setReaderLineSpacing,
  );
  const setReaderTheme = useAppSettingsStore((s) => s.setReaderTheme);
  const resetReaderSettings = useAppSettingsStore(
    (s) => s.resetReaderSettings,
  );
  const setGlobalAudioBarHidden = useGlobalAudioBarStore((s) => s.setHidden);

  const footnotesRef = useRef<BottomSheetModal>(null);
  const readerSettingsModal = useModal();
  const [highlightedMarker, setHighlightedMarker] = useState<string | null>(
    null,
  );
  const [selectedTextRange, setSelectedTextRange] =
    useState<SelectedTextRange | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showHighlightColors, setShowHighlightColors] = useState(false);
  const [selectedHighlightColor, setSelectedHighlightColor] =
    useState("#8b5cf6");
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [editorText, setEditorText] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [baseVersion, setBaseVersion] = useState<number>(0);
  const [readerPages, setReaderPages] = useState<any[]>([]);
  const [readerWindowMeta, setReaderWindowMeta] = useState<{
    previousCursor?: number | null;
    nextCursor?: number | null;
  }>({});
  const [chunkLoadingDirection, setChunkLoadingDirection] = useState<
    "previous" | "next" | null
  >(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<BookRichEditorHandle>(null);

  // ── Server data ────────────────────────────────────────────────────────────
  const { data: page, isLoading } = useQuery(
    _trpc.book.getPage.queryOptions({ pageId: pageIdNum }),
  );
  const { data: initialReaderWindow, isLoading: isLoadingReaderWindow } =
    useQuery(
      _trpc.book.getReaderWindow.queryOptions({
        pageId: pageIdNum,
        referenceId:
          Number.isFinite(referenceIdNum) && referenceIdNum! > 0
            ? referenceIdNum
            : undefined,
        mediaId:
          Number.isFinite(mediaIdNum) && mediaIdNum! > 0 ? mediaIdNum : undefined,
        centerSec:
          Number.isFinite(seekSecNum) && seekSecNum! >= 0
            ? Math.floor(seekSecNum!)
            : undefined,
        radius: 2,
      }),
    );
  const { data: pageDocument } = useQuery(
    _trpc.book.getPageDocument.queryOptions(
      { pageId: pageIdNum },
      { enabled: mode === "edit" },
    ),
  );
  const { draft, parsedDocument, saveDraft, clearDraft } = useBookPageDraft(
    bookIdNum,
    pageIdNum,
    mode === "edit",
  );

  // ── Offline-first highlights ───────────────────────────────────────────────
  const {
    highlights,
    addHighlight,
    deleteHighlight,
    reload: reloadHighlights,
  } = useHighlightsSync(bookIdNum, pageIdNum);

  // ── Offline-first comments ─────────────────────────────────────────────────
  const { comments, addComment, deleteComment } = useCommentsSync(
    bookIdNum,
    pageIdNum,
  );
  const readerLineHeight = Math.round(
    readerFontSize * getLineSpacingMultiplier(readerLineSpacing),
  );
  const readerPalette = useMemo(() => {
    if (readerTheme === "sepia") {
      return {
        background: "#f7f0df",
        text: "#2f2418",
        card: "#efe4ca",
        muted: "#7a6a55",
      };
    }
    if (readerTheme === "night") {
      return {
        background: "#111827",
        text: "#f9fafb",
        card: "#1f2937",
        muted: "#cbd5e1",
      };
    }
    return {
      background: colors.background,
      text: colors.foreground,
      card: colors.card,
      muted: colors.mutedForeground,
    };
  }, [
    colors.background,
    colors.card,
    colors.foreground,
    colors.mutedForeground,
    readerTheme,
  ]);

  // ── Save reading progress on every page open ───────────────────────────────
  useEffect(() => {
    setLastPage(bookIdNum, pageIdNum);
  }, [bookIdNum, pageIdNum]);

  useEffect(() => {
    const data = (initialReaderWindow as any)?.data;
    if (!Array.isArray(data) || data.length === 0) return;
    setReaderPages(data);
    setReaderWindowMeta({
      previousCursor: (initialReaderWindow as any)?.meta?.previousCursor ?? null,
      nextCursor: (initialReaderWindow as any)?.meta?.nextCursor ?? null,
    });
  }, [initialReaderWindow]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  // Pull from server on mount (merge into SQLite)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      pullServerHighlights(bookIdNum)
        .catch(() => {})
        .then(reloadHighlights)
        .catch(() => {});
      pullServerComments(bookIdNum).catch(() => {});
      syncPendingHighlights(bookIdNum).catch(() => {});
      syncPendingComments(bookIdNum).catch(() => {});
    });

    return () => {
      task.cancel();
    };
  }, [bookIdNum]);

  const { mutateAsync: savePageDocument, isPending: isSavingDocument } =
    useMutation(
      _trpc.book.savePageDocument.mutationOptions({
        onSuccess: async () => {
          await clearDraft();
          qc.invalidateQueries({
            queryKey: _trpc.book.getPage.queryKey({ pageId: pageIdNum }),
          });
          qc.invalidateQueries({
            queryKey: _trpc.book.getPageDocument.queryKey({
              pageId: pageIdNum,
            }),
          });
          setMode("read");
        },
        onError: (e) => Alert.alert(t("error"), e.message),
      }),
    );

  const serverPlainText = useMemo(
    () =>
      pageDocument?.plainText ??
      (page?.paragraphs ?? []).map((paragraph) => paragraph.text).join("\n\n"),
    [page?.paragraphs, pageDocument?.plainText],
  );
  const serverHtml = useMemo(() => {
    if (mode !== "edit") return "";
    if (pageDocument?.contentHtml) return pageDocument.contentHtml;
    return serializeDocumentToHtml(
      (pageDocument?.document as RichDocument | undefined) ??
        createDocumentFromPlainText(serverPlainText),
    );
  }, [
    mode,
    pageDocument?.contentHtml,
    pageDocument?.document,
    serverPlainText,
  ]);
  const isDirty =
    mode === "edit" &&
    (editorText.trim() !== serverPlainText.trim() ||
      editorHtml.trim() !== serverHtml.trim());

  const openFootnotes = (marker: string) => {
    setHighlightedMarker(marker);
    footnotesRef.current?.present();
  };

  useEffect(() => {
    if (mode !== "edit") return;
    const draftText = draft?.plainText;
    if (draftText) {
      setEditorText(draftText);
      setEditorHtml(draft?.contentHtml ?? serverHtml);
      setBaseVersion(draft.baseVersion ?? pageDocument?.contentVersion ?? 0);
      return;
    }
    if (pageDocument?.plainText != null) {
      setEditorText(pageDocument.plainText);
      setEditorHtml(pageDocument.contentHtml ?? serverHtml);
      setBaseVersion(pageDocument.contentVersion ?? 0);
    }
  }, [
    mode,
    draft?.plainText,
    draft?.contentHtml,
    draft?.baseVersion,
    pageDocument?.plainText,
    pageDocument?.contentHtml,
    pageDocument?.contentVersion,
    serverHtml,
  ]);

  useEffect(() => {
    if (mode !== "edit") return;
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }
    draftTimerRef.current = setTimeout(() => {
      const document = editorHtml.trim()
        ? createDocumentFromHtml(editorHtml)
        : createDocumentFromPlainText(editorText);
      saveDraft({
        document,
        contentHtml: editorHtml || serializeDocumentToHtml(document),
        plainText: getDocumentPlainText(document),
        baseVersion,
      }).catch((error) => console.warn("[BookDraft] save failed", error));
    }, 500);

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
    };
  }, [mode, editorText, editorHtml, baseVersion, saveDraft]);

  const enterEditMode = () => {
    const initialDocument =
      parsedDocument ??
      (pageDocument?.document as RichDocument | undefined) ??
      createDocumentFromPlainText(serverPlainText);
    setEditorText(getDocumentPlainText(initialDocument));
    setEditorHtml(
      draft?.contentHtml ??
        pageDocument?.contentHtml ??
        serializeDocumentToHtml(initialDocument),
    );
    setBaseVersion(draft?.baseVersion ?? pageDocument?.contentVersion ?? 0);
    setMode("edit");
  };

  const cancelEditMode = async () => {
    if (isDirty) {
      Alert.alert(t("cancel"), "Discard your local draft changes?", [
        { text: t("cancel"), style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setMode("read");
            setEditorText(serverPlainText);
            setEditorHtml(serverHtml);
          },
        },
      ]);
      return;
    }
    setMode("read");
  };

  const handleSaveDocument = async () => {
    const document = editorHtml.trim()
      ? createDocumentFromHtml(editorHtml)
      : createDocumentFromPlainText(editorText);
    await savePageDocument({
      pageId: pageIdNum,
      document,
      contentHtml: editorHtml || serializeDocumentToHtml(document),
      plainText: getDocumentPlainText(document),
      baseVersion,
    });
  };

  const runEditorCommand = (command: BookRichEditorCommand) => {
    editorRef.current?.exec(command);
  };

  const handleHighlightColor = async (
    paragraphId: number,
    color: string,
    range?: SelectedTextRange | null,
  ) => {
    const selection =
      range?.paragraphId === paragraphId &&
      range.endOffset > range.startOffset &&
      range.quoteText.trim()
        ? range
        : null;
    if (!selection) return;

    const existingHighlights = highlights.filter(
      (highlight) => highlight.paragraphId === paragraphId,
    );
    for (const highlight of existingHighlights) {
      const start = highlight.startOffset ?? null;
      const end = highlight.endOffset ?? null;
      const overlaps =
        start !== null &&
        end !== null &&
        start < selection.endOffset &&
        end > selection.startOffset;
      if (overlaps) {
        await deleteHighlight(highlight.localId);
      }
    }
    await addHighlight(paragraphId, color, {
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      quoteText: selection.quoteText,
    });
    setSelectedTextRange(null);
    setShowHighlightColors(false);
  };

  const handleCopyParagraph = (paragraph: { text: string }) => {
    Clipboard.setString(paragraph.text);
    setSelectedTextRange(null);
    setShowHighlightColors(false);
  };

  const handleHighlightDelete = async (localId: string) => {
    await deleteHighlight(localId);
    setSelectedTextRange(null);
    setShowHighlightColors(false);
  };

  const selectedParagraph = useMemo(
    () =>
      page?.paragraphs.find(
        (item) => item.id === selectedTextRange?.paragraphId,
      ),
    [page?.paragraphs, selectedTextRange?.paragraphId],
  );
  const hasSelectedText =
    selectedTextRange != null &&
    selectedTextRange.endOffset > selectedTextRange.startOffset &&
    selectedTextRange.quoteText.trim().length > 0;

  useEffect(() => {
    const shouldHideGlobalAudioBar = mode === "read" && hasSelectedText;
    setGlobalAudioBarHidden(shouldHideGlobalAudioBar);

    return () => {
      setGlobalAudioBarHidden(false);
    };
  }, [hasSelectedText, mode, setGlobalAudioBarHidden]);

  const shareSelectedText = async () => {
    const selectedText = selectedTextRange?.quoteText.trim() ?? "";
    if (!selectedText) return;
    await Share.share({ message: selectedText });
    setSelectedTextRange(null);
    setShowHighlightColors(false);
  };

  const openSelectedNote = () => {
    if (!selectedTextRange) return;
    setShowCommentInput(true);
    setShowHighlightColors(false);
  };

  const highlightSelectedParagraph = (color = selectedHighlightColor) => {
    if (!selectedTextRange) return;
    void handleHighlightColor(
      selectedTextRange.paragraphId,
      color,
      selectedTextRange,
    );
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    await addComment(commentText.trim(), selectedTextRange?.paragraphId);
    setCommentText("");
    setShowCommentInput(false);
    setSelectedTextRange(null);
  };

  const bookmarked = isBookmarked(bookIdNum, pageIdNum);
  const editorFooterInset =
    keyboardHeight > 0 ? (Platform.OS === "ios" ? 12 : keyboardHeight + 12) : 0;

  const toggleBookmark = () => {
    if (!page) return;
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

  const navigateAdjacentPage = useCallback(
    (direction: "previous" | "next") => {
      if (!page || mode !== "read") return;
      const target = (page as any).adjacentPages?.[direction] as
        | {
            shamelaPageNo?: number | null;
            shamelaUrl?: string | null;
            page?: {
              id: number;
              status: string;
              shamelaUrl?: string | null;
            } | null;
          }
        | undefined;

      if (target?.page?.status === "fetched") {
        router.replace(`/books/${bookId}/reader/${target.page.id}` as any);
        return;
      }

      const targetUrl = target?.shamelaUrl ?? target?.page?.shamelaUrl;
      if (!targetUrl) {
        Alert.alert(t("error"), "No Shamela link is available for this page.");
        return;
      }

      router.push(
        `/book-fetch-browser?url=${encodeURIComponent(
          toAbsoluteShamelaUrl(targetUrl),
        )}&bookId=${bookIdNum}&autoPromote=1` as any,
      );
    },
    [bookId, bookIdNum, mode, page, router, t],
  );

  const mergeReaderPages = useCallback(
    (incomingPages: any[], direction: "previous" | "next") => {
      setReaderPages((current) => {
        const byId = new Map<number, any>();
        const merged =
          direction === "previous"
            ? [...incomingPages, ...current]
            : [...current, ...incomingPages];
        for (const readerPage of merged) {
          if (typeof readerPage?.id === "number") {
            byId.set(readerPage.id, readerPage);
          }
        }
        return Array.from(byId.values()).sort(
          (a, b) => (a.shamelaPageNo ?? 0) - (b.shamelaPageNo ?? 0),
        );
      });
    },
    [],
  );

  const loadReaderChunk = useCallback(
    async (direction: "previous" | "next") => {
      const cursor =
        direction === "previous"
          ? readerWindowMeta.previousCursor
          : readerWindowMeta.nextCursor;
      if (!cursor || chunkLoadingDirection || mode !== "read") return;
      setChunkLoadingDirection(direction);
      try {
        const result = await vanillaTrpc.book.getReaderWindow.query({
          pageId: pageIdNum,
          radius: 2,
          direction,
          cursor,
        });
        mergeReaderPages((result as any).data ?? [], direction);
        setReaderWindowMeta((current) => ({
          previousCursor:
            direction === "previous"
              ? ((result as any).meta?.previousCursor ?? null)
              : current.previousCursor,
          nextCursor:
            direction === "next"
              ? ((result as any).meta?.nextCursor ?? null)
              : current.nextCursor,
        }));
      } catch (error) {
        Alert.alert(
          t("error"),
          error instanceof Error ? error.message : "Could not load more pages.",
        );
      } finally {
        setChunkLoadingDirection(null);
      }
    },
    [
      chunkLoadingDirection,
      mergeReaderPages,
      mode,
      pageIdNum,
      readerWindowMeta.nextCursor,
      readerWindowMeta.previousCursor,
      t,
    ],
  );

  const handleReaderScroll = useCallback(
    (event: any) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      if (contentOffset.y < 180) {
        void loadReaderChunk("previous");
      }
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromBottom < 360) {
        void loadReaderChunk("next");
      }
    },
    [loadReaderChunk],
  );

  const pageSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 42 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderRelease: (_, gesture) => {
          if (!page || mode !== "read") return;
          if (gesture.dx < -60) {
            navigateAdjacentPage("next");
          } else if (gesture.dx > 60) {
            navigateAdjacentPage("previous");
          }
        },
      }),
    [mode, navigateAdjacentPage, page],
  );

  useEffect(() => {
    setSelectedTextRange(null);
    setShowHighlightColors(false);
    setShowCommentInput(false);
  }, [pageIdNum]);

  const pageBook = (page as any)?.book;

  if (isLoading && !initialReaderWindow) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!page) return null;

  const canEditPage =
    pageBook?.editable !== false &&
    (pageBook?.sourceType ?? "user") === "user" &&
    !pageBook?.shamelaId &&
    !pageBook?.shamelaUrl;
  const visibleReaderPages =
    readerPages.length > 0 ? readerPages : page ? [page] : [];
  const openFetchReaderPage = (readerPage: any) => {
    const sourceUrl = readerPage?.shamelaUrl;
    if (!sourceUrl) {
      Alert.alert(t("error"), "No Shamela link is available for this page.");
      return;
    }
    router.push(
      `/book-fetch-browser?url=${encodeURIComponent(
        toAbsoluteShamelaUrl(sourceUrl),
      )}&bookId=${bookIdNum}&autoPromote=1` as any,
    );
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <View className="flex-row items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Pressable
            onPress={() => router.back()}
            className="size-[34px] items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" size={20} className="text-foreground" />
          </Pressable>

          <Pressable
            onPress={() => readerSettingsModal.present()}
            className="size-[34px] items-center justify-center rounded-full bg-card"
          >
            <Text className="text-[17px] font-semibold text-primary">Aa</Text>
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
              {page.printedPageNo != null
                ? t("pageShort", { number: page.printedPageNo })
                : `#${page.shamelaPageNo}`}
              {page.volume
                ? `  -  ${t("volumeShort", { number: page.volume.number })}`
                : ""}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push(`/books/${bookId}/chapters` as any)}
            className="size-[34px] items-center justify-center rounded-full bg-card"
          >
            <Icon name="ListOrdered" size={18} className="text-foreground" />
          </Pressable>

          <Pressable
            onPress={toggleBookmark}
            className={
              bookmarked
                ? "size-[34px] items-center justify-center rounded-full bg-primary/15"
                : "size-[34px] items-center justify-center rounded-full bg-card"
            }
          >
            <Icon
              name="Bookmark"
              size={18}
              className={bookmarked ? "text-primary" : "text-foreground"}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              setHighlightedMarker(null);
              footnotesRef.current?.present();
            }}
            className="size-[34px] items-center justify-center rounded-full bg-card"
          >
            <Icon name="BookMarked" size={18} className="text-foreground" />
          </Pressable>

          {canEditPage && (
            <Pressable
              onPress={() => {
                if (mode === "edit") {
                  void handleSaveDocument();
                } else {
                  enterEditMode();
                }
              }}
              className="size-[34px] items-center justify-center rounded-full bg-card"
            >
              <Icon
                name={mode === "edit" ? "Check" : "Edit3"}
                size={18}
                className="text-foreground"
              />
            </Pressable>
          )}
        </View>

        {/* Content + keyboard */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {mode === "edit" ? (
            <View style={{ flex: 1 }}>
              <BookRichEditor
                ref={editorRef}
                initialHtml={editorHtml}
                onChange={({ html, plainText }) => {
                  setEditorHtml(html);
                  setEditorText(plainText);
                }}
              />
            </View>
          ) : (
            <ScrollView
              {...pageSwipeResponder.panHandlers}
              style={{ backgroundColor: readerPalette.background }}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 120,
              }}
              keyboardShouldPersistTaps="handled"
              onScroll={handleReaderScroll}
              scrollEventThrottle={16}
            >
              {chunkLoadingDirection === "previous" ? (
                <View style={{ alignItems: "center", paddingBottom: 16 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null}

              {isLoadingReaderWindow && visibleReaderPages.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null}

              {visibleReaderPages.map((readerPage: any) => {
                const isCurrentPage = readerPage.id === pageIdNum;
                const pageHighlights = isCurrentPage
                  ? highlights.map((h) => ({
                      localId: h.localId,
                      paragraphId: h.paragraphId,
                      color: h.color,
                      startOffset: h.startOffset,
                      endOffset: h.endOffset,
                      quoteText: h.quoteText,
                    }))
                  : ((readerPage.highlights ?? []) as any[]).map((h) => ({
                      localId: `server-${h.id}`,
                      paragraphId: h.paragraphId,
                      color: h.color,
                      startOffset: h.startOffset,
                      endOffset: h.endOffset,
                      quoteText: h.quoteText,
                    }));
                const pageComments = isCurrentPage
                  ? comments
                  : ((readerPage.comments ?? []) as any[]);
                const pageAudioReferences = Array.isArray(
                  readerPage.audioReferences,
                )
                  ? readerPage.audioReferences
                  : [];
                const hasFetchedContent =
                  readerPage.status === "fetched" &&
                  (readerPage.paragraphs?.length ?? 0) > 0;

                return (
                  <View key={readerPage.id} style={{ marginBottom: 32 }}>
                    {readerPage.topicTitle ? (
                      <Text
                        className="mb-4 text-center text-[15px] font-semibold text-primary"
                        style={{ writingDirection: "rtl" }}
                      >
                        {readerPage.topicTitle}
                      </Text>
                    ) : null}
                    {!isCurrentPage ? (
                      <Pressable
                        onPress={() =>
                          router.replace(
                            `/books/${bookId}/reader/${readerPage.id}` as any,
                          )
                        }
                        style={{
                          alignSelf: "center",
                          borderRadius: 999,
                          backgroundColor: readerPalette.card,
                          marginBottom: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: readerPalette.muted,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {readerPage.printedPageNo != null
                            ? t("pageShort", {
                                number: readerPage.printedPageNo,
                              })
                            : `#${readerPage.shamelaPageNo}`}
                        </Text>
                      </Pressable>
                    ) : null}

                    {hasFetchedContent ? (
                      <BookPageView
                        paragraphs={readerPage.paragraphs}
                        highlights={pageHighlights}
                        onFootnotePress={openFootnotes}
                        onCopyParagraph={
                          isCurrentPage ? handleCopyParagraph : undefined
                        }
                        selectedTextRange={
                          isCurrentPage ? selectedTextRange : null
                        }
                        onTextSelection={(selection) => {
                          if (isCurrentPage) setSelectedTextRange(selection);
                        }}
                        onHighlightColor={
                          isCurrentPage ? handleHighlightColor : undefined
                        }
                        onHighlightDelete={
                          isCurrentPage ? handleHighlightDelete : undefined
                        }
                        fontSize={readerFontSize}
                        lineHeight={readerLineHeight}
                        textColor={readerPalette.text}
                      />
                    ) : (
                      <View
                        style={{
                          alignItems: "center",
                          gap: 10,
                          borderRadius: 14,
                          backgroundColor: readerPalette.card,
                          padding: 18,
                        }}
                      >
                        <Icon
                          name="CloudDownload"
                          size={24}
                          className="text-primary"
                        />
                        <Text
                          style={{
                            color: readerPalette.muted,
                            fontSize: 13,
                            textAlign: "center",
                          }}
                        >
                          This page has not been fetched yet.
                        </Text>
                        <Pressable
                          onPress={() => openFetchReaderPage(readerPage)}
                          style={{
                            borderRadius: 10,
                            backgroundColor: colors.primary,
                            paddingHorizontal: 14,
                            paddingVertical: 9,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.primaryForeground,
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            Fetch page
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {pageComments.length > 0 && (
                      <View style={{ marginTop: 24, gap: 8 }}>
                        <Text
                          className="text-right text-sm font-bold text-foreground"
                          style={{ writingDirection: "rtl" }}
                        >
                          {t("comments", { count: pageComments.length })}
                        </Text>
                        {pageComments.map((comment: any) => (
                          <View
                            key={comment.localId ?? comment.id}
                            className="flex-row-reverse items-start gap-2 rounded-lg bg-card p-2.5"
                          >
                            <Text
                              className="flex-1 text-right text-sm text-foreground"
                              style={{ writingDirection: "rtl" }}
                            >
                              {comment.content}
                            </Text>
                            {comment.syncStatus === "pending_create" && (
                              <Icon
                                name="Clock"
                                size={12}
                                className="text-muted-foreground"
                              />
                            )}
                            {isCurrentPage ? (
                              <Pressable
                                onPress={() =>
                                  deleteComment(comment.localId)
                                }
                              >
                                <Icon
                                  name="Trash2"
                                  size={14}
                                  className="text-muted-foreground"
                                />
                              </Pressable>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}

                    {pageAudioReferences.length > 0 && (
                      <View style={{ marginTop: 24, gap: 8 }}>
                        <Text
                          className="text-right text-sm font-bold text-foreground"
                          style={{ writingDirection: "rtl" }}
                        >
                          Audio references
                        </Text>
                        {pageAudioReferences.map((reference: any) => {
                          const media = reference.media;
                          const label =
                            media?.title ||
                            media?.file?.fileName ||
                            media?.album?.name ||
                            "Referenced audio";
                          return (
                            <Pressable
                              key={reference.id}
                              onPress={() => {
                                const blogId = media?.blog?.id;
                                if (blogId) {
                                  const suffix =
                                    reference.startSec != null
                                      ? `?seekSec=${reference.startSec}`
                                      : "";
                                  router.push(
                                    `/blog-view-2/${blogId}${suffix}` as any,
                                  );
                                  return;
                                }
                                Alert.alert(
                                  "Audio unavailable",
                                  "This reference is linked to media that does not have an audio screen yet.",
                                );
                              }}
                              className="flex-row-reverse items-center gap-2 rounded-lg bg-card p-2.5"
                            >
                              <Icon
                                name="Headphones"
                                size={16}
                                className="text-primary"
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  className="text-right text-sm font-semibold text-foreground"
                                  style={{ writingDirection: "rtl" }}
                                  numberOfLines={1}
                                >
                                  {label}
                                </Text>
                                <Text className="text-right text-[11px] text-muted-foreground">
                                  {reference.startSec != null
                                    ? formatAudioReferenceTime(
                                        reference.startSec,
                                      )
                                    : ""}
                                  {reference.endSec != null
                                    ? ` - ${formatAudioReferenceTime(
                                        reference.endSec,
                                      )}`
                                    : ""}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              {chunkLoadingDirection === "next" ? (
                <View style={{ alignItems: "center", paddingTop: 4 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null}
            </ScrollView>
          )}

          {mode === "edit" ? (
            <BookEditorFooter
              isSaving={isSavingDocument}
              dirty={isDirty}
              bottomInset={editorFooterInset}
              onBold={() => runEditorCommand("bold")}
              onItalic={() => runEditorCommand("italic")}
              onUnderline={() => runEditorCommand("underline")}
              onHighlight={() => runEditorCommand("highlight")}
              onBullets={() => runEditorCommand("bullets")}
              onQuote={() => runEditorCommand("blockquote")}
              onUndo={() => runEditorCommand("undo")}
              onRedo={() => runEditorCommand("redo")}
              onCancel={() => {
                void cancelEditMode();
              }}
              onSave={() => {
                void handleSaveDocument();
              }}
            />
          ) : hasSelectedText && selectedParagraph ? (
            <View className="border-t border-border bg-background px-4 py-3">
              {showHighlightColors ? (
                <View className="mb-3 flex-row items-center justify-center gap-3">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <Pressable
                      key={color}
                      disabled={!hasSelectedText}
                      onPress={() => {
                        setSelectedHighlightColor(color);
                        highlightSelectedParagraph(color);
                      }}
                      className={`size-9 items-center justify-center rounded-full bg-card ${
                        hasSelectedText ? "" : "opacity-40"
                      }`}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: color,
                          borderWidth: selectedHighlightColor === color ? 3 : 0,
                          borderColor: colors.foreground,
                        }}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View className="flex-row items-center justify-around">
                <Pressable
                  disabled={!hasSelectedText}
                  onPress={() => {
                    void shareSelectedText();
                  }}
                  className={`min-h-12 flex-1 items-center justify-center gap-1 ${
                    hasSelectedText ? "" : "opacity-40"
                  }`}
                >
                  <Icon name="Share" size={22} className="text-foreground" />
                  <Text className="text-[12px] font-medium text-foreground">
                    Share Text
                  </Text>
                </Pressable>

                <Pressable
                  onPress={openSelectedNote}
                  className="min-h-12 flex-1 items-center justify-center gap-1"
                >
                  <Icon
                    name="MessageCircle"
                    size={22}
                    className="text-foreground"
                  />
                  <Text className="text-[12px] font-medium text-foreground">
                    Note
                  </Text>
                </Pressable>

                <Pressable
                  disabled={!hasSelectedText}
                  onPress={() => highlightSelectedParagraph()}
                  onLongPress={() => setShowHighlightColors((value) => !value)}
                  delayLongPress={250}
                  className={`min-h-12 flex-1 items-center justify-center gap-1 ${
                    hasSelectedText ? "" : "opacity-40"
                  }`}
                >
                  <View>
                    <Icon
                      name="PenLine"
                      size={22}
                      className="text-foreground"
                    />
                    <View
                      style={{
                        position: "absolute",
                        right: -7,
                        top: -5,
                        width: 13,
                        height: 13,
                        borderRadius: 7,
                        backgroundColor: selectedHighlightColor,
                      }}
                    />
                  </View>
                  <Text className="text-[12px] font-medium text-foreground">
                    Highlight
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center gap-2 border-t border-border bg-background px-4 py-3">
              <Pressable
                onPress={() => setShowCommentInput(!showCommentInput)}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-card py-2.5"
              >
                <Icon
                  name="MessageSquare"
                  size={16}
                  className="text-foreground"
                />
                <Text className="text-[13px] font-semibold text-foreground">
                  {t("comment")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => navigateAdjacentPage("previous")}
                className="flex-row items-center justify-center gap-1.5 rounded-xl bg-card px-4 py-2.5"
              >
                <Icon
                  name="ChevronRight"
                  size={18}
                  className="text-foreground"
                />
                <Text className="text-[13px] text-foreground">
                  {t("previous")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => navigateAdjacentPage("next")}
                className="flex-row items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5"
              >
                <Text className="text-[13px] font-bold text-primary-foreground">
                  {t("next")}
                </Text>
                <Icon
                  name="ChevronLeft"
                  size={18}
                  className="text-background"
                />
              </Pressable>
            </View>
          )}

          {mode === "read" && showCommentInput && (
            <View className="flex-row items-center gap-2 border-t border-border bg-card px-3 py-3">
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={
                  selectedTextRange
                    ? t("addParagraphComment")
                    : t("addComment")
                }
                placeholderTextColor={colors.mutedForeground}
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

      <Modal
        ref={readerSettingsModal.ref}
        title="Text Settings"
        snapPoints={["52%"]}
      >
        <View style={{ paddingHorizontal: 18, paddingBottom: 24, gap: 20 }}>
          <View style={{ gap: 10 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              Font Size
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => setReaderFontSize(readerFontSize - 1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  A-
                </Text>
              </Pressable>
              <Text
                style={{
                  flex: 1,
                  color: colors.foreground,
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                {readerFontSize}px
              </Text>
              <Pressable
                onPress={() => setReaderFontSize(readerFontSize + 1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: "700",
                  }}
                >
                  A+
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              Line Spacing
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["compact", "normal", "relaxed"] as const).map((spacing) => {
                const selected = readerLineSpacing === spacing;
                return (
                  <Pressable
                    key={spacing}
                    onPress={() => setReaderLineSpacing(spacing)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? colors.primary : colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: selected
                          ? colors.primaryForeground
                          : colors.foreground,
                        fontSize: 13,
                        fontWeight: "700",
                        textTransform: "capitalize",
                      }}
                    >
                      {spacing}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              Page Color
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["default", "sepia", "night"] as const).map((theme) => {
                const selected = readerTheme === theme;
                const swatch =
                  theme === "sepia"
                    ? "#f7f0df"
                    : theme === "night"
                      ? "#111827"
                      : colors.background;
                return (
                  <Pressable
                    key={theme}
                    onPress={() => setReaderTheme(theme)}
                    style={{
                      flex: 1,
                      minHeight: 46,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      backgroundColor: selected ? colors.primary : colors.card,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: swatch,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                    <Text
                      style={{
                        color: selected
                          ? colors.primaryForeground
                          : colors.foreground,
                        fontSize: 12,
                        fontWeight: "700",
                        textTransform: "capitalize",
                      }}
                    >
                      {theme}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={resetReaderSettings}
            style={{
              minHeight: 44,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              Reset Settings
            </Text>
          </Pressable>
        </View>
      </Modal>

      <FootnotesSheet
        ref={footnotesRef}
        footnotes={page.footnotes}
        highlightedMarker={highlightedMarker}
      />
    </View>
  );
}
