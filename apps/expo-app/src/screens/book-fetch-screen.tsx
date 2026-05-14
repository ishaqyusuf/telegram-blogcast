import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Pressable } from "@/components/ui/pressable";
import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { Modal, useModal } from "@/components/ui/modal";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useBookFetchBrowserStore } from "@/store/book-fetch-browser-store";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type SyncResult = {
  book: {
    id: number;
    nameAr?: string | null;
    nameEn?: string | null;
    coverUrl?: string | null;
    coverColor?: string | null;
    category?: string | null;
    shamelaUrl?: string | null;
    authors: { id: number; name: string; nameAr?: string | null }[];
    shelf: { id: number; name: string; nameAr?: string | null } | null;
  };
  created: boolean;
  chaptersImported: number;
  historyId: number;
  importedPage: {
    id: number;
    shamelaPageNo: number;
    printedPageNo?: number | null;
    chapterTitle?: string | null;
    topicTitle?: string | null;
    importHistoryId: number;
  } | null;
};

type ManualResult = {
  bookId: number;
  page: {
    id: number;
    chapterTitle?: string | null;
    topicTitle?: string | null;
    shamelaPageNo: number;
    printedPageNo?: number | null;
  };
  historyId: number;
};

type PreviewResult = {
  sourceUrl: string;
  normalizedUrl: string;
  shamelaId: number;
  bookIndexUrl: string;
  linkedPageUrl: string | null;
  aiProvider: "openai" | "gemini";
  aiModel: AiModel;
  previewJson: {
    metadata: Record<string, unknown>;
    toc: {
      volumes: { number: number; title: string | null }[];
      chapterCount: number;
      chapters: {
        shamelaPageNo: number;
        shamelaUrl: string;
        chapterTitle: string | null;
        topicTitle: string | null;
        volumeNumber: number;
      }[];
      truncated: boolean;
    };
    linkedPage: Record<string, unknown> | null;
  };
};

type Step = "idle" | "fetching" | "done" | "error";
type ManualStep = "idle" | "saving" | "done" | "error";
type AiModel = "gpt-5" | "gpt-4o" | "gemini";

const AI_PROVIDERS: { value: AiModel; label: string }[] = [
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gemini", label: "Gemini" },
];

const BOOK_URL_KEY = "book-fetch:pending-url";
const AI_PROVIDER_KEY = "book-fetch:ai-provider";

function HistoryBadge({
  status,
}: {
  status: "pending" | "success" | "failed" | string;
}) {
  const { t } = useTranslation();
  const palette =
    status === "success"
      ? "bg-primary/15 text-primary"
      : status === "failed"
        ? "bg-destructive/10 text-destructive"
        : "bg-secondary text-muted-foreground";

  const label =
    status === "success"
      ? t("importSuccess")
      : status === "failed"
        ? t("importFailed")
        : t("importPending");

  return (
    <View className={`rounded-full px-2 py-1 ${palette}`}>
      <Text className="text-[11px] font-semibold">{label}</Text>
    </View>
  );
}

