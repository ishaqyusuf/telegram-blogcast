import {
  buildRenderBlocks,
  createDocumentFromPlainText,
  type RangeAnnotation,
  type RichDocument,
  type RichMark,
} from "@acme/document/core";
import { TELEGRAM_COLORS } from "@acme/document/blog";
import { Linking, Text, type TextStyle, View, type ViewStyle } from "react-native";

type Props = {
  document?: RichDocument | null;
  text?: string | null;
  annotations?: RangeAnnotation[];
  style?: TextStyle;
  blockContainerStyle?: ViewStyle;
  textAlign?: TextStyle["textAlign"];
  writingDirection?: TextStyle["writingDirection"];
  selectable?: boolean;
  enableTelegramParsing?: boolean;
  onHashtagPress?: (tag: string) => void;
  onLinkPress?: (url: string) => void;
};

function getMarkStyle(marks: RichMark[]): TextStyle | undefined {
  if (marks.length === 0) return undefined;

  const style: TextStyle = {};
  for (const mark of marks) {
    if (mark.type === "bold") {
      style.fontWeight = "700";
    }
    if (mark.type === "italic") {
      style.fontStyle = "italic";
    }
    if (mark.type === "underline" || mark.type === "link") {
      style.textDecorationLine = "underline";
    }
    if (mark.type === "highlight") {
      style.backgroundColor = String(mark.attrs?.color ?? "#FFD70044");
    }
    if (mark.type === "link") {
      style.color = TELEGRAM_COLORS.link;
    }
    if (mark.type === "hashtag") {
      style.color = TELEGRAM_COLORS.hashtag;
    }
    if (mark.type === "timestamp") {
      style.color = TELEGRAM_COLORS.timestamp;
    }
  }

  return style;
}

function getInteractiveMark(marks: RichMark[]) {
  for (const mark of marks) {
    if (mark.type === "link" || mark.type === "hashtag") {
      return mark;
    }
  }
  return null;
}

export function RichContent({
  document,
  text,
  annotations = [],
  style,
  blockContainerStyle,
  textAlign = "right",
  writingDirection = "rtl",
  selectable = false,
  enableTelegramParsing = true,
  onHashtagPress,
  onLinkPress,
}: Props) {
  const sourceDocument = document ?? createDocumentFromPlainText(text ?? "");
  const renderBlocks = buildRenderBlocks(sourceDocument, {
    annotations,
    enableTelegramParsing,
  });

  return (
    <View style={[{ gap: 16 }, blockContainerStyle]}>
      {renderBlocks.map((block) => (
        <Text
          key={block.id}
          selectable={selectable}
          style={[
            {
              fontSize: 17,
              lineHeight: 30,
              color: "#111827",
              textAlign,
              writingDirection,
            },
            style,
          ]}
        >
          {block.runs.map((run) => {
            const interactiveMark = getInteractiveMark(run.marks);

            return (
              <Text
                key={run.key}
                style={getMarkStyle(run.marks)}
                onPress={() => {
                  if (interactiveMark?.type === "link") {
                    const href = String(interactiveMark.attrs?.href ?? run.text);
                    if (onLinkPress) {
                      onLinkPress(href);
                    } else {
                      void Linking.openURL(href);
                    }
                  }

                  if (interactiveMark?.type === "hashtag") {
                    const tag = String(interactiveMark.attrs?.tag ?? run.text.replace(/^#/, ""));
                    onHashtagPress?.(tag);
                  }
                }}
              >
                {run.text}
              </Text>
            );
          })}
        </Text>
      ))}
    </View>
  );
}
