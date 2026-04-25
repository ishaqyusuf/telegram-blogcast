import { Text, View, Pressable } from "react-native";
import { HighlightToolbar } from "./highlight-toolbar";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import { RichContent } from "@/components/rich-content/rich-content";
import {
  createBookDocumentFromParagraphs,
  createBookHighlightAnnotations,
  type BookHighlightInput,
  type RangeAnnotation,
} from "@acme/document/book";

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
  onLongPress?: (paragraph: Paragraph) => void;
  selectedParagraphId?: number | null;
  // Highlight actions
  onHighlightColor?: (paragraphId: number, color: string) => void;
  onHighlightDelete?: (localId: string) => void;
  onDismissHighlight?: () => void;
  showToolbarForParagraphId?: number | null;
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

export function BookPageView({
  paragraphs,
  highlights = [],
  onFootnotePress,
  onLongPress,
  selectedParagraphId,
  onHighlightColor,
  onHighlightDelete,
  onDismissHighlight,
  showToolbarForParagraphId,
}: Props) {
  const colors = useColors();

  return (
    <View style={{ gap: 16 }}>
      {paragraphs.map((para) => {
        const footnoteIds = parseFootnoteIds(para.footnoteIds);
        const isSelected = selectedParagraphId === para.id;
        const paragraphHighlights = highlights.filter((h) => h.paragraphId === para.id);
        const highlight = paragraphHighlights[0];
        const showToolbar = showToolbarForParagraphId === para.id;
        const rangeHighlights = paragraphHighlights.filter((h) => resolveHighlightRange(para.text, h));
        const hasSegmentHighlight =
          paragraphHighlights.length > 0 && rangeHighlights.length !== paragraphHighlights.length;
        const annotationInputs: BookHighlightInput[] = [];
        for (const highlight of rangeHighlights) {
          const range = resolveHighlightRange(para.text, highlight);
          if (!range) continue;

          annotationInputs.push({
            id: highlight.localId,
            blockId: String(para.id),
            startOffset: range.start,
            endOffset: range.end,
            color: hexToRgba(highlight.color, 0.28),
            note: null,
            quoteText: highlight.quoteText ?? null,
          });
        }
        const annotations: RangeAnnotation[] = createBookHighlightAnnotations(annotationInputs);

        // Background: highlight color takes precedence over selection
        let bgColor = "transparent";
        if (hasSegmentHighlight && highlight) {
          bgColor = hexToRgba(highlight.color, 0.18);
        } else if (isSelected) {
          bgColor = withAlpha(colors.primary, 0.1);
        }

        return (
          <View key={para.id} style={{ position: "relative" }}>
            {/* Floating toolbar when this paragraph is selected */}
            {showToolbar && (
              <HighlightToolbar
                existingColor={highlight?.color ?? null}
                onSelectColor={(color) => onHighlightColor?.(para.id, color)}
                onDelete={highlight ? () => onHighlightDelete?.(highlight.localId) : undefined}
                onDismiss={() => onDismissHighlight?.()}
              />
            )}

            <Pressable
              onLongPress={() => onLongPress?.(para)}
              delayLongPress={250}
              style={{
                backgroundColor: bgColor,
                borderRadius: 8,
                padding: 4,
                borderLeftWidth: paragraphHighlights.length > 0 ? 2 : 0,
                borderLeftColor: highlight?.color ?? "transparent",
              }}
            >
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap" }}>
                <View style={{ flex: 1 }}>
                  <RichContent
                    document={createBookDocumentFromParagraphs([{ id: para.id, text: para.text }])}
                    annotations={annotations}
                    selectable
                    style={{
                      fontSize: 18,
                      lineHeight: 32,
                      color: colors.foreground,
                    }}
                    blockContainerStyle={{ gap: 0 }}
                  />
                </View>
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
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