export default function BookFetchScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const inputRef = useRef<TextInput>(null);
  const previewModal = useModal();
  const failureModal = useModal();
  const { t, textAlign, writingDirection, isRtl } = useTranslation();
  const colors = useColors();
  const browserCapture = useBookFetchBrowserStore((state) => state.capture);
  const clearBrowserCapture = useBookFetchBrowserStore((state) => state.clear);

  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [aiProvider, setAiProvider] = useState<AiModel>("gpt-5");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [failureDetails, setFailureDetails] = useState("");

  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [createBookInline, setCreateBookInline] = useState(false);
  const [manualBookName, setManualBookName] = useState("");
  const [manualPageNo, setManualPageNo] = useState("");
  const [manualPrintedPageNo, setManualPrintedPageNo] = useState("");
  const [manualChapterTitle, setManualChapterTitle] = useState("");
  const [manualTopicTitle, setManualTopicTitle] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [manualText, setManualText] = useState("");
  const [manualStep, setManualStep] = useState<ManualStep>("idle");
  const [manualResult, setManualResult] = useState<ManualResult | null>(null);
  const [manualError, setManualError] = useState("");
  const [expandedHistoryErrorId, setExpandedHistoryErrorId] = useState<
    number | null
  >(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  const { data: importHistory } = useQuery(
    _trpc.book.getBookImportHistory.queryOptions({ limit: 10 }),
  );
  const { data: booksData } = useQuery(
    _trpc.book.getBooks.queryOptions({ limit: 12 }),
  );

  const selectableBooks = useMemo(
    () => (Array.isArray((booksData as any)?.data) ? (booksData as any).data : []),
    [booksData],
  );

  useEffect(() => {
    AsyncStorage.getItem(BOOK_URL_KEY).then((saved) => {
      if (saved) setUrl(saved);
    });
    AsyncStorage.getItem(AI_PROVIDER_KEY).then((saved) => {
      if (saved && AI_PROVIDERS.some((provider) => provider.value === saved)) {
        setAiProvider(saved as AiModel);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedBookId && selectableBooks.length > 0 && !createBookInline) {
      setSelectedBookId(selectableBooks[0]?.id ?? null);
    }
  }, [createBookInline, selectableBooks, selectedBookId]);

  useEffect(() => {
    if (!browserCapture) return;
    if (browserCapture.requestedUrl !== url.trim()) {
      handleSetUrl(browserCapture.requestedUrl);
    }
    setErrorMsg("");
    setFailureDetails("");
    setStep("idle");
  }, [browserCapture]);

  const handleSetUrl = (value: string) => {
    setUrl(value);
    if (value.trim()) {
      AsyncStorage.setItem(BOOK_URL_KEY, value.trim());
    } else {
      AsyncStorage.removeItem(BOOK_URL_KEY);
    }
  };

  const handleSetAiProvider = (value: AiModel) => {
    setAiProvider(value);
    AsyncStorage.setItem(AI_PROVIDER_KEY, value);
  };

  const invalidateBooks = () => {
    qc.invalidateQueries({ queryKey: _trpc.book.getBooks.queryKey() });
    qc.invalidateQueries({ queryKey: _trpc.book.getBookImportHistory.queryKey({ limit: 10 }) });
  };

  const showFailureDetails = (message: string) => {
    setFailureDetails(message);
    failureModal.present();
  };

  const { mutate: syncBook } = useMutation(
    _trpc.book.syncBookFromShamela.mutationOptions({
      onMutate: () => {
        setStep("fetching");
        setResult(null);
        setErrorMsg("");
        setFailureDetails("");
      },
      onSuccess: (data) => {
        setResult(data as SyncResult);
        setStep("done");
        setFailureDetails("");
        AsyncStorage.removeItem(BOOK_URL_KEY);
        setUrl("");
      },
      onError: (error) => {
        console.error("book import failed", {
          shamelaUrl: url.trim(),
          aiProvider,
          error,
        });
        setErrorMsg(error.message);
        setStep("error");
        showFailureDetails(error.message);
      },
      onSettled: invalidateBooks,
    }),
  );

  const { mutate: previewBookImport, isPending: isPreviewing } = useMutation(
    _trpc.book.previewBookImportFromShamela.mutationOptions({
      onMutate: () => {
        setFailureDetails("");
      },
      onSuccess: (data) => {
        setPreviewResult(data as PreviewResult);
        setFailureDetails("");
        previewModal.present();
      },
      onError: (error) => {
        setErrorMsg(error.message);
        setStep("error");
        showFailureDetails(error.message);
      },
    }),
  );

  const { mutate: importManualPage } = useMutation(
    _trpc.book.importBookPageManually.mutationOptions({
      onMutate: () => {
        setManualStep("saving");
        setManualError("");
        setManualResult(null);
      },
      onSuccess: (data) => {
        setManualResult(data as ManualResult);
        setManualStep("done");
        qc.invalidateQueries({ queryKey: _trpc.book.getBooks.queryKey() });
      },
      onError: (error) => {
        console.error("manual book page import failed", {
          bookId: createBookInline ? undefined : selectedBookId ?? undefined,
          createBookInline,
          manualBookName: manualBookName.trim() || undefined,
          sourceUrl: manualLink.trim() || undefined,
          shamelaPageNo: manualPageNo.trim() || undefined,
          printedPageNo: manualPrintedPageNo.trim() || undefined,
          chapterTitle: manualChapterTitle.trim() || undefined,
          topicTitle: manualTopicTitle.trim() || undefined,
          error,
        });
        setManualError(error.message);
        setManualStep("error");
      },
    }),
  );

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) handleSetUrl(text.trim());
    } catch {}
  };

  const handleFetch = (sourceUrl?: string) => {
    const trimmed = (sourceUrl ?? url).trim();
    if (!trimmed) return;
    handleSetUrl(trimmed);
    setErrorMsg("");
    setFailureDetails("");
    setStep("idle");
    clearBrowserCapture();
    router.push({
      pathname: "/book-fetch-browser",
      params: { url: trimmed },
    } as any);
  };

  const handleApproveImport = () => {
    if (!previewResult?.sourceUrl) return;
    previewModal.dismiss();
    syncBook({ shamelaUrl: previewResult.sourceUrl, aiModel: aiProvider });
  };

  const reset = () => {
    setStep("idle");
    setResult(null);
    setErrorMsg("");
    setFailureDetails("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const resetManual = () => {
    setManualStep("idle");
    setManualResult(null);
    setManualError("");
    setManualPageNo("");
    setManualPrintedPageNo("");
    setManualChapterTitle("");
    setManualTopicTitle("");
    setManualLink("");
    setManualText("");
    setManualBookName("");
  };

  const submitManualPage = () => {
    const trimmedPageNo = manualPageNo.trim();
    const pageNumber = trimmedPageNo ? Number(trimmedPageNo) : undefined;
    const trimmedPrintedPageNo = manualPrintedPageNo.trim();
    const printedPageNumber = trimmedPrintedPageNo
      ? Number(trimmedPrintedPageNo)
      : undefined;
    if (
      pageNumber !== undefined &&
      (!Number.isFinite(pageNumber) || pageNumber <= 0)
    ) {
      setManualStep("error");
      setManualError(t("enterValidPage"));
      return;
    }

    if (
      printedPageNumber !== undefined &&
      (!Number.isFinite(printedPageNumber) || printedPageNumber <= 0)
    ) {
      setManualStep("error");
      setManualError(t("enterValidPage"));
      return;
    }

    if (!manualText.trim()) {
      setManualStep("error");
      setManualError(t("pasteContentFirst"));
      return;
    }

    if (!createBookInline && !selectedBookId) {
      setManualStep("error");
      setManualError(t("chooseBookFirst"));
      return;
    }

    if (createBookInline && !manualBookName.trim()) {
      setManualStep("error");
      setManualError(t("enterBookTitle"));
      return;
    }

    importManualPage({
      bookId: createBookInline ? undefined : selectedBookId ?? undefined,
      createBook: createBookInline
        ? {
            nameAr: manualBookName.trim(),
            shamelaUrl: manualLink.trim() || undefined,
          }
        : undefined,
      sourceUrl: manualLink.trim() || undefined,
      shamelaPageNo: pageNumber,
      printedPageNo: printedPageNumber,
      chapterTitle: manualChapterTitle.trim() || undefined,
      topicTitle: manualTopicTitle.trim() || undefined,
      pageText: manualText.trim(),
    });
  };

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View
          className="items-center gap-3 px-4 py-3"
          style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
        >
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign,
              fontSize: 18,
              fontWeight: "700",
              color: colors.foreground,
              writingDirection,
            }}
          >
            {t("booksAndPages")}
          </Text>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-1.5 rounded-xl border border-primary/20 bg-primary/10 p-3.5">
              <Text
                style={{
                  textAlign,
                  fontSize: 14,
                  fontWeight: "700",
                  color: colors.primary,
                  writingDirection,
                }}
              >
                {t("bookImportTitle")}
              </Text>
              <Text
                style={{
                  textAlign,
                  fontSize: 13,
                  lineHeight: 20,
                  color: colors.mutedForeground,
                  writingDirection,
                }}
              >
                {t("bookImportDescription")}
              </Text>
            </View>

            <View className="gap-2 rounded-xl bg-card p-3">
              <Text
                style={{
                  textAlign,
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.mutedForeground,
                  writingDirection,
                }}
              >
                {t("aiModel")}
              </Text>
              <View className="flex-row gap-2">
                {AI_PROVIDERS.map((provider) => (
                  <Pressable
                    key={provider.value}
                    onPress={() =>
                      step !== "fetching" && handleSetAiProvider(provider.value)
                    }
                    className={
                      aiProvider === provider.value
                        ? "flex-1 items-center rounded-lg bg-primary py-2.5"
                        : "flex-1 items-center rounded-lg bg-secondary py-2.5"
                    }
                  >
                    <Text
                      className={
                        aiProvider === provider.value
                          ? "text-[13px] font-bold text-primary-foreground"
                          : "text-[13px] font-bold text-muted-foreground"
                      }
                    >
                      {provider.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-2.5 rounded-xl bg-card p-3">
              <Text
                style={{
                  textAlign,
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.mutedForeground,
                  writingDirection,
                }}
              >
                {t("bookLink")}
              </Text>
              <View className="flex-row items-center gap-2 rounded-xl bg-background px-3 py-2.5">
                <TextInput
                  ref={inputRef}
                  value={url}
                  onChangeText={handleSetUrl}
                  placeholder="https://shamela.ws/book/..."
                  placeholderTextColor={colors.mutedForeground}
                  className="flex-1 text-sm text-foreground"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={() => handleFetch()}
                  editable={step !== "fetching" && !isPreviewing}
                />
                {url ? (
                  <Pressable onPress={() => handleSetUrl("")}>
                    <Icon name="X" size={16} className="text-muted-foreground" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handlePaste}
                    className="rounded-md bg-secondary px-2.5 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-foreground">
                      {t("paste")}
                    </Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={() => handleFetch()}
                disabled={!url.trim() || step === "fetching" || isPreviewing}
                className={
                  !url.trim() || step === "fetching" || isPreviewing
                    ? "flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-3"
                    : "flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
                }
              >
                {step === "fetching" || isPreviewing ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                    <Text className="text-[15px] font-bold text-primary-foreground">
                      {step === "fetching" ? t("fetchingBook") : "Generating preview"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon
                      name="Download"
                      size={18}
                      className={!url.trim() ? "text-muted-foreground" : "text-background"}
                    />
                    <Text
                      className={
                        !url.trim()
                          ? "text-[15px] font-bold text-muted-foreground"
                          : "text-[15px] font-bold text-primary-foreground"
                      }
                    >
                      Open protected page
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {browserCapture && browserCapture.requestedUrl === url.trim() ? (
              <View className="gap-2 rounded-xl border border-primary/25 bg-primary/10 p-3.5">
                <View className="flex-row items-center gap-2">
                  <Icon name="CheckCircle2" size={18} className="text-primary" />
                  <Text className="text-sm font-bold text-primary">
                    Browser page captured
                  </Text>
                </View>
                <Text className="text-[13px] leading-5 text-muted-foreground">
                  {`Captured ${browserCapture.html.length.toLocaleString()} HTML chars from the in-app browser after manual verification.`}
                </Text>
                <Text className="text-[12px] leading-5 text-muted-foreground">
                  {browserCapture.finalUrl}
                </Text>
                <Text className="text-[12px] leading-5 text-muted-foreground">
                  The mobile browser assist flow is ready. The next step is passing this captured HTML into the backend import parser.
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleFetch(browserCapture.requestedUrl)}
                    className="rounded-lg bg-secondary px-3 py-2"
                  >
                    <Text className="text-[13px] font-semibold text-foreground">
                      Reopen browser
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={clearBrowserCapture}
                    className="rounded-lg bg-card px-3 py-2"
                  >
                    <Text className="text-[13px] font-semibold text-foreground">
                      Clear capture
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {step === "fetching" && (
              <View className="items-center gap-3 rounded-xl bg-card p-6">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-center text-sm text-muted-foreground">
                  {t("fetchingBookDetails")}
                </Text>
              </View>
            )}

            {step === "error" && (
              <View className="gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5">
                <View className="flex-row items-center gap-2">
                  <Icon name="AlertCircle" size={18} className="text-destructive" />
                  <Text className="text-sm font-bold text-destructive">
                    {t("error")}
                  </Text>
                </View>
                <Text className="text-[13px] leading-5 text-muted-foreground">
                  {errorMsg}
                </Text>
                {failureDetails ? (
                  <Pressable onPress={() => failureModal.present()}>
                    <Text className="text-[13px] font-semibold text-primary">
                      View failure details
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={reset}>
                  <Text className="text-[13px] font-semibold text-primary">
                    {t("tryAgain")}
                  </Text>
                </Pressable>
              </View>
            )}

            {step === "done" && result && (
              <View className="overflow-hidden rounded-2xl bg-card">
                <View
                  style={{
                    backgroundColor: result.created
                      ? withAlpha(colors.primary, 0.15)
                      : withAlpha(colors.accent, 0.5),
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Icon
                    name={result.created ? "CheckCircle2" : "RefreshCw"}
                    size={16}
                    className={result.created ? "text-primary" : "text-blue-400"}
                  />
                  <View className="flex-row-reverse items-center gap-2">
                    <Text
                      className={
                        result.created
                          ? "text-[13px] font-bold text-primary"
                          : "text-[13px] font-bold text-sky-400"
                      }
                    >
                      {result.created ? t("addedBook") : t("updatedBook")}
                    </Text>
                    <View className="rounded-full bg-background/30 px-2 py-0.5">
                      <Text className="text-[11px] font-semibold text-foreground">
                        {t("historyRecord", { id: result.historyId })}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ padding: 14, flexDirection: "row-reverse", gap: 12 }}>
                  <View
                    style={{
                      width: 64,
                      height: 88,
                      borderRadius: 8,
                      overflow: "hidden",
                      backgroundColor: result.book.coverColor ?? colors.primary,
                      flexShrink: 0,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {result.book.coverUrl ? (
                      <Image
                        source={{ uri: result.book.coverUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: "700",
                          color: "white",
                          writingDirection: "rtl",
                        }}
                      >
                        {(result.book.nameAr ?? result.book.nameEn ?? t("bookTitle")).slice(0, 2)}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 5 }}>
                    <Text
                      style={{
                        textAlign: "right",
                        fontSize: 16,
                        fontWeight: "800",
                        color: colors.foreground,
                        writingDirection: "rtl",
                      }}
                      numberOfLines={2}
                    >
                      {result.book.nameAr}
                    </Text>
                    {result.book.authors.length > 0 && (
                      <Text
                        style={{
                          textAlign: "right",
                          fontSize: 13,
                          color: colors.primary,
                          writingDirection: "rtl",
                        }}
                        numberOfLines={1}
                      >
                        {result.book.authors.map((author) => author.nameAr ?? author.name).join("، ")}
                      </Text>
                    )}
                    <Text className="text-[12px] text-muted-foreground">
                      {t("syncedChapters", { count: result.chaptersImported })}
                    </Text>
                    {result.importedPage ? (
                      <Text className="text-[12px] text-muted-foreground">
                        Imported linked page {result.importedPage.shamelaPageNo}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View className="flex-row gap-2 px-3.5 pb-3.5">
                  {result.importedPage ? (
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/books/${result.book.id}/reader/${result.importedPage?.id}` as any,
                        )
                      }
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-card py-3"
                    >
                      <Icon name="FileText" size={16} className="text-foreground" />
                      <Text className="text-sm font-semibold text-foreground">
                        Open Page
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => router.push(`/books/${result.book.id}` as any)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-3"
                  >
                    <Icon name="BookOpen" size={16} className="text-background" />
                    <Text className="text-sm font-bold text-primary-foreground">
                      {t("openBook")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={reset}
                    className="items-center justify-center rounded-xl bg-secondary px-4 py-3"
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {t("addAnother")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View className="gap-3 rounded-2xl bg-card p-3.5">
              <View className="flex-row-reverse items-center justify-between">
                <Text
                  style={{
                    textAlign,
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.foreground,
                    writingDirection,
                  }}
                >
                  {t("history")}
                </Text>
                <Icon name="History" size={16} className="text-muted-foreground" />
              </View>

              {importHistory?.length ? (
                importHistory.map((entry) => (
                  <View
                    key={entry.id}
                    className="gap-2 rounded-xl border border-border bg-background p-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <HistoryBadge status={entry.status} />
                      <Text className="text-[11px] text-muted-foreground">
                        #{entry.id}
                      </Text>
                    </View>
                    <Text
                      style={{
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: "600",
                        color: colors.foreground,
                        writingDirection: "rtl",
                      }}
                    >
                      {entry.book?.nameAr ?? entry.book?.nameEn ?? t("importBook")}
                    </Text>
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {entry.sourceUrl}
                    </Text>
                    {entry.errorMessage ? (
                      <Pressable
                        onPress={() =>
                          setExpandedHistoryErrorId((current) =>
                            current === entry.id ? null : entry.id,
                          )
                        }
                        className="gap-1"
                      >
                        <Text
                          numberOfLines={
                            expandedHistoryErrorId === entry.id ? undefined : 2
                          }
                          style={{
                            textAlign: "right",
                            fontSize: 12,
                            color: "#ef4444",
                            writingDirection: "rtl",
                          }}
                        >
                          {entry.errorMessage}
                        </Text>
                        <Text
                          style={{
                            textAlign: "right",
                            fontSize: 11,
                            color: colors.mutedForeground,
                            writingDirection: "rtl",
                          }}
                        >
                          {expandedHistoryErrorId === entry.id
                            ? "Tap to collapse"
                            : "Tap to show full error"}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text
                        style={{
                          textAlign: "right",
                          fontSize: 12,
                          color: colors.mutedForeground,
                          writingDirection: "rtl",
                        }}
                      >
                        {t("syncedChaptersShort", { count: entry.chaptersImported })}
                      </Text>
                    )}
                    <View className="flex-row gap-2">
                      {entry.bookId ? (
                        <Pressable
                          onPress={() => router.push(`/books/${entry.bookId}` as any)}
                          className="flex-1 items-center rounded-lg bg-card py-2.5"
                        >
                          <Text className="text-[12px] font-semibold text-foreground">
                            {t("open")}
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => handleFetch(entry.sourceUrl)}
                        className="flex-1 items-center rounded-lg bg-primary py-2.5"
                      >
                        <Text className="text-[12px] font-bold text-primary-foreground">
                          {t("importRetry")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <Text
                  style={{
                    textAlign: "right",
                    fontSize: 13,
                    color: colors.mutedForeground,
                    writingDirection: "rtl",
                  }}
                >
                  {t("noImportHistory")}
                </Text>
              )}
            </View>

            <View className="gap-3 rounded-2xl bg-card p-3.5">
              <View className="gap-1">
                <Text
                  style={{
                    textAlign,
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.foreground,
                    writingDirection,
                  }}
                >
                  {t("manualPaste")}
                </Text>
                <Text
                  style={{
                    textAlign,
                    fontSize: 13,
                    lineHeight: 20,
                    color: colors.mutedForeground,
                    writingDirection,
                  }}
                >
                  {t("manualBookDescription")}
                </Text>
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setCreateBookInline(false)}
                  className={
                    !createBookInline
                      ? "flex-1 items-center rounded-lg bg-primary py-2.5"
                      : "flex-1 items-center rounded-lg bg-secondary py-2.5"
                  }
                >
                  <Text
                    className={
                      !createBookInline
                        ? "text-[13px] font-bold text-primary-foreground"
                        : "text-[13px] font-semibold text-foreground"
                    }
                  >
                    {t("existingBook")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCreateBookInline(true)}
                  className={
                    createBookInline
                      ? "flex-1 items-center rounded-lg bg-primary py-2.5"
                      : "flex-1 items-center rounded-lg bg-secondary py-2.5"
                  }
                >
                  <Text
                    className={
                      createBookInline
                        ? "text-[13px] font-bold text-primary-foreground"
                        : "text-[13px] font-semibold text-foreground"
                    }
                  >
                    {t("createBook")}
                  </Text>
                </Pressable>
              </View>

              {createBookInline ? (
                <TextInput
                  value={manualBookName}
                  onChangeText={setManualBookName}
                  placeholder={t("bookTitle")}
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    textAlign,
                    fontSize: 14,
                    color: colors.foreground,
                    writingDirection,
                  }}
                />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {selectableBooks.map((book) => (
                      <Pressable
                        key={book.id}
                        onPress={() => setSelectedBookId(book.id)}
                        className={
                          selectedBookId === book.id
                            ? "rounded-full bg-primary px-3 py-2"
                            : "rounded-full bg-background px-3 py-2"
                        }
                      >
                        <Text
                          className={
                            selectedBookId === book.id
                              ? "text-[12px] font-bold text-primary-foreground"
                              : "text-[12px] font-semibold text-foreground"
                          }
                        >
                          {book.nameAr ?? book.nameEn ?? `#${book.id}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}

              <View className="flex-row gap-2">
                <TextInput
                  value={manualPageNo}
                  onChangeText={setManualPageNo}
                  placeholder={t("pageNumber")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    textAlign,
                    fontSize: 14,
                    color: colors.foreground,
                  }}
                />
                <TextInput
                  value={manualPrintedPageNo}
                  onChangeText={setManualPrintedPageNo}
                  placeholder={t("printedPageNumber")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    textAlign,
                    fontSize: 14,
                    color: colors.foreground,
                  }}
                />
              </View>

              <TextInput
                value={manualChapterTitle}
                onChangeText={setManualChapterTitle}
                placeholder={t("chapterTitle")}
                placeholderTextColor={colors.mutedForeground}
                style={{
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  textAlign,
                  fontSize: 14,
                  color: colors.foreground,
                  writingDirection,
                }}
              />
              <TextInput
                value={manualTopicTitle}
                onChangeText={setManualTopicTitle}
                placeholder={t("topicTitle")}
                placeholderTextColor={colors.mutedForeground}
                style={{
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  textAlign,
                  fontSize: 14,
                  color: colors.foreground,
                  writingDirection,
                }}
              />
              <TextInput
                value={manualLink}
                onChangeText={setManualLink}
                placeholder={t("pageLink")}
                placeholderTextColor={colors.mutedForeground}
                className="rounded-xl bg-background px-3 py-3 text-sm text-foreground"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                value={manualText}
                onChangeText={setManualText}
                placeholder={t("pageContent")}
                placeholderTextColor={colors.mutedForeground}
                style={{
                  minHeight: 180,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  textAlign,
                  fontSize: 14,
                  color: colors.foreground,
                  writingDirection,
                  textAlignVertical: "top",
                }}
                multiline
              />

              <Pressable
                onPress={submitManualPage}
                disabled={manualStep === "saving"}
                className={
                  manualStep === "saving"
                    ? "flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-3"
                    : "flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
                }
              >
                {manualStep === "saving" ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                    <Text className="text-[15px] font-bold text-primary-foreground">
                      {t("saving")}
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="FilePenLine" size={18} className="text-background" />
                    <Text className="text-[15px] font-bold text-primary-foreground">
                      {t("savePage")}
                    </Text>
                  </>
                )}
              </Pressable>

              {manualStep === "error" && manualError ? (
                <Text
                  style={{
                    textAlign,
                    fontSize: 13,
                    color: "#ef4444",
                    writingDirection,
                  }}
                >
                  {manualError}
                </Text>
              ) : null}

              {manualStep === "done" && manualResult ? (
                <View className="gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3">
                  <Text
                    style={{
                      textAlign,
                      fontSize: 14,
                      fontWeight: "700",
                    color: colors.primary,
                      writingDirection,
                    }}
                  >
                    {t("bookSaved")}
                  </Text>
                  <Text
                    style={{
                      textAlign,
                      fontSize: 13,
                      color: colors.mutedForeground,
                      writingDirection,
                    }}
                  >
                    {t("pageSavedMeta", {
                      page: manualResult.page.shamelaPageNo,
                      history: manualResult.historyId,
                    })}
                  </Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/books/${manualResult.bookId}/reader/${manualResult.page.id}` as any,
                        )
                      }
                      className="flex-1 items-center rounded-lg bg-primary py-2.5"
                    >
                      <Text className="text-[12px] font-bold text-primary-foreground">
                        {t("openPage")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={resetManual}
                      className="flex-1 items-center rounded-lg bg-secondary py-2.5"
                    >
                      <Text className="text-[12px] font-semibold text-foreground">
                        {t("addAnotherPage")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeArea>
      <Modal
        ref={previewModal.ref}
        title="Import Preview"
        snapPoints={["85%"]}
      >
        <View className="flex-1 bg-background px-4 pb-6">
          <BottomSheetScrollView
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View className="gap-1 rounded-xl bg-card p-3">
              <Text className="text-sm font-semibold text-foreground">
                Source URL
              </Text>
              <Text className="text-xs text-muted-foreground">
                {previewResult?.sourceUrl ?? ""}
              </Text>
            </View>

            <View className="gap-1 rounded-xl bg-card p-3">
              <Text className="text-sm font-semibold text-foreground">
                AI JSON Preview
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.foreground,
                  fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
                }}
              >
                {previewResult
                  ? JSON.stringify(previewResult.previewJson, null, 2)
                  : ""}
              </Text>
            </View>
          </BottomSheetScrollView>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => previewModal.dismiss()}
              className="flex-1 items-center rounded-xl bg-secondary py-3"
            >
              <Text className="text-sm font-semibold text-foreground">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleApproveImport}
              className="flex-1 items-center rounded-xl bg-primary py-3"
            >
              <Text className="text-sm font-bold text-primary-foreground">
                Approve Import
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        ref={failureModal.ref}
        title="Import Failure"
        snapPoints={["88%"]}
      >
        <View className="flex-1 bg-background px-4 pb-6">
          <BottomSheetScrollView
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View className="gap-1 rounded-xl bg-card p-3">
              <Text className="text-sm font-semibold text-foreground">
                Full failure response
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.foreground,
                  fontFamily: Platform.select({
                    ios: "Menlo",
                    android: "monospace",
                    default: "monospace",
                  }),
                }}
              >
                {failureDetails}
              </Text>
            </View>
          </BottomSheetScrollView>

          <Pressable
            onPress={() => failureModal.dismiss()}
            className="items-center rounded-xl bg-secondary py-3"
          >
            <Text className="text-sm font-semibold text-foreground">Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
