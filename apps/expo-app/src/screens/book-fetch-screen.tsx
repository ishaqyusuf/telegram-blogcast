import { useMutation, useQueryClient } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
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
};

type Step = "idle" | "fetching" | "done" | "error";

export default function BookFetchScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const inputRef = useRef<TextInput>(null);

  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

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
        qc.invalidateQueries({ queryKey: _trpc.book.getBooks.queryKey() });
      },
      onError: (e) => {
        setErrorMsg(e.message);
        setStep("error");
      },
    })
  );

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) setUrl(text.trim());
    } catch {}
  };

  const handleFetch = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    syncBook({ shamelaUrl: trimmed });
  };

  const reset = () => {
    setUrl("");
    setStep("idle");
    setResult(null);
    setErrorMsg("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

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
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", flex: 1, textAlign: "right", writingDirection: "rtl" }}>
            إضافة كتاب من الشاملة
          </Text>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Instructions */}
            <View
              style={{
                backgroundColor: "rgba(29,185,84,0.08)",
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: "rgba(29,185,84,0.2)",
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#1DB954", textAlign: "right", writingDirection: "rtl" }}>
                كيفية الاستخدام
              </Text>
              <Text style={{ fontSize: 13, color: "#b3b3b3", lineHeight: 20, textAlign: "right", writingDirection: "rtl" }}>
                الصق رابط الكتاب من موقع الشاملة (shamela.ws) وسيتم استخراج بيانات الكتاب تلقائياً وإضافته إلى المكتبة.
              </Text>
              <Text style={{ fontSize: 12, color: "#666", textAlign: "left" }}>
                مثال: https://shamela.ws/book/12345
              </Text>
            </View>

            {/* URL input */}
            <View
              style={{
                backgroundColor: "#282828",
                borderRadius: 12,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#b3b3b3", textAlign: "right", writingDirection: "rtl" }}>
                رابط الكتاب
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#1a1a1a",
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <TextInput
                  ref={inputRef}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://shamela.ws/book/..."
                  placeholderTextColor="#444"
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: "#fff",
                    textAlign: "left",
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={handleFetch}
                  editable={step !== "fetching"}
                />
                {url ? (
                  <Pressable onPress={() => setUrl("")}>
                    <Icon name="X" size={16} className="text-muted-foreground" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handlePaste}
                    style={{
                      backgroundColor: "#333",
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>لصق</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={handleFetch}
                disabled={!url.trim() || step === "fetching"}
                style={{
                  backgroundColor: !url.trim() || step === "fetching" ? "#333" : "#1DB954",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                {step === "fetching" ? (
                  <>
                    <ActivityIndicator size="small" color="#000" />
                    <Text style={{ fontWeight: "700", color: "#000", fontSize: 15 }}>
                      جاري الجلب…
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="Download" size={18} className={!url.trim() ? "text-muted-foreground" : "text-background"} />
                    <Text
                      style={{
                        fontWeight: "700",
                        fontSize: 15,
                        color: !url.trim() ? "#555" : "#000",
                      }}
                    >
                      جلب الكتاب
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Fetching state */}
            {step === "fetching" && (
              <View
                style={{
                  backgroundColor: "#282828",
                  borderRadius: 12,
                  padding: 24,
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <ActivityIndicator size="large" color="#1DB954" />
                <Text style={{ fontSize: 14, color: "#b3b3b3", textAlign: "center" }}>
                  جاري استخراج بيانات الكتاب بواسطة الذكاء الاصطناعي…
                </Text>
              </View>
            )}

            {/* Error state */}
            {step === "error" && (
              <View
                style={{
                  backgroundColor: "rgba(239,68,68,0.1)",
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "rgba(239,68,68,0.3)",
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="AlertCircle" size={18} className="text-destructive" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#ef4444" }}>
                    حدث خطأ
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: "#b3b3b3", lineHeight: 20 }}>
                  {errorMsg}
                </Text>
                <Pressable onPress={reset}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#1DB954" }}>
                    حاول مجدداً
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Success result card */}
            {step === "done" && result && (
              <View
                style={{
                  backgroundColor: "#282828",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                {/* Status banner */}
                <View
                  style={{
                    backgroundColor: result.created ? "rgba(29,185,84,0.15)" : "rgba(59,130,246,0.15)",
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
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: result.created ? "#1DB954" : "#60a5fa",
                      }}
                    >
                      {result.created ? "تمت إضافة الكتاب بنجاح" : "تم تحديث بيانات الكتاب"}
                    </Text>
                    {result.chaptersImported > 0 && (
                      <View
                        style={{
                          backgroundColor: "rgba(255,255,255,0.1)",
                          borderRadius: 10,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: "#e8e8e8", fontWeight: "600" }}>
                          {result.chaptersImported} فصل
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Book info */}
                <View style={{ padding: 14, flexDirection: "row-reverse", gap: 12 }}>
                  {/* Cover thumbnail */}
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
                        style={{ fontSize: 20, fontWeight: "bold", color: "white", writingDirection: "rtl" }}
                      >
                        {(result.book.nameAr ?? "ك").slice(0, 2)}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 5 }}>
                    <Text
                      style={{ fontSize: 16, fontWeight: "800", color: "#fff", writingDirection: "rtl", textAlign: "right" }}
                      numberOfLines={2}
                    >
                      {result.book.nameAr}
                    </Text>
                    {result.book.nameEn && (
                      <Text style={{ fontSize: 12, color: "#b3b3b3" }} numberOfLines={1}>
                        {result.book.nameEn}
                      </Text>
                    )}
                    {result.book.authors.length > 0 && (
                      <Text
                        style={{ fontSize: 13, color: "#1DB954", writingDirection: "rtl", textAlign: "right" }}
                        numberOfLines={1}
                      >
                        {result.book.authors.map((a) => a.nameAr ?? a.name).join("، ")}
                      </Text>
                    )}
                    {result.book.category && (
                      <View
                        style={{
                          alignSelf: "flex-end",
                          backgroundColor: "#333",
                          borderRadius: 5,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: "#b3b3b3", writingDirection: "rtl" }}>
                          {result.book.category}
                        </Text>
                      </View>
                    )}
                    {result.book.shelf && (
                      <Text style={{ fontSize: 11, color: "#666", writingDirection: "rtl", textAlign: "right" }}>
                        {result.book.shelf.nameAr ?? result.book.shelf.name}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingBottom: 14,
                  }}
                >
                  <Pressable
                    onPress={() => router.push(`/books/${result.book.id}` as any)}
                    style={{
                      flex: 1,
                      backgroundColor: "#1DB954",
                      borderRadius: 10,
                      paddingVertical: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 6,
                    }}
                  >
                    <Icon name="BookOpen" size={16} className="text-background" />
                    <Text style={{ fontWeight: "700", color: "#000", fontSize: 14 }}>
                      فتح الكتاب
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={reset}
                    style={{
                      backgroundColor: "#333",
                      borderRadius: 10,
                      paddingVertical: 11,
                      paddingHorizontal: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "600", color: "#fff", fontSize: 14 }}>إضافة آخر</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeArea>
    </View>
  );
}
