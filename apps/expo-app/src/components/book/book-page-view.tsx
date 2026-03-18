import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";
import { HighlightToolbar } from "./highlight-toolbar";

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
  return (
    <View style={{ gap: 16 }}>
      {paragraphs.map((para) => {
        const footnoteIds = parseFootnoteIds(para.footnoteIds);
        const isSelected = selectedParagraphId === para.id;
        const highlight = highlights.find((h) => h.paragraphId === para.id);
        const showToolbar = showToolbarForParagraphId === para.id;

        // Background: highlight color takes precedence over selection
        let bgColor = "transparent";
        if (highlight) {
          bgColor = hexToRgba(highlight.color, 0.18);
        } else if (isSelected) {
          bgColor = "rgba(29,185,84,0.1)";
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
              style={{
                backgroundColor: bgColor,
                borderRadius: 8,
                padding: 4,
                borderLeftWidth: highlight ? 2 : 0,
                borderLeftColor: highlight?.color ?? "transparent",
              }}
            >
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap" }}>
                <Text
                  style={{
                    fontSize: 18,
                    lineHeight: 32,
                    color: "#e8e8e8",
                    writingDirection: "rtl",
                    textAlign: "right",
                    flex: 1,
                  }}
                >
                  {para.text}
                </Text>
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
                        backgroundColor: "rgba(29,185,84,0.2)",
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: "#1DB954" }}>{marker}</Text>
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
