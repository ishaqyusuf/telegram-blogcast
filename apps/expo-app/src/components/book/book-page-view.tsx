import { Text, TextInput, View, Pressable } from "react-native";
import { HighlightToolbar } from "./highlight-toolbar";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

type Paragraph = {
  id: number;
  pid: number;
  text: string;
  footnoteIds?: string | null;
};

type HighlightEntry = {
  localId: string;
  paragraphId: number | null;
  color: string;
  startOffset?: number | null;
  endOffset?: number | null;
  quoteText?: string | null;
};

type Props = {
  paragraphs: Paragraph[];
  highlights?: HighlightEntry[];
  onFootnotePress?: (marker: string) => void;
  onCopyParagraph?: (paragraph: Paragraph) => void;
  selectedTextRange?: {
    paragraphId: number;
    startOffset: number;
    endOffset: number;
    quoteText: string;
  } | null;
  onTextSelection?: (
    selection: {
      paragraphId: number;
      startOffset: number;
      endOffset: number;
      quoteText: string;
    } | null,
  ) => void;
  // Highlight actions
  onHighlightColor?: (paragraphId: number, color: string) => void;
  onHighlightDelete?: (localId: string) => void;
  onDismissHighlight?: () => void;
  showToolbarForParagraphId?: number | null;
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
};

function parseFootnoteIds(ids?: string | null): string[] {
  if (!ids) return [];
  return ids.split(",").map((s) => s.trim()).filter(Boolean);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveHighlightRange(text: string, highlight: HighlightEntry) {
  const startOffset = highlight.startOffset ?? null;
  const endOffset = highlight.endOffset ?? null;

  if (
    startOffset != null &&
    endOffset != null &&
    startOffset >= 0 &&
    endOffset > startOffset &&
    endOffset <= text.length
  ) {
    return { start: startOffset, end: endOffset };
  }

  const quoteText = highlight.quoteText?.trim();
  if (!quoteText) return null;

  const start = text.indexOf(quoteText);
  if (start === -1) return null;

  return { start, end: start + quoteText.length };
}

function getHighlightSegments(
  text: string,
  highlights: { start: number; end: number; color: string }[],
) {
  const boundaries = [
    0,
    text.length,
    ...highlights.flatMap((highlight) => [highlight.start, highlight.end]),
  ];
  const sorted = [...new Set(boundaries)]
    .filter((offset) => offset >= 0 && offset <= text.length)
    .sort((a, b) => a - b);

  return sorted
    .slice(0, -1)
    .map((start, index) => {
      const end = sorted[index + 1] ?? start;
      const activeHighlight = highlights
        .filter((highlight) => highlight.start <= start && highlight.end >= end)
        .at(-1);

      return {
        start,
        end,
        text: text.slice(start, end),
        color: activeHighlight?.color ?? null,
      };
    })
    .filter((segment) => segment.end > segment.start && segment.text.length > 0);
}

export function BookPageView({
  paragraphs,
  highlights = [],
  onFootnotePress,
  onCopyParagraph,
  selectedTextRange,
  onTextSelection,
  onHighlightColor,
  onHighlightDelete,
  onDismissHighlight,
  showToolbarForParagraphId,
  fontSize = 18,
  lineHeight = 32,
  textColor,
}: Props) {
  const colors = useColors();

  return (
    <View style={{ gap: 16 }}>
      {paragraphs.map((para) => {
        const footnoteIds = parseFootnoteIds(para.footnoteIds);
        const paragraphHighlights = highlights.filter((h) => h.paragraphId === para.id);
        const highlight = paragraphHighlights[0];
        const showToolbar = showToolbarForParagraphId === para.id;
        const rangeHighlights = paragraphHighlights
          .map((highlight) => {
            const range = resolveHighlightRange(para.text, highlight);
            if (!range) return null;
            return {
              start: range.start,
              end: range.end,
              color: hexToRgba(highlight.color, 0.3),
            };
          })
          .filter(
            (
              highlight,
            ): highlight is { start: number; end: number; color: string } =>
              highlight != null,
          );
        const hasParagraphFallbackHighlight =
          paragraphHighlights.length > 0 && rangeHighlights.length === 0;
        const selectedRange =
          selectedTextRange?.paragraphId === para.id ? selectedTextRange : null;
        const visibleHighlightSegments = getHighlightSegments(para.text, [
          ...rangeHighlights,
          ...(selectedRange
            ? [
                {
                  start: selectedRange.startOffset,
                  end: selectedRange.endOffset,
                  color: withAlpha(colors.primary, 0.18),
                },
              ]
            : []),
        ]);
        // Background: highlight color takes precedence over selection
        let bgColor = "transparent";
        if (hasParagraphFallbackHighlight && highlight) {
          bgColor = hexToRgba(highlight.color, 0.18);
        }

        return (
          <View key={para.id} style={{ position: "relative" }}>
            {/* Floating toolbar when this paragraph is selected */}
            {showToolbar && (
              <HighlightToolbar
                existingColor={highlight?.color ?? null}
                onCopy={() => onCopyParagraph?.(para)}
                onHighlight={() => onHighlightColor?.(para.id, "#facc15")}
                onDelete={highlight ? () => onHighlightDelete?.(highlight.localId) : undefined}
                onDismiss={() => onDismissHighlight?.()}
              />
            )}

            <View
              style={{
                backgroundColor: bgColor,
                borderRadius: 8,
                padding: 4,
                borderLeftWidth: paragraphHighlights.length > 0 ? 2 : 0,
                borderLeftColor: highlight?.color ?? "transparent",
              }}
            >
              <View style={{ position: "relative" }}>
                <Text
                  style={{
                    fontSize,
                    lineHeight,
                    color: textColor ?? colors.foreground,
                    textAlign: "right",
                    writingDirection: "rtl",
                  }}
                >
                  {visibleHighlightSegments.map((segment) => (
                    <Text
                      key={`${segment.start}:${segment.end}`}
                      style={
                        segment.color
                          ? { backgroundColor: segment.color }
                          : undefined
                      }
                    >
                      {segment.text}
                    </Text>
                  ))}
                </Text>

                <TextInput
                  value={para.text}
                  editable
                  multiline
                  scrollEnabled={false}
                  showSoftInputOnFocus={false}
                  caretHidden
                  selectionColor={withAlpha(colors.primary, 0.35)}
                  onChangeText={() => {}}
                  onSelectionChange={(event) => {
                    const { start, end } = event.nativeEvent.selection;
                    if (end <= start) {
                      onTextSelection?.(null);
                      return;
                    }

                    onTextSelection?.({
                      paragraphId: para.id,
                      startOffset: start,
                      endOffset: end,
                      quoteText: para.text.slice(start, end),
                    });
                  }}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    fontSize,
                    lineHeight,
                    color: "rgba(0,0,0,0.01)",
                    textAlign: "right",
                    writingDirection: "rtl",
                    padding: 0,
                    margin: 0,
                    backgroundColor: "transparent",
                  }}
                />
              </View>

              {footnoteIds.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  {footnoteIds.map((marker) => (
                    <Pressable
                      key={marker}
                      onPress={() => onFootnotePress?.(marker)}
                      style={{
                        backgroundColor: withAlpha(colors.primary, 0.2),
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: colors.primary }}>{marker}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
