import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { BookCard } from "@/components/book/book-card";
import { useTranslation } from "@/lib/i18n";

export default function BooksScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedShelfId, setSelectedShelfId] = useState<number | undefined>(undefined);

  const { data: shelves = [] } = useQuery(_trpc.book.getShelves.queryOptions());
  const { data, isLoading } = useQuery(
    _trpc.book.getBooks.queryOptions({ shelfId: selectedShelfId, limit: 40 })
  );

  const books = data?.data ?? [];

  const openBook = (book: (typeof books)[number]) => {
    router.push(`/books/${book.id}` as any);
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
          <Text className="flex-1 text-lg font-bold text-foreground">
            {t("library")}
          </Text>
          <Pressable
            onPress={() => router.push("/book-fetch" as any)}
            className="size-9 items-center justify-center rounded-full bg-primary"
          >
            <Icon name="Plus" size={20} className="text-background" />
          </Pressable>
        </View>

        {shelves.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
          >
            <Pressable
              onPress={() => setSelectedShelfId(undefined)}
              className={
                selectedShelfId === undefined
                  ? "rounded-full bg-primary px-4 py-1.5"
                  : "rounded-full bg-card px-4 py-1.5"
              }
            >
              <Text className={selectedShelfId === undefined ? "text-sm font-semibold text-primary-foreground" : "text-sm font-semibold text-foreground"}>
                {t("all")}
              </Text>
            </Pressable>
            {shelves.map((shelf) => (
              <Pressable
                key={shelf.id}
                onPress={() => setSelectedShelfId(shelf.id)}
                className={
                  selectedShelfId === shelf.id
                    ? "rounded-full bg-primary px-4 py-1.5"
                    : "rounded-full bg-card px-4 py-1.5"
                }
              >
                <Text
                  className={selectedShelfId === shelf.id ? "text-sm font-semibold text-primary-foreground" : "text-sm font-semibold text-foreground"}
                  style={{ writingDirection: "rtl" }}
                >
                  {shelf.nameAr ?? shelf.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground">{t("loading")}</Text>
          </View>
        ) : books.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3">
            <Icon name="BookOpen" size={48} className="text-muted-foreground" />
            <Text className="text-muted-foreground">{t("noBooks")}</Text>
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
                onPress={() => openBook(item)}
              />
            )}
          />
        )}
      </SafeArea>
    </View>
  );
}
