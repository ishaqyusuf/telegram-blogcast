import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";

type Paragraph = {
  id: number;
  pid: number;
  text: string;
  footnoteIds?: string | null;
  highlights?: { id: number; startOffset: number; endOffset: number; color: string }[];
};

type Props = {
  paragraphs: Paragraph[];
  onFootnotePress?: (marker: string) => void;
  onLongPress?: (paragraph: Paragraph) => void;
  selectedParagraphId?: number | null;
};

function parseFootnoteIds(ids?: string | null): string[] {
  if (!ids) return [];
  return ids.split(",").map((s) => s.trim()).filter(Boolean);
}

export function BookPageView({
  paragraphs,
  onFootnotePress,
  onLongPress,
  selectedParagraphId,
}: Props) {
  return (
    <View style={{ gap: 16 }}>
      {paragraphs.map((para) => {
        const footnoteIds = parseFootnoteIds(para.footnoteIds);
        const isSelected = selectedParagraphId === para.id;

        return (
          <Pressable
            key={para.id}
            onLongPress={() => onLongPress?.(para)}
            style={{
              backgroundColor: isSelected ? "rgba(29,185,84,0.1)" : "transparent",
              borderRadius: 8,
              padding: 4,
            }}
          >
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 0 }}>
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
        );
      })}
    </View>
  );
}
