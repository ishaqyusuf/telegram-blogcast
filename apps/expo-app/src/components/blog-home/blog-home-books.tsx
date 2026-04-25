import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { useTranslation } from "@/lib/i18n";

const BOOK_COLORS = ["#1e40af", "#0f766e", "#b45309", "#4f46e5", "#be123c", "#0369a1"];

export function BlogHomeBooks() {
  const router = useRouter();
  const { t, textAlign, writingDirection } = useTranslation();
  const { data } = useQuery(_trpc.book.getBooks.queryOptions({ limit: 8 }));
  const books = data?.data ?? [];

  if (books.length === 0) return null;

  const getBookHref = (book: (typeof books)[number]) => {
    const firstPageId = book.pages?.[0]?.id;
    return firstPageId
      ? `/books/${book.id}/reader/${firstPageId}`
      : `/books/${book.id}`;
  };

  return (
    <View style={{ paddingTop: 16, paddingBottom: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          marginBottom: 12,
        }}
      >
        <Pressable onPress={() => router.push("/books" as any)}>
          <Text className="text-sm font-semibold text-primary">
            {t("viewAll")}
          </Text>
        </Pressable>
        <Text
          className="text-base font-bold text-foreground"
          style={{ textAlign, writingDirection }}
        >
          {t("library")}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
      >
        {books.map((book, idx) => {
          const bgColor = book.coverColor ?? BOOK_COLORS[idx % BOOK_COLORS.length];
          const authorName = book.authors?.[0]?.nameAr ?? book.authors?.[0]?.name;
          return (
            <Pressable
              key={book.id}
              onPress={() => router.push(getBookHref(book) as any)}
              style={{ width: 90 }}
            >
              <View
                style={{
                  width: 90,
                  height: 126,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: bgColor,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                {book.coverUrl ? (
                  <Image
                    source={{ uri: book.coverUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={{ fontSize: 20, fontWeight: "bold", color: "white", textAlign: "center", writingDirection: "rtl" }}
                  >
                    {(book.nameAr ?? book.nameEn ?? t("bookTitle")).slice(0, 2)}
                  </Text>
                )}
              </View>
              <Text
                className="text-[12px] font-bold text-foreground"
                style={{ textAlign: "right", writingDirection: "rtl" }}
                numberOfLines={2}
              >
                {book.nameAr ?? book.nameEn}
              </Text>
              {authorName && (
                <Text
                  className="mt-0.5 text-[10px] text-muted-foreground"
                  style={{ textAlign: "right", writingDirection: "rtl" }}
                  numberOfLines={1}
                >
                  {authorName}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
