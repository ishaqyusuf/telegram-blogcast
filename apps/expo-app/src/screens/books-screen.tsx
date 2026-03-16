import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { BookCard } from "@/components/book/book-card";

export default function BooksScreen() {
  const router = useRouter();
  const [selectedShelfId, setSelectedShelfId] = useState<number | undefined>(undefined);

  const { data: shelves = [] } = useQuery(_trpc.book.getShelves.queryOptions());
  const { data, isLoading } = useQuery(
    _trpc.book.getBooks.queryOptions({ shelfId: selectedShelfId, limit: 40 })
  );

  const books = data?.data ?? [];

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
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", flex: 1 }}>
            المكتبة
          </Text>
          <Pressable
            onPress={() => router.push("/book-fetch" as any)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#1DB954",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="Plus" size={20} className="text-background" />
          </Pressable>
        </View>

        {/* Shelf filter pills */}
        {shelves.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
          >
            <Pressable
              onPress={() => setSelectedShelfId(undefined)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: selectedShelfId === undefined ? "#1DB954" : "#282828",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: selectedShelfId === undefined ? "#000" : "#fff",
                }}
              >
                الكل
              </Text>
            </Pressable>
            {shelves.map((shelf) => (
              <Pressable
                key={shelf.id}
                onPress={() => setSelectedShelfId(shelf.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: selectedShelfId === shelf.id ? "#1DB954" : "#282828",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: selectedShelfId === shelf.id ? "#000" : "#fff",
                    writingDirection: "rtl",
                  }}
                >
                  {shelf.nameAr ?? shelf.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#b3b3b3" }}>جاري التحميل…</Text>
          </View>
        ) : books.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Icon name="BookOpen" size={48} className="text-muted-foreground" />
            <Text style={{ color: "#b3b3b3" }}>لا توجد كتب</Text>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => String(item.id)}
            numColumns={3}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 120 }}
            columnWrapperStyle={{ gap: 10, marginBottom: 16 }}
            renderItem={({ item, index }) => (
              <BookCard
                book={item}
                index={index}
                onPress={() => router.push(`/books/${item.id}` as any)}
              />
            )}
          />
        )}
      </SafeArea>
    </View>
  );
}
