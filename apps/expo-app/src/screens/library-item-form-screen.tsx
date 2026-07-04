import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@/lib/react-query";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type LibraryFormState = {
  titleAr: string;
  titleEn: string;
  authorText: string;
  publisher: string;
  edition: string;
  printYear: string;
  isbn: string;
  description: string;
  notes: string;
  volumeCount: string;
  shelfNumber: string;
  catalogCode: string;
  purchaseDate: string;
  purchasePriceAmount: string;
  purchaseCurrency: string;
  purchaseSource: string;
  condition: string;
  status: string;
  coverImageUrl: string;
  bookId: string;
  locationName: string;
  labels: string;
};

const emptyState: LibraryFormState = {
  titleAr: "",
  titleEn: "",
  authorText: "",
  publisher: "",
  edition: "",
  printYear: "",
  isbn: "",
  description: "",
  notes: "",
  volumeCount: "1",
  shelfNumber: "",
  catalogCode: "",
  purchaseDate: "",
  purchasePriceAmount: "",
  purchaseCurrency: "",
  purchaseSource: "",
  condition: "",
  status: "owned",
  coverImageUrl: "",
  bookId: "",
  locationName: "",
  labels: "",
};

export default function LibraryItemFormScreen() {
  const { itemId, bookId, titleAr, titleEn, authorText } =
    useLocalSearchParams<{
      itemId?: string;
      bookId?: string;
      titleAr?: string;
      titleEn?: string;
      authorText?: string;
    }>();
  const router = useRouter();
  const qc = useQueryClient();
  const colors = useColors();
  const { t, writingDirection } = useTranslation();
  const itemIdNum = Number(itemId);
  const isEditing = Number.isFinite(itemIdNum) && itemIdNum > 0;
  const [form, setForm] = useState<LibraryFormState>(emptyState);
  const [saving, setSaving] = useState(false);

  const { data: item, isLoading } = useQuery({
    ..._trpc.library.getItem.queryOptions({ id: itemIdNum }),
    enabled: isEditing,
  });
  const { data: locations = [] } = useQuery(
    _trpc.library.getLocations.queryOptions(),
  );
  const { data: labels = [] } = useQuery(
    _trpc.library.getLabels.queryOptions(),
  );

  useEffect(() => {
    if (!item || !isEditing) return;
    setForm({
      titleAr: item.titleAr ?? "",
      titleEn: item.titleEn ?? "",
      authorText: item.authorText ?? "",
      publisher: item.publisher ?? "",
      edition: item.edition ?? "",
      printYear: item.printYear ?? "",
      isbn: item.isbn ?? "",
      description: item.description ?? "",
      notes: item.notes ?? "",
      volumeCount: String(item.volumeCount ?? 1),
      shelfNumber: item.shelfNumber ?? "",
      catalogCode: item.catalogCode ?? "",
      purchaseDate: item.purchaseDate
        ? new Date(item.purchaseDate).toISOString().slice(0, 10)
        : "",
      purchasePriceAmount: item.purchasePriceAmount
        ? String(item.purchasePriceAmount)
        : "",
      purchaseCurrency: item.purchaseCurrency ?? "",
      purchaseSource: item.purchaseSource ?? "",
      condition: item.condition ?? "",
      status: item.status ?? "owned",
      coverImageUrl: item.coverImageUrl ?? "",
      bookId: item.bookId ? String(item.bookId) : "",
      locationName: item.location?.name ?? "",
      labels: item.labels.map((label) => label.name).join(", "),
    });
  }, [isEditing, item]);

  useEffect(() => {
    if (isEditing) return;
    setForm((current) => ({
      ...current,
      bookId: bookId ?? current.bookId,
      titleAr: titleAr ?? current.titleAr,
      titleEn: titleEn ?? current.titleEn,
      authorText: authorText ?? current.authorText,
    }));
  }, [authorText, bookId, isEditing, titleAr, titleEn]);

  const knownLocation = useMemo(() => {
    const name = form.locationName.trim().toLowerCase();
    if (!name) return null;
    return (
      locations.find((location) => location.name.toLowerCase() === name) ?? null
    );
  }, [form.locationName, locations]);

  const update = (key: keyof LibraryFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function resolveLocationId() {
    const name = form.locationName.trim();
    if (!name) return null;
    if (knownLocation) return knownLocation.id;
    const created = await vanillaTrpc.library.createLocation.mutate({ name });
    return created.id;
  }

  async function resolveLabelIds() {
    const names = [
      ...new Set(
        form.labels
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const ids: number[] = [];
    for (const name of names) {
      const existing = labels.find(
        (label) => label.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const created = await vanillaTrpc.library.createLabel.mutate({ name });
      ids.push(created.id);
    }
    return ids;
  }

  async function save() {
    const titleAr = form.titleAr.trim();
    if (!titleAr) {
      Alert.alert(t("error"), t("enterBookTitle"));
      return;
    }

    setSaving(true);
    try {
      const locationId = await resolveLocationId();
      const labelIds = await resolveLabelIds();
      const volumeCount = Math.max(1, Number(form.volumeCount) || 1);
      const price = form.purchasePriceAmount.trim()
        ? Number(form.purchasePriceAmount)
        : null;
      const bookId = form.bookId.trim() ? Number(form.bookId) : null;

      const payload = {
        titleAr,
        titleEn: form.titleEn.trim() || null,
        authorText: form.authorText.trim() || null,
        publisher: form.publisher.trim() || null,
        edition: form.edition.trim() || null,
        printYear: form.printYear.trim() || null,
        isbn: form.isbn.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        volumeCount,
        locationId,
        shelfNumber: form.shelfNumber.trim() || null,
        catalogCode: form.catalogCode.trim() || null,
        purchaseDate: form.purchaseDate.trim() || null,
        purchasePriceAmount: Number.isFinite(price) ? price : null,
        purchaseCurrency: form.purchaseCurrency.trim() || null,
        purchaseSource: form.purchaseSource.trim() || null,
        condition: form.condition.trim() || null,
        status: form.status.trim() || "owned",
        coverImageUrl: form.coverImageUrl.trim() || null,
        bookId: Number.isFinite(bookId) ? bookId : null,
        labelIds,
      };

      const saved = isEditing
        ? await vanillaTrpc.library.updateItem.mutate({
            id: itemIdNum,
            ...payload,
          })
        : await vanillaTrpc.library.createItem.mutate(payload);

      await qc.invalidateQueries({
        queryKey: _trpc.library.getItems.queryKey(),
      });
      await qc.invalidateQueries({
        queryKey: _trpc.library.getLocations.queryKey(),
      });
      await qc.invalidateQueries({
        queryKey: _trpc.library.getLabels.queryKey(),
      });
      router.replace(`/books/library/${saved.id}` as any);
    } catch (error) {
      Alert.alert(
        t("error"),
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            {isEditing ? t("editLibraryItem") : t("addLibraryItem")}
          </Text>
          <Pressable
            onPress={save}
            disabled={saving}
            className="flex-row items-center gap-2 rounded-full bg-primary px-4 py-2"
          >
            {saving ? (
              <ActivityIndicator
                color={colors.primaryForeground}
                size="small"
              />
            ) : (
              <Icon
                name="Check"
                size={16}
                className="text-primary-foreground"
              />
            )}
            <Text className="font-semibold text-primary-foreground">
              {saving ? t("saving") : t("save")}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}
        >
          <SectionTitle title={t("libraryIdentity")} />
          <Field
            label={t("bookTitle")}
            value={form.titleAr}
            onChangeText={(value) => update("titleAr", value)}
            writingDirection="rtl"
            required
          />
          <Field
            label={t("englishTitle")}
            value={form.titleEn}
            onChangeText={(value) => update("titleEn", value)}
            writingDirection="ltr"
          />
          <Field
            label={t("author")}
            value={form.authorText}
            onChangeText={(value) => update("authorText", value)}
            writingDirection={writingDirection}
          />
          <Field
            label={t("publisher")}
            value={form.publisher}
            onChangeText={(value) => update("publisher", value)}
            writingDirection={writingDirection}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label={t("edition")}
                value={form.edition}
                onChangeText={(value) => update("edition", value)}
              />
            </View>
            <View className="flex-1">
              <Field
                label={t("printYear")}
                value={form.printYear}
                onChangeText={(value) => update("printYear", value)}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <Field
            label={t("isbn")}
            value={form.isbn}
            onChangeText={(value) => update("isbn", value)}
            keyboardType="numbers-and-punctuation"
          />

          <SectionTitle title={t("physicalDetails")} />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label={t("volumeCount")}
                value={form.volumeCount}
                onChangeText={(value) => update("volumeCount", value)}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <Field
                label={t("condition")}
                value={form.condition}
                onChangeText={(value) => update("condition", value)}
              />
            </View>
          </View>
          <Field
            label={t("libraryLocation")}
            value={form.locationName}
            onChangeText={(value) => update("locationName", value)}
            placeholder={t("libraryLocationPlaceholder")}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label={t("shelfNumber")}
                value={form.shelfNumber}
                onChangeText={(value) => update("shelfNumber", value)}
              />
            </View>
            <View className="flex-1">
              <Field
                label={t("catalogCode")}
                value={form.catalogCode}
                onChangeText={(value) => update("catalogCode", value)}
              />
            </View>
          </View>
          <Field
            label={t("labelsCommaSeparated")}
            value={form.labels}
            onChangeText={(value) => update("labels", value)}
            placeholder={t("labelsPlaceholder")}
          />

          <SectionTitle title={t("purchaseDetails")} />
          <Field
            label={t("purchaseDate")}
            value={form.purchaseDate}
            onChangeText={(value) => update("purchaseDate", value)}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label={t("purchasePrice")}
                value={form.purchasePriceAmount}
                onChangeText={(value) => update("purchasePriceAmount", value)}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="w-24">
              <Field
                label={t("currency")}
                value={form.purchaseCurrency}
                onChangeText={(value) => update("purchaseCurrency", value)}
                placeholder="USD"
                autoCapitalize="characters"
              />
            </View>
          </View>
          <Field
            label={t("purchaseSource")}
            value={form.purchaseSource}
            onChangeText={(value) => update("purchaseSource", value)}
          />

          <SectionTitle title={t("digitalLink")} />
          <Field
            label={t("linkedBookId")}
            value={form.bookId}
            onChangeText={(value) => update("bookId", value)}
            keyboardType="number-pad"
            placeholder={t("linkedBookIdPlaceholder")}
          />
          <Field
            label={t("coverImageUrl")}
            value={form.coverImageUrl}
            onChangeText={(value) => update("coverImageUrl", value)}
            keyboardType="url"
            autoCapitalize="none"
          />

          <SectionTitle title={t("notes")} />
          <Field
            label={t("description")}
            value={form.description}
            onChangeText={(value) => update("description", value)}
            multiline
          />
          <Field
            label={t("notes")}
            value={form.notes}
            onChangeText={(value) => update("notes", value)}
            multiline
          />
        </ScrollView>
      </SafeArea>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="mt-2 text-[13px] font-bold uppercase text-muted-foreground">
      {title}
    </Text>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  required,
  writingDirection,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  writingDirection?: "rtl" | "ltr";
} & Omit<
  ComponentProps<typeof TextInput>,
  "value" | "onChangeText" | "placeholder"
>) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text className="text-[12px] font-semibold text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        className="rounded-xl border border-border bg-card px-3 text-foreground"
        style={{
          minHeight: multiline ? 92 : 44,
          paddingTop: multiline ? 10 : undefined,
          textAlignVertical: multiline ? "top" : "center",
          backgroundColor: colors.card,
          writingDirection,
        }}
        {...inputProps}
      />
    </View>
  );
}
