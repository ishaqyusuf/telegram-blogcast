import { BookCard } from "@/components/book/book-card";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@/lib/react-query";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

export default function LibraryItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const itemIdNum = Number(itemId);
  const router = useRouter();
  const qc = useQueryClient();
  const colors = useColors();
  const { t, writingDirection } = useTranslation();
  const [candidateQuery, setCandidateQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: item, isLoading } = useQuery(
    _trpc.library.getItem.queryOptions({ id: itemIdNum }),
  );

  const searchQuery = candidateQuery.trim();
  const { data: candidates = [], isFetching: isSearching } = useQuery({
    ..._trpc.library.searchDigitalBookCandidates.queryOptions({
      query: searchQuery || item?.titleAr || "",
      limit: 10,
    }),
    enabled: Boolean(
      item && !item.bookId && (searchQuery.length >= 2 || item.titleAr),
    ),
  });

  const locationText = useMemo(() => {
    if (!item) return "";
    return [
      item.location?.name,
      item.shelfNumber ? `${t("shelfNumber")}: ${item.shelfNumber}` : null,
      item.catalogCode ? `${t("catalogCode")}: ${item.catalogCode}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [item, t]);

  async function refreshItem() {
    await qc.invalidateQueries({
      queryKey: _trpc.library.getItem.queryKey({ id: itemIdNum }),
    });
    await qc.invalidateQueries({ queryKey: _trpc.library.getItems.queryKey() });
  }

  async function linkBook(bookId: number) {
    setBusy(true);
    try {
      await vanillaTrpc.library.linkDigitalBook.mutate({
        id: itemIdNum,
        bookId,
      });
      await refreshItem();
    } catch (error) {
      Alert.alert(
        t("error"),
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function unlinkBook() {
    setBusy(true);
    try {
      await vanillaTrpc.library.unlinkDigitalBook.mutate({ id: itemIdNum });
      await refreshItem();
    } catch (error) {
      Alert.alert(
        t("error"),
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem() {
    Alert.alert(t("delete"), t("deleteLibraryItemPrompt"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await vanillaTrpc.library.deleteItem.mutate({ id: itemIdNum });
            await qc.invalidateQueries({
              queryKey: _trpc.library.getItems.queryKey(),
            });
            router.replace("/books/library" as any);
          } catch (error) {
            Alert.alert(
              t("error"),
              error instanceof Error ? error.message : String(error),
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (isLoading || !item) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const firstPage = item.book?.pages?.[0];

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
            {t("physicalLibrary")}
          </Text>
          <Pressable
            onPress={() => router.push(`/books/library/${item.id}/edit` as any)}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="Pencil" size={17} className="text-foreground" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 16 }}
        >
          <View className="flex-row gap-4">
            <View style={{ width: 104 }}>
              <BookCard
                book={{
                  id: item.book?.id ?? item.id,
                  nameAr: item.titleAr,
                  nameEn: item.titleEn,
                  coverUrl: item.coverImageUrl ?? item.book?.coverUrl,
                  coverColor: item.book?.coverColor,
                  authors: item.authorText
                    ? [{ name: item.authorText }]
                    : item.book?.authors,
                }}
                onPress={() => undefined}
              />
            </View>
            <View className="flex-1 gap-2">
              <Text
                className="text-right text-xl font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {item.titleAr}
              </Text>
              {item.authorText ? (
                <Text
                  className="text-right text-[14px] text-muted-foreground"
                  style={{ writingDirection: "rtl" }}
                >
                  {item.authorText}
                </Text>
              ) : null}
              <View className="flex-row flex-wrap gap-2">
                <InfoPill
                  icon="Layers"
                  text={t("volumesCount", { count: item.volumeCount })}
                />
                <InfoPill
                  icon="Library"
                  text={locationText || t("withoutLocation")}
                />
                {item.bookId ? (
                  <InfoPill icon="BookMarked" text={t("linked")} />
                ) : null}
              </View>
            </View>
          </View>

          <View
            className="rounded-xl border border-border bg-card p-4"
            style={{ backgroundColor: colors.card }}
          >
            <SectionTitle title={t("physicalDetails")} />
            <DetailRow label={t("publisher")} value={item.publisher} />
            <DetailRow label={t("edition")} value={item.edition} />
            <DetailRow label={t("printYear")} value={item.printYear} />
            <DetailRow label={t("isbn")} value={item.isbn} />
            <DetailRow label={t("condition")} value={item.condition} />
            <DetailRow label={t("libraryLocation")} value={locationText} />
          </View>

          {(item.purchaseDate ||
            item.purchasePriceAmount ||
            item.purchaseSource) && (
            <View
              className="rounded-xl border border-border bg-card p-4"
              style={{ backgroundColor: colors.card }}
            >
              <SectionTitle title={t("purchaseDetails")} />
              <DetailRow
                label={t("purchaseDate")}
                value={
                  item.purchaseDate
                    ? new Date(item.purchaseDate).toISOString().slice(0, 10)
                    : null
                }
              />
              <DetailRow
                label={t("purchasePrice")}
                value={
                  item.purchasePriceAmount
                    ? `${item.purchasePriceAmount} ${item.purchaseCurrency ?? ""}`.trim()
                    : null
                }
              />
              <DetailRow
                label={t("purchaseSource")}
                value={item.purchaseSource}
              />
            </View>
          )}

          {item.labels.length ? (
            <View className="flex-row flex-wrap gap-2">
              {item.labels.map((label) => (
                <View
                  key={label.id}
                  className="rounded-full bg-card px-3 py-1.5"
                >
                  <Text className="text-[12px] font-semibold text-foreground">
                    {label.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {item.description || item.notes ? (
            <View
              className="rounded-xl border border-border bg-card p-4"
              style={{ backgroundColor: colors.card }}
            >
              <SectionTitle title={t("notes")} />
              {item.description ? (
                <Text
                  className="text-right text-[14px] leading-6 text-foreground"
                  style={{ writingDirection: "rtl" }}
                >
                  {item.description}
                </Text>
              ) : null}
              {item.notes ? (
                <Text
                  className="mt-2 text-right text-[13px] leading-6 text-muted-foreground"
                  style={{ writingDirection: "rtl" }}
                >
                  {item.notes}
                </Text>
              ) : null}
            </View>
          ) : null}

          {item.book ? (
            <View
              className="rounded-xl border border-border bg-card p-4"
              style={{ backgroundColor: colors.card }}
            >
              <SectionTitle title={t("digitalBook")} />
              <Text
                className="text-right text-base font-bold text-foreground"
                style={{ writingDirection: "rtl" }}
              >
                {item.book.nameAr ?? item.book.nameEn}
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                <ActionButton
                  icon="BookOpen"
                  label={t("openBook")}
                  onPress={() =>
                    firstPage
                      ? router.push(
                          `/books/${item.bookId}/reader/${firstPage.id}` as any,
                        )
                      : router.push(`/books/${item.bookId}` as any)
                  }
                />
                <ActionButton
                  icon="Search"
                  label={t("searchBook")}
                  onPress={() =>
                    router.push(`/books/${item.bookId}/search` as any)
                  }
                />
                <ActionButton
                  icon="X"
                  label={t("unlinkDigitalBook")}
                  onPress={unlinkBook}
                  disabled={busy}
                />
              </View>
            </View>
          ) : (
            <View
              className="rounded-xl border border-border bg-card p-4"
              style={{ backgroundColor: colors.card }}
            >
              <SectionTitle title={t("findDigitalBook")} />
              <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-border bg-background px-3">
                <Icon
                  name="Search"
                  size={16}
                  className="text-muted-foreground"
                />
                <TextInput
                  value={candidateQuery}
                  onChangeText={setCandidateQuery}
                  placeholder={t("searchDigitalBooks")}
                  placeholderTextColor={colors.mutedForeground}
                  className="h-11 flex-1 text-foreground"
                  style={{ writingDirection }}
                />
              </View>
              {isSearching ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={{ marginTop: 12 }}
                />
              ) : candidates.length ? (
                <View className="mt-3 gap-2">
                  {candidates.map((book) => (
                    <Pressable
                      key={book.id}
                      onPress={() => linkBook(book.id)}
                      disabled={busy}
                      className="flex-row items-center gap-3 rounded-xl bg-background p-3"
                    >
                      <Icon
                        name="BookMarked"
                        size={16}
                        className="text-primary"
                      />
                      <View className="flex-1">
                        <Text
                          className="text-right text-[14px] font-bold text-foreground"
                          style={{ writingDirection: "rtl" }}
                          numberOfLines={1}
                        >
                          {book.nameAr ?? book.nameEn}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          #{book.id}
                          {book.shamelaId ? ` · Shamela ${book.shamelaId}` : ""}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="mt-3 gap-3">
                  <Text className="text-sm text-muted-foreground">
                    {t("noDigitalBookMatch")}
                  </Text>
                  <ActionButton
                    icon="Plus"
                    label={t("importBook")}
                    onPress={() => router.push("/book-fetch" as any)}
                  />
                </View>
              )}
            </View>
          )}

          <Pressable
            onPress={deleteItem}
            disabled={busy}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-3"
          >
            <Icon name="Trash2" size={17} className="text-destructive" />
            <Text className="font-semibold text-destructive">
              {t("delete")}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeArea>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="mb-2 text-[12px] font-bold uppercase text-muted-foreground">
      {title}
    </Text>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (value == null || value === "") return null;
  return (
    <View className="flex-row items-start justify-between gap-3 py-1.5">
      <Text className="text-[12px] text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-[13px] font-semibold text-foreground">
        {String(value)}
      </Text>
    </View>
  );
}

function InfoPill({
  icon,
  text,
}: {
  icon: "BookMarked" | "Layers" | "Library";
  text: string;
}) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-card px-2 py-1">
      <Icon name={icon} size={11} className="text-muted-foreground" />
      <Text className="text-[10px] font-medium text-muted-foreground">
        {text}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: "BookOpen" | "Plus" | "Search" | "X";
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center gap-2 rounded-full bg-primary px-3 py-2"
    >
      <Icon name={icon} size={15} className="text-primary-foreground" />
      <Text className="text-[12px] font-bold text-primary-foreground">
        {label}
      </Text>
    </Pressable>
  );
}
