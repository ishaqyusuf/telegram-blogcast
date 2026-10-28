import { Text, View } from "react-native";

import { useColors } from "@/hooks/use-color";
import { useAudioStore } from "@/store/audio-store";

import type { BlogItem } from "./types";

import { getFeedTranscriptText } from "@/lib/feed-transcript-preview";

export function TranscriptPreview({ post }: { post: BlogItem }) {
  const colors = useColors();
  const segments = (post.audio as any)?.transcriptSegments;
  const text = useAudioStore((state) =>
    getFeedTranscriptText(post.id, Array.isArray(segments) ? segments : [], state),
  );

  if (!text) return null;

  return (
    <View
      style={{ marginBottom: 4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.muted }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontWeight: "600",
          textAlign: "right",
          writingDirection: "rtl",
          includeFontPadding: false,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
