import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

type StagedPreviewDocument = {
  context?: {
    currentTopic?: { label?: string | null } | null;
    breadcrumb?: Array<{ role?: string | null; label?: string | null }>;
  } | null;
  content?: Array<Record<string, any>>;
};

function asJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, any>;
}

function normalizeDiagnostic(item: unknown) {
  if (typeof item === "string") {
    return {
      code: "diagnostic",
      severity: "info",
      message: item,
      source: null as string | null,
    };
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;

    return {
      code: typeof record.code === "string" ? record.code : "diagnostic",
      severity:
        typeof record.severity === "string" ? record.severity : "info",
      message:
        typeof record.message === "string"
          ? record.message
          : JSON.stringify(record),
      source: typeof record.source === "string" ? record.source : null,
    };
  }

  return {
    code: "diagnostic",
    severity: "info",
    message: String(item),
    source: null as string | null,
  };
}

export default function BookFetchPreviewScreen() {
  const { stagedParseId } = useLocalSearchParams<{ stagedParseId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const colors = useColors();
  const { textAlign, writingDirection, isRtl } = useTranslation();

  const stagedId = Number(stagedParseId);
  const { data, isLoading } = useQuery(
    _trpc.book.getStagedShamelaPageParse.queryOptions(
      { stagedParseId: stagedId },
      { enabled: Number.isFinite(stagedId) && stagedId > 0 },
    ),
  );
  const diagnostics = Array.isArray(data?.diagnostics)
    ? data.diagnostics.map(normalizeDiagnostic)
    : [];
  const document = asJsonObject(data?.document) as StagedPreviewDocument | null;
  const linkGraph = asJsonObject(data?.linkGraph);
  const isPromoted = data?.status === "promoted";
  const { mutate: promotePage, isPending: isPromoting } = useMutation(
    _trpc.book.promoteStagedShamelaPageParse.mutationOptions({
      onSuccess: (result) => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBooks.queryKey() });
        qc.invalidateQueries({ queryKey: _trpc.book.getBook.queryKey({ id: result.bookId }) });
        router.replace(`/books/${result.bookId}/reader/${result.page.id}` as any);
      },
      onError: (error) => Alert.alert("Import failed", error.message),
    }),
  );

  return (
    <View className="flex-1 bg-background">
      <SafeArea>
        <View
          className="items-center gap-3 border-b border-border px-4 py-3"
          style={{ flexDirection: isRtl ? "row-reverse" : "row" }}
        >
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card"
          >
            <Icon name="ChevronLeft" size={22} className="text-foreground" />
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign,
              fontSize: 18,
              fontWeight: "700",
              color: colors.foreground,
              writingDirection,
            }}
          >
            Staged Page Preview
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          {isLoading || !data ? (
            <View className="rounded-xl bg-card p-4">
              <Text className="text-sm text-muted-foreground">Loading staged parse...</Text>
            </View>
          ) : (
            <>
              <View className="gap-2 rounded-xl bg-card p-4">
                <Text className="text-base font-bold text-foreground">
                  {document?.context?.currentTopic?.label ||
                    data.chapterTitle ||
                    data.rawPage.title ||
                    "Untitled page"}
                </Text>
                {data.topicTitle ? (
                  <Text className="text-sm text-primary">{data.topicTitle}</Text>
                ) : null}
                <Text className="text-xs text-muted-foreground">
                  Shamela page {data.shamelaPageNo ?? "unknown"} · printed{" "}
                  {data.printedPageNo ?? "unknown"} · volume{" "}
                  {data.volumeNumber ?? "unknown"}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {data.rawPage.finalUrl}
                </Text>
                <Pressable
                  disabled={isPromoting}
                  onPress={() => promotePage({ stagedParseId: stagedId })}
                  className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
                  style={{ opacity: isPromoting ? 0.65 : 1 }}
                >
                  {isPromoting ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Icon name="Download" size={17} className="text-primary-foreground" />
                  )}
                  <Text className="text-[14px] font-bold text-primary-foreground">
                    {isPromoting
                      ? isPromoted
                        ? "Opening..."
                        : "Importing..."
                      : isPromoted
                        ? "Open imported page"
                        : "Import to database"}
                  </Text>
                </Pressable>
              </View>

              {Array.isArray(document?.context?.breadcrumb) &&
              document.context.breadcrumb.length > 0 ? (
                <View className="gap-3 rounded-xl bg-card p-4">
                  <Text className="text-sm font-bold text-foreground">Breadcrumb</Text>
                  {document.context.breadcrumb.map((item: any, index: number) => (
                    <Text key={`${item.label}-${index}`} className="text-xs text-muted-foreground">
                      {item.role} · {item.label}
                    </Text>
                  ))}
                </View>
              ) : null}

              {linkGraph ? (
                <View className="gap-2 rounded-xl bg-card p-4">
                  <Text className="text-sm font-bold text-foreground">Link graph</Text>
                  <Text className="text-xs text-muted-foreground">
                    {linkGraph.knownTopicGraph
                      ? "Topic graph already exists in database. No topic refetch required."
                      : "Topic graph not fully known yet. Opened-page staging still proceeds without refetch."}
                  </Text>
                </View>
              ) : null}

              <View className="gap-3 rounded-xl bg-card p-4">
                <Text className="text-sm font-bold text-foreground">Document</Text>
                {(document?.content ?? []).map((block: any) => {
                  if (block.type === "heading") {
                    return (
                      <View key={block.id} className="rounded-lg bg-background p-3">
                        <Text
                          style={{
                            textAlign: "right",
                            fontSize: 17,
                            fontWeight: "700",
                            color: colors.foreground,
                            writingDirection: "rtl",
                          }}
                        >
                          {block.text}
                        </Text>
                      </View>
                    );
                  }

                  if (block.type === "paragraph") {
                    return (
                      <View key={block.id} className="gap-1 rounded-lg bg-background p-3">
                        <Text className="text-[11px] font-semibold text-primary">
                          {block.id}
                        </Text>
                        <Text
                          style={{
                            textAlign: "right",
                            fontSize: 15,
                            lineHeight: 28,
                            color: colors.foreground,
                            writingDirection: "rtl",
                          }}
                        >
                          {block.text}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View key={block.id} className="gap-1 rounded-lg bg-background p-3">
                      <Text className="text-[11px] font-semibold text-primary">
                        {block.marker}
                      </Text>
                      <Text
                        style={{
                          textAlign: "right",
                          fontSize: 14,
                          lineHeight: 24,
                          color: colors.foreground,
                          writingDirection: "rtl",
                        }}
                      >
                        {block.text}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View className="gap-2 rounded-xl bg-card p-4">
                <Text className="text-sm font-bold text-foreground">Diagnostics</Text>
                {diagnostics.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">No parser diagnostics.</Text>
                ) : (
                  diagnostics.map((item, index) => (
                    <View key={`${item.code}-${index}`} className="gap-0.5">
                      <Text className="text-[11px] font-semibold text-primary">
                        {item.severity} · {item.code}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {item.message}
                      </Text>
                      {item.source ? (
                        <Text className="text-[11px] text-muted-foreground">
                          {item.source}
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeArea>
    </View>
  );
}
