import { Text, View } from "react-native";

import { useColors } from "@/hooks/use-color";
import { useAudioStore } from "@/store/audio-store";

import type { BlogItem } from "./types";

type FeedTranscriptSegment = {
  id?: number | string;
  startSec: number;
  endSec: number;
  text: string;
};

function getAudioSegments(post: BlogItem): FeedTranscriptSegment[] {
  const segments = (post.audio as any)?.transcriptSegments;
  return Array.isArray(segments) ? segments : [];
}

function getActiveSegment(
  segments: FeedTranscriptSegment[],
  positionSec: number,
) {
  return (
    segments.find(
      (segment) =>
        positionSec >= segment.startSec && positionSec < segment.endSec,
    ) ?? segments.find((segment) => segment.text?.trim())
  );
}

export function TranscriptPreview({ post }: { post: BlogItem }) {
  const colors = useColors();
  const loadedBlogId = useAudioStore((state) => state.blog?.id);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const positionSec = useAudioStore((state) => state.position) / 1000;
  const segments = getAudioSegments(post);
  const activeSegment = getActiveSegment(segments, positionSec);

  if (loadedBlogId !== post.id || !isPlaying || !activeSegment) return null;

  return (
    <View
      className="mb-1 rounded-lg px-3 py-2"
      style={{ backgroundColor: colors.muted }}
    >
      <Text
        className="text-xs font-semibold text-muted-foreground"
        numberOfLines={1}
        style={{
          color: colors.mutedForeground,
          textAlign: "right",
          writingDirection: "rtl",
          includeFontPadding: false,
        }}
      >
        {activeSegment.text}
      </Text>
    </View>
  );
}
