import { Pressable } from "@/components/ui/pressable";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { SafeArea } from "@/components/safe-area";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { BookCard } from "@/components/book/book-card";
import { useTranslation } from "@/lib/i18n";
import { useBookOfflineStore } from "@/store/book-offline-store";

export default function BooksScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const [selectedShelfId, setSelectedShelfId] = useState<number | undefined>(
    undefined,
  );
  const [showBookmarks, setShowBookmarks] = useState(false);
  const bookmarksByBook = useBookOfflineStore((s) => s.bookmarks);
  const getLastPage = useBookOfflineStore((s) => s.getLastPage);
  const removeBookmark = useBookOfflineStore((s) => s.removeBookmark);

  const { data: shelves = [] } = useQuery(_trpc.book.getShelves.queryOptions());
  const { data, isLoading } = useQuery(
    _trpc.book.getBooks.queryOptions({ shelfId: selectedShelfId, limit: 40 }),
  );

  const books = useMemo(() => data?.data ?? [], [data?.data]);
  const bookTitles = useMemo(() => {
    const titles = new Map<number, string>();
    for (const book of books) {
      titles.set(
        book.id,
        book.nameAr ?? book.nameEn ?? `${t("bookTitle")} #${book.id}`,
      );
    }
    return titles;
  }, [books, t]);
  const bookmarkItems = useMemo(
    () =>
      Object.values(bookmarksByBook)
        .flat()
        .sort((a, b) => b.createdAt - a.createdAt),
    [bookmarksByBook],
  );

  const openBook = (book: (typeof books)[number]) => {
    const lastPageId = getLastPage(book.id);
    if (lastPageId) {
      router.push(`/books/${book.id}/reader/${lastPageId}` as any);
      return;
    }

    const firstFetchedPage = book.pages[0];
    if (firstFetchedPage) {
      router.push(`/books/${book.id}/reader/${firstFetchedPage.id}` as any);
      return;
    }

    router.push(`/books/${book.id}` as any);
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ backgroundColor: colors.background }}
    >
      <SafeArea>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-foreground">
            {t("digitalBooks")}
          </Text>
          <Pressable
            onPress={() => router.push("/books/library" as any)}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="Library" size={18} className="text-foreground" />
          </Pressable>
          <Pressable
            onPress={() => setShowBookmarks((value) => !value)}
            className={
              showBookmarks
                ? "size-9 items-center justify-center rounded-full bg-primary/15"
                : "size-9 items-center justify-center rounded-full bg-card"
            }
          >
            <Icon
              name="Bookmark"
              size={18}
              className={showBookmarks ? "text-primary" : "text-foreground"}
            />
          </Pressable>
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
            contentContainerStyle={{
              gap: 8,
              paddingHorizontal: 16,
              paddingBottom: 12,
            }}
          >
            <Pressable
              onPress={() => setSelectedShelfId(undefined)}
              className={
                selectedShelfId === undefined
                  ? "rounded-full bg-primary px-4 py-1.5"
                  : "rounded-full bg-card px-4 py-1.5"
              }
            >
              <Text
                className={
                  selectedShelfId === undefined
                    ? "text-sm font-semibold text-primary-foreground"
                    : "text-sm font-semibold text-foreground"
                }
              >
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
                  className={
                    selectedShelfId === shelf.id
                      ? "text-sm font-semibold text-primary-foreground"
                      : "text-sm font-semibold text-foreground"
                  }
                  style={{ writingDirection: "rtl" }}
                >
                  {shelf.nameAr ?? shelf.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {showBookmarks && (
          <View
            className="mx-4 mb-3 rounded-xl border border-border bg-card px-3 py-3"
            style={{ backgroundColor: colors.card, gap: 10 }}
          >
            <View className="flex-row-reverse items-center justify-between">
              <Text
                className="text-right text-[14px] font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {t("bookmarks", { count: bookmarkItems.length })}
              </Text>
              <Icon name="Bookmark" size={15} className="text-primary" />
            </View>

            {bookmarkItems.length === 0 ? (
              <Text
                className="text-right text-[13px] text-muted-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {t("noBookmarks")}
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {bookmarkItems.slice(0, 12).map((bookmark) => (
                  <View
                    key={`${bookmark.bookId}-${bookmark.pageId}`}
                    className="w-[220px] rounded-lg bg-background px-3 py-2.5"
                    style={{ borderWidth: 1, borderColor: colors.border }}
                  >
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/books/${bookmark.bookId}/reader/${bookmark.pageId}` as any,
                        )
                      }
                      style={{ gap: 4 }}
                    >
                      <Text
                        className="text-right text-[12px] font-semibold text-muted-foreground"
                        style={{ writingDirection: "rtl" }}
                        numberOfLines={1}
                      >
                        {bookTitles.get(bookmark.bookId) ??
                          `${t("bookTitle")} #${bookmark.bookId}`}
                      </Text>
                      <Text
                        className="text-right text-[13px] font-bold text-foreground"
                        style={{ writingDirection: "rtl" }}
                        numberOfLines={2}
                      >
                        {bookmark.chapterTitle ??
                          `${t("page")} ${bookmark.pageNo ?? bookmark.pageId}`}
                      </Text>
                      {bookmark.pageNo != null ? (
                        <Text className="text-[11px] text-muted-foreground">
                          {t("pageShort", { number: bookmark.pageNo })}
                        </Text>
                      ) : null}
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        removeBookmark(bookmark.bookId, bookmark.pageId)
                      }
                      hitSlop={10}
                      style={{ position: "absolute", left: 8, top: 8 }}
                    >
                      <Icon
                        name="X"
                        size={14}
                        className="text-muted-foreground"
                      />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
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
            style={{ backgroundColor: colors.background }}
            data={books}
            keyExtractor={(item) => String(item.id)}
            numColumns={3}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingBottom: 120,
            }}
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
