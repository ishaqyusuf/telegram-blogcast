import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";

const BOOK_COLORS = ["#4c1d95", "#7c2d12", "#14532d", "#1e3a5f", "#3b0764", "#064e3b"];

export function BlogHomeBooks() {
  const router = useRouter();
  const { data } = useQuery(_trpc.book.getBooks.queryOptions({ limit: 8 }));
  const books = data?.data ?? [];

  if (books.length === 0) return null;

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
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#1DB954" }}>عرض الكل</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", writingDirection: "rtl" }}>
          المكتبة
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
              onPress={() => router.push(`/books/${book.id}` as any)}
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
                    {(book.nameAr ?? "ك").slice(0, 2)}
                  </Text>
                )}
              </View>
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#fff", textAlign: "right", writingDirection: "rtl" }}
                numberOfLines={2}
              >
                {book.nameAr ?? book.nameEn}
              </Text>
              {authorName && (
                <Text
                  style={{ fontSize: 10, color: "#b3b3b3", textAlign: "right", writingDirection: "rtl", marginTop: 2 }}
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
