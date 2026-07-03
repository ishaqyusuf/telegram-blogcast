import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";
import { useAudioStore } from "@/store/audio-store";
import { useColors } from "@/hooks/use-color";
import { useRef } from "react";
import type {
  TranscriptSegmentData,
  TranscriptWordData,
} from "@/components/audio-blog-view/transcript-timing";

export type { TranscriptSegmentData, TranscriptWordData };

export function getTranscriptSegmentKey(
  segment: TranscriptSegmentData,
  index: number,
) {
  return [
    segment.id ?? "segment",
    index,
    segment.startSec,
    segment.endSec,
  ].join(":");
}

function formatSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface TranscriptSegmentsProps {
  segments: TranscriptSegmentData[];
}

export function TranscriptSegments({ segments }: TranscriptSegmentsProps) {
  const colors = useColors();
  const positionSec = useAudioStore((s) => s.position) / 1000;
  const seek = useAudioStore((s) => s.seek);
  const play = useAudioStore((s) => s.play);
  const lastTapRef = useRef<{ key: string; at: number } | null>(null);

  const activeIdx = segments.findIndex(
    (s) => positionSec >= s.startSec && positionSec < s.endSec,
  );

  if (!segments.length) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
          Transcript is empty
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 4, paddingHorizontal: 16, paddingVertical: 12 }}>
      {segments.map((seg, index) => {
        const isActive = index === activeIdx;
        return (
          <Pressable
            key={getTranscriptSegmentKey(seg, index)}
            onPress={() => {
              const key = getTranscriptSegmentKey(seg, index);
              const now = Date.now();
              const lastTap = lastTapRef.current;
              lastTapRef.current = { key, at: now };
              const shouldPlay = lastTap?.key === key && now - lastTap.at < 320;
              seek(seg.startSec * 1000)
                .then(() => {
                  if (shouldPlay) return play();
                })
                .catch(() => undefined);
            }}
            style={{
              flexDirection: "row",
              gap: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: isActive ? colors.primary + "26" : "transparent",
            }}
          >
            <View
              style={{
                flexShrink: 0,
                marginTop: 2,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: isActive ? colors.primary : colors.muted,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: isActive
                    ? colors.primaryForeground
                    : colors.mutedForeground,
                }}
              >
                {formatSec(seg.startSec)}
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                lineHeight: 22,
                textAlign: "right",
                writingDirection: "rtl",
                color: isActive ? colors.foreground : colors.mutedForeground,
                fontWeight: isActive ? "500" : "400",
              }}
            >
              {seg.words?.length
                ? seg.words.map((word, wordIndex) => {
                    const wordActive =
                      positionSec >= word.startSec && positionSec < word.endSec;
                    return (
                      <Text
                        key={`${word.startSec}-${wordIndex}`}
                        style={{
                          backgroundColor: wordActive
                            ? colors.primary
                            : "transparent",
                          color: wordActive
                            ? colors.primaryForeground
                            : isActive
                              ? colors.foreground
                              : colors.mutedForeground,
                          borderRadius: 4,
                          fontWeight: wordActive ? "800" : undefined,
                        }}
                      >
                        {word.word}{" "}
                      </Text>
                    );
                  })
                : seg.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
