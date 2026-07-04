import { BookCard } from "@/components/book/book-card";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@/lib/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, Text, TextInput, View } from "react-native";

export default function LibraryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, writingDirection } = useTranslation();
  const [query, setQuery] = useState("");
  const [linked, setLinked] = useState<boolean | undefined>(undefined);
  const [selectedLocationId, setSelectedLocationId] = useState<
    number | undefined
  >();

  const { data: locations = [] } = useQuery(
    _trpc.library.getLocations.queryOptions(),
  );
  const { data, isLoading } = useQuery(
    _trpc.library.getItems.queryOptions({
      query: query.trim() || undefined,
      linked,
      locationId: selectedLocationId,
      limit: 80,
    }),
  );

  const items = useMemo(() => data?.data ?? [], [data?.data]);

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
            onPress={() => router.push("/books/library/new" as any)}
            className="size-9 items-center justify-center rounded-full bg-primary"
          >
            <Icon name="Plus" size={20} className="text-background" />
          </Pressable>
        </View>

        <View className="px-4 pb-3">
          <View
            className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3"
            style={{ backgroundColor: colors.card }}
          >
            <Icon name="Search" size={17} className="text-muted-foreground" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("searchLibrary")}
              placeholderTextColor={colors.mutedForeground}
              className="h-11 flex-1 text-foreground"
              style={{ writingDirection }}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <Icon name="X" size={16} className="text-muted-foreground" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          <FilterChip
            active={linked === undefined && selectedLocationId === undefined}
            label={t("all")}
            onPress={() => {
              setLinked(undefined);
              setSelectedLocationId(undefined);
            }}
          />
          <FilterChip
            active={linked === true}
            label={t("linkedBooks")}
            onPress={() => setLinked(linked === true ? undefined : true)}
          />
          <FilterChip
            active={linked === false}
            label={t("unlinkedBooks")}
            onPress={() => setLinked(linked === false ? undefined : false)}
          />
          {locations.map((location) => (
            <FilterChip
              key={location.id}
              active={selectedLocationId === location.id}
              label={location.name}
              onPress={() =>
                setSelectedLocationId(
                  selectedLocationId === location.id ? undefined : location.id,
                )
              }
            />
          ))}
        </ScrollView>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground">{t("loading")}</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Icon name="Library" size={46} className="text-muted-foreground" />
            <Text className="text-center text-base font-semibold text-foreground">
              {t("noLibraryItems")}
            </Text>
            <Pressable
              onPress={() => router.push("/books/library/new" as any)}
              className="mt-1 flex-row items-center gap-2 rounded-full bg-primary px-4 py-2"
            >
              <Icon name="Plus" size={17} className="text-primary-foreground" />
              <Text className="font-semibold text-primary-foreground">
                {t("addLibraryItem")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 120,
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/books/library/${item.id}` as any)}
                className="rounded-xl border border-border bg-card p-3 active:opacity-80"
                style={{ backgroundColor: colors.card }}
              >
                <View className="flex-row gap-3">
                  <View style={{ width: 76 }}>
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
                      onPress={() =>
                        router.push(`/books/library/${item.id}` as any)
                      }
                    />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row-reverse items-start justify-between gap-2">
                      <Text
                        className="flex-1 text-right text-[15px] font-bold text-foreground"
                        style={{ writingDirection: "rtl" }}
                        numberOfLines={2}
                      >
                        {item.titleAr}
                      </Text>
                      {item.bookId ? (
                        <View className="rounded-full bg-primary/15 px-2 py-1">
                          <Text className="text-[10px] font-bold text-primary">
                            {t("linked")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {item.authorText ? (
                      <Text
                        className="text-right text-[12px] text-muted-foreground"
                        style={{ writingDirection: "rtl" }}
                        numberOfLines={1}
                      >
                        {item.authorText}
                      </Text>
                    ) : null}
                    <View className="mt-1 flex-row flex-wrap gap-2">
                      <MetaPill
                        icon="Library"
                        text={
                          item.location?.name ??
                          item.shelfNumber ??
                          t("withoutLocation")
                        }
                      />
                      <MetaPill
                        icon="Layers"
                        text={t("volumesCount", { count: item.volumeCount })}
                      />
                      {item.catalogCode ? (
                        <MetaPill icon="Info" text={item.catalogCode} />
                      ) : null}
                    </View>
                    {item.labels.length ? (
                      <View className="mt-1 flex-row flex-wrap gap-1.5">
                        {item.labels.slice(0, 4).map((label) => (
                          <View
                            key={label.id}
                            className="rounded-full bg-background px-2 py-0.5"
                          >
                            <Text className="text-[10px] text-muted-foreground">
                              {label.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeArea>
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={
        active
          ? "rounded-full bg-primary px-4 py-1.5"
          : "rounded-full bg-card px-4 py-1.5"
      }
    >
      <Text
        className={
          active
            ? "text-sm font-semibold text-primary-foreground"
            : "text-sm font-semibold text-foreground"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MetaPill({
  icon,
  text,
}: {
  icon: "Info" | "Layers" | "Library";
  text: string;
}) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-background px-2 py-1">
      <Icon name={icon} size={11} className="text-muted-foreground" />
      <Text className="text-[10px] font-medium text-muted-foreground">
        {text}
      </Text>
    </View>
  );
}
