import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranslation } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { withAlpha } from "@/lib/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

type StagedPreviewDocument = {
  context?: {
    currentTopic?: { label?: string | null } | null;
    breadcrumb?: { role?: string | null; label?: string | null }[];
  } | null;
  content?: Record<string, any>[];
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
      severity: typeof record.severity === "string" ? record.severity : "info",
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

function shouldShowBlockMarker(marker: unknown) {
  return typeof marker === "string" && !marker.toLowerCase().startsWith("p-");
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
  const facts = asJsonObject(data?.facts);
  const tocFacts = asJsonObject(facts?.toc);
  const isPromoted = data?.status === "promoted";
  const previewBlockStyle = {
    backgroundColor: colors.background,
    borderColor: withAlpha(colors.border, 0.75),
  };
  const { mutate: promotePage, isPending: isPromoting } = useMutation(
    _trpc.book.promoteStagedShamelaPageParse.mutationOptions({
      onSuccess: (result) => {
        qc.invalidateQueries({ queryKey: _trpc.book.getBooks.queryKey() });
        qc.invalidateQueries({
          queryKey: _trpc.book.getBook.queryKey({ id: result.bookId }),
        });
        router.replace(
          `/books/${result.bookId}/reader/${result.page.id}` as any,
        );
      },
      onError: (error) => Alert.alert("Import failed", error.message),
    }),
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeArea>
        <View
          className="items-center gap-3 border-b border-border px-4 py-3"
          style={{
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            flexDirection: isRtl ? "row-reverse" : "row",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            className="size-9 items-center justify-center rounded-full bg-card"
            style={{ backgroundColor: colors.card }}
          >
            <Icon name="ChevronLeft" size={22} color={colors.foreground} />
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

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        >
          {isLoading || !data ? (
            <View
              className="rounded-xl p-4"
              style={{ backgroundColor: colors.card }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                Loading staged parse...
              </Text>
            </View>
          ) : (
            <>
              <View
                className="gap-2 rounded-xl p-4"
                style={{ backgroundColor: colors.card }}
              >
                <Text
                  style={{
                    color: colors.cardForeground,
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  {document?.context?.currentTopic?.label ||
                    data.chapterTitle ||
                    data.rawPage.title ||
                    "Untitled page"}
                </Text>
                {data.topicTitle ? (
                  <Text style={{ color: colors.primary, fontSize: 14 }}>
                    {data.topicTitle}
                  </Text>
                ) : null}
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  Shamela page {data.shamelaPageNo ?? "unknown"} · printed{" "}
                  {data.printedPageNo ?? "unknown"} · volume{" "}
                  {data.volumeNumber ?? "unknown"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {data.rawPage.finalUrl}
                </Text>
                {typeof tocFacts?.topLevelCount === "number" ||
                typeof tocFacts?.linkCount === "number" ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    TOC: {tocFacts.topLevelCount ?? 0} sections ·{" "}
                    {tocFacts.linkCount ?? 0} links
                  </Text>
                ) : null}
                <Pressable
                  disabled={isPromoting}
                  onPress={() => promotePage({ stagedParseId: stagedId })}
                  className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
                  style={{
                    backgroundColor: colors.primary,
                    opacity: isPromoting ? 0.65 : 1,
                  }}
                >
                  {isPromoting ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primaryForeground}
                    />
                  ) : (
                    <Icon
                      name="Download"
                      size={17}
                      color={colors.primaryForeground}
                    />
                  )}
                  <Text
                    style={{
                      color: colors.primaryForeground,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
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
                <View
                  className="gap-3 rounded-xl p-4"
                  style={{ backgroundColor: colors.card }}
                >
                  <Text
                    style={{
                      color: colors.cardForeground,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    Breadcrumb
                  </Text>
                  {document.context.breadcrumb.map(
                    (item: any, index: number) => (
                      <Text
                        key={`${item.label}-${index}`}
                        style={{ color: colors.mutedForeground, fontSize: 12 }}
                      >
                        {item.role} · {item.label}
                      </Text>
                    ),
                  )}
                </View>
              ) : null}

              {linkGraph ? (
                <View
                  className="gap-2 rounded-xl p-4"
                  style={{ backgroundColor: colors.card }}
                >
                  <Text
                    style={{
                      color: colors.cardForeground,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    Link graph
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 12,
                      lineHeight: 18,
                    }}
                  >
                    {linkGraph.knownTopicGraph
                      ? "Topic graph already exists in database. No topic refetch required."
                      : "Topic graph not fully known yet. Opened-page staging still proceeds without refetch."}
                  </Text>
                </View>
              ) : null}

              <View
                className="gap-3 rounded-xl p-4"
                style={{ backgroundColor: colors.card }}
              >
                <Text
                  style={{
                    color: colors.cardForeground,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  Document
                </Text>
                {(document?.content ?? []).map((block: any) => {
                  if (block.type === "heading") {
                    return (
                      <View
                        key={block.id}
                        className="rounded-lg border p-3"
                        style={previewBlockStyle}
                      >
                        <Text
                          style={{
                            textAlign: "right",
                            fontSize: 17,
                            fontWeight: "700",
                            color: colors.foreground,
                            writingDirection: "rtl",
                            lineHeight: 28,
                          }}
                        >
                          {block.text}
                        </Text>
                      </View>
                    );
                  }

                  if (block.type === "paragraph") {
                    return (
                      <Text
                        key={block.id}
                        style={{
                          textAlign: "right",
                          fontSize: 16,
                          lineHeight: 31,
                          color: colors.foreground,
                          writingDirection: "rtl",
                          marginBottom: 8,
                        }}
                      >
                        {block.text}
                      </Text>
                    );
                  }

                  return (
                    <View
                      key={block.id}
                      className="gap-2 rounded-lg border p-3"
                      style={previewBlockStyle}
                    >
                      {shouldShowBlockMarker(block.marker) ? (
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {block.marker}
                        </Text>
                      ) : null}
                      <Text
                        style={{
                          textAlign: "right",
                          fontSize: 14,
                          lineHeight: 26,
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

              <View
                className="gap-2 rounded-xl p-4"
                style={{ backgroundColor: colors.card }}
              >
                <Text
                  style={{
                    color: colors.cardForeground,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  Diagnostics
                </Text>
                {diagnostics.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                    No parser diagnostics.
                  </Text>
                ) : (
                  diagnostics.map((item, index) => (
                    <View key={`${item.code}-${index}`} className="gap-0.5">
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {item.severity} · {item.code}
                      </Text>
                      <Text
                        style={{ color: colors.mutedForeground, fontSize: 12 }}
                      >
                        {item.message}
                      </Text>
                      {item.source ? (
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontSize: 11,
                          }}
                        >
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
