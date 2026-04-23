import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable } from "@/components/ui/pressable";
import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
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

type Step = "idle" | "fetching" | "done" | "error";
type ManualStep = "idle" | "saving" | "done" | "error";
type AiProvider = "anthropic" | "openai" | "gemini";

const AI_PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "anthropic", label: "Claude" },
  { value: "openai", label: "GPT-4o" },
  { value: "gemini", label: "Gemini" },
];

const BOOK_URL_KEY = "book-fetch:pending-url";

function HistoryBadge({
  status,
}: {
  status: "pending" | "success" | "failed" | string;
}) {
  const palette =
    status === "success"
      ? "bg-primary/15 text-primary"
      : status === "failed"
        ? "bg-destructive/10 text-destructive"
        : "bg-secondary text-muted-foreground";

  const label =
    status === "success" ? "ناجح" : status === "failed" ? "فشل" : "قيد التنفيذ";

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

  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [aiProvider, setAiProvider] = useState<AiProvider>("anthropic");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

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
  }, []);

  useEffect(() => {
    if (!selectedBookId && selectableBooks.length > 0 && !createBookInline) {
      setSelectedBookId(selectableBooks[0]?.id ?? null);
    }
  }, [createBookInline, selectableBooks, selectedBookId]);

  const handleSetUrl = (value: string) => {
    setUrl(value);
    if (value.trim()) {
      AsyncStorage.setItem(BOOK_URL_KEY, value.trim());
    } else {
      AsyncStorage.removeItem(BOOK_URL_KEY);
    }
  };

  const invalidateBooks = () => {
    qc.invalidateQueries({ queryKey: _trpc.book.getBooks.queryKey() });
    qc.invalidateQueries({ queryKey: _trpc.book.getBookImportHistory.queryKey({ limit: 10 }) });
  };

  const { mutate: syncBook } = useMutation(
    _trpc.book.syncBookFromShamela.mutationOptions({
      onMutate: () => {
        setStep("fetching");
        setResult(null);
        setErrorMsg("");
      },
      onSuccess: (data) => {
        setResult(data as SyncResult);
        setStep("done");
        AsyncStorage.removeItem(BOOK_URL_KEY);
        setUrl("");
      },
      onError: (error) => {
        setErrorMsg(error.message);
        setStep("error");
      },
      onSettled: invalidateBooks,
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
    syncBook({ shamelaUrl: trimmed, aiProvider });
  };

  const reset = () => {
    setStep("idle");
    setResult(null);
    setErrorMsg("");
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
    const pageNumber = Number(manualPageNo);
    if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
      setManualStep("error");
      setManualError("أدخل رقم صفحة صحيحاً.");
      return;
    }

    if (!manualText.trim()) {
      setManualStep("error");
      setManualError("ألصق محتوى الصفحة أولاً.");
      return;
    }

    if (!createBookInline && !selectedBookId) {
      setManualStep("error");
      setManualError("اختر كتاباً أولاً.");
      return;
    }

    if (createBookInline && !manualBookName.trim()) {
      setManualStep("error");
      setManualError("أدخل اسم الكتاب الجديد.");
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
      printedPageNo: manualPrintedPageNo.trim()
        ? Number(manualPrintedPageNo)
        : undefined,
      chapterTitle: manualChapterTitle.trim() || undefined,
      topicTitle: manualTopicTitle.trim() || undefined,
      pageText: manualText.trim(),
    });
  };

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
            style={{
              flex: 1,
              textAlign: "right",
              fontSize: 18,
              fontWeight: "700",
              color: "#f3f4f6",
              writingDirection: "rtl",
            }}
          >
            استيراد الكتب والصفحات
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
                  textAlign: "right",
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#1DB954",
                  writingDirection: "rtl",
                }}
              >
                الاستيراد بالرابط
              </Text>
              <Text
                style={{
                  textAlign: "right",
                  fontSize: 13,
                  lineHeight: 20,
                  color: "#9ca3af",
                  writingDirection: "rtl",
                }}
              >
                ألصق رابط كتاب الشاملة ليتم حفظ محاولة الاستيراد في السجل مع
                حالة النجاح أو الفشل، ويمكنك إعادة الاستيراد من نفس السجل لاحقاً.
              </Text>
            </View>

            <View className="gap-2 rounded-xl bg-card p-3">
              <Text
                style={{
                  textAlign: "right",
                  fontSize: 13,
                  fontWeight: "600",
                  color: "#9ca3af",
                  writingDirection: "rtl",
                }}
              >
                نموذج الذكاء الاصطناعي
              </Text>
              <View className="flex-row gap-2">
                {AI_PROVIDERS.map((provider) => (
                  <Pressable
                    key={provider.value}
                    onPress={() => step !== "fetching" && setAiProvider(provider.value)}
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
                  textAlign: "right",
                  fontSize: 13,
                  fontWeight: "600",
                  color: "#9ca3af",
                  writingDirection: "rtl",
                }}
              >
                رابط الكتاب
              </Text>
              <View className="flex-row items-center gap-2 rounded-xl bg-background px-3 py-2.5">
                <TextInput
                  ref={inputRef}
                  value={url}
                  onChangeText={handleSetUrl}
                  placeholder="https://shamela.ws/book/..."
                  placeholderTextColor="#444"
                  className="flex-1 text-sm text-foreground"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={() => handleFetch()}
                  editable={step !== "fetching"}
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
                      لصق
                    </Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={() => handleFetch()}
                disabled={!url.trim() || step === "fetching"}
                className={
                  !url.trim() || step === "fetching"
                    ? "flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-3"
                    : "flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
                }
              >
                {step === "fetching" ? (
                  <>
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-[15px] font-bold text-primary-foreground">
                      جاري الجلب…
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
                      استيراد الكتاب
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {step === "fetching" && (
              <View className="items-center gap-3 rounded-xl bg-card p-6">
                <ActivityIndicator size="large" color="#1DB954" />
                <Text className="text-center text-sm text-muted-foreground">
                  جاري استخراج بيانات الكتاب بواسطة الذكاء الاصطناعي…
                </Text>
              </View>
            )}

            {step === "error" && (
              <View className="gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5">
                <View className="flex-row items-center gap-2">
                  <Icon name="AlertCircle" size={18} className="text-destructive" />
                  <Text className="text-sm font-bold text-destructive">حدث خطأ</Text>
                </View>
                <Text className="text-[13px] leading-5 text-muted-foreground">
                  {errorMsg}
                </Text>
                <Pressable onPress={reset}>
                  <Text className="text-[13px] font-semibold text-primary">
                    حاول مجدداً
                  </Text>
                </Pressable>
              </View>
            )}

            {step === "done" && result && (
              <View className="overflow-hidden rounded-2xl bg-card">
                <View
                  style={{
                    backgroundColor: result.created
                      ? "rgba(29,185,84,0.15)"
                      : "rgba(59,130,246,0.15)",
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
                      {result.created ? "تمت إضافة الكتاب" : "تم تحديث الكتاب"}
                    </Text>
                    <View className="rounded-full bg-background/30 px-2 py-0.5">
                      <Text className="text-[11px] font-semibold text-foreground">
                        سجل #{result.historyId}
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
                      backgroundColor: result.book.coverColor ?? "#4c1d95",
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
                        {(result.book.nameAr ?? "ك").slice(0, 2)}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 5 }}>
                    <Text
                      style={{
                        textAlign: "right",
                        fontSize: 16,
                        fontWeight: "800",
                        color: "#f3f4f6",
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
                          color: "#1DB954",
                          writingDirection: "rtl",
                        }}
                        numberOfLines={1}
                      >
                        {result.book.authors.map((author) => author.nameAr ?? author.name).join("، ")}
                      </Text>
                    )}
                    <Text className="text-[12px] text-muted-foreground">
                      {result.chaptersImported} فصل/رابط تمت مزامنته
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-2 px-3.5 pb-3.5">
                  <Pressable
                    onPress={() => router.push(`/books/${result.book.id}` as any)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary py-3"
                  >
                    <Icon name="BookOpen" size={16} className="text-background" />
                    <Text className="text-sm font-bold text-primary-foreground">
                      فتح الكتاب
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={reset}
                    className="items-center justify-center rounded-xl bg-secondary px-4 py-3"
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      إضافة آخر
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View className="gap-3 rounded-2xl bg-card p-3.5">
              <View className="flex-row-reverse items-center justify-between">
                <Text
                  style={{
                    textAlign: "right",
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#f3f4f6",
                    writingDirection: "rtl",
                  }}
                >
                  سجل الاستيراد الأخير
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
                        color: "#f3f4f6",
                        writingDirection: "rtl",
                      }}
                    >
                      {entry.book?.nameAr ?? entry.book?.nameEn ?? "استيراد كتاب"}
                    </Text>
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {entry.sourceUrl}
                    </Text>
                    {entry.errorMessage ? (
                      <Text
                        style={{
                          textAlign: "right",
                          fontSize: 12,
                          color: "#ef4444",
                          writingDirection: "rtl",
                        }}
                      >
                        {entry.errorMessage}
                      </Text>
                    ) : (
                      <Text
                        style={{
                          textAlign: "right",
                          fontSize: 12,
                          color: "#9ca3af",
                          writingDirection: "rtl",
                        }}
                      >
                        {entry.chaptersImported} فصل تمت مزامنته
                      </Text>
                    )}
                    <View className="flex-row gap-2">
                      {entry.bookId ? (
                        <Pressable
                          onPress={() => router.push(`/books/${entry.bookId}` as any)}
                          className="flex-1 items-center rounded-lg bg-card py-2.5"
                        >
                          <Text className="text-[12px] font-semibold text-foreground">
                            فتح
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => handleFetch(entry.sourceUrl)}
                        className="flex-1 items-center rounded-lg bg-primary py-2.5"
                      >
                        <Text className="text-[12px] font-bold text-primary-foreground">
                          إعادة الاستيراد
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
                    color: "#9ca3af",
                    writingDirection: "rtl",
                  }}
                >
                  لا توجد محاولات استيراد بعد.
                </Text>
              )}
            </View>

            <View className="gap-3 rounded-2xl bg-card p-3.5">
              <View className="gap-1">
                <Text
                  style={{
                    textAlign: "right",
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#f3f4f6",
                    writingDirection: "rtl",
                  }}
                >
                  لصق صفحة يدوياً
                </Text>
                <Text
                  style={{
                    textAlign: "right",
                    fontSize: 13,
                    lineHeight: 20,
                    color: "#9ca3af",
                    writingDirection: "rtl",
                  }}
                >
                  أدخل رقم الصفحة، اختر كتاباً موجوداً أو أنشئ كتاباً جديداً، ثم الصق النص. رابط الصفحة اختياري ويمكن استخدامه لاحقاً لإعادة الاستيراد.
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
                    كتاب موجود
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
                    إنشاء كتاب
                  </Text>
                </Pressable>
              </View>

              {createBookInline ? (
                <TextInput
                  value={manualBookName}
                  onChangeText={setManualBookName}
                  placeholder="اسم الكتاب"
                  placeholderTextColor="#666"
                  style={{
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    textAlign: "right",
                    fontSize: 14,
                    color: "#e5e7eb",
                    writingDirection: "rtl",
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
                  placeholder="رقم صفحة الشاملة"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    textAlign: "right",
                    fontSize: 14,
                    color: "#e5e7eb",
                  }}
                />
                <TextInput
                  value={manualPrintedPageNo}
                  onChangeText={setManualPrintedPageNo}
                  placeholder="رقم الصفحة المطبوع (اختياري)"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    textAlign: "right",
                    fontSize: 14,
                    color: "#e5e7eb",
                  }}
                />
              </View>

              <TextInput
                value={manualChapterTitle}
                onChangeText={setManualChapterTitle}
                placeholder="عنوان الباب (اختياري)"
                placeholderTextColor="#666"
                style={{
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  textAlign: "right",
                  fontSize: 14,
                  color: "#e5e7eb",
                  writingDirection: "rtl",
                }}
              />
              <TextInput
                value={manualTopicTitle}
                onChangeText={setManualTopicTitle}
                placeholder="عنوان الموضوع (اختياري)"
                placeholderTextColor="#666"
                style={{
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  textAlign: "right",
                  fontSize: 14,
                  color: "#e5e7eb",
                  writingDirection: "rtl",
                }}
              />
              <TextInput
                value={manualLink}
                onChangeText={setManualLink}
                placeholder="رابط الصفحة (اختياري)"
                placeholderTextColor="#666"
                className="rounded-xl bg-background px-3 py-3 text-sm text-foreground"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                value={manualText}
                onChangeText={setManualText}
                placeholder="الصق نص الصفحة هنا..."
                placeholderTextColor="#666"
                style={{
                  minHeight: 180,
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  textAlign: "right",
                  fontSize: 14,
                  color: "#e5e7eb",
                  writingDirection: "rtl",
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
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-[15px] font-bold text-primary-foreground">
                      جاري الحفظ…
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="FilePenLine" size={18} className="text-background" />
                    <Text className="text-[15px] font-bold text-primary-foreground">
                      حفظ الصفحة
                    </Text>
                  </>
                )}
              </Pressable>

              {manualStep === "error" && manualError ? (
                <Text
                  style={{
                    textAlign: "right",
                    fontSize: 13,
                    color: "#ef4444",
                    writingDirection: "rtl",
                  }}
                >
                  {manualError}
                </Text>
              ) : null}

              {manualStep === "done" && manualResult ? (
                <View className="gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3">
                  <Text
                    style={{
                      textAlign: "right",
                      fontSize: 14,
                      fontWeight: "700",
                      color: "#1DB954",
                      writingDirection: "rtl",
                    }}
                  >
                    تم حفظ الصفحة بنجاح
                  </Text>
                  <Text
                    style={{
                      textAlign: "right",
                      fontSize: 13,
                      color: "#9ca3af",
                      writingDirection: "rtl",
                    }}
                  >
                    صفحة #{manualResult.page.shamelaPageNo} في سجل #{manualResult.historyId}
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
                        فتح الصفحة
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={resetManual}
                      className="flex-1 items-center rounded-lg bg-secondary py-2.5"
                    >
                      <Text className="text-[12px] font-semibold text-foreground">
                        إضافة صفحة أخرى
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeArea>
    </View>
  );
}
