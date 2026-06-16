import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";
import { useAudioStore } from "@/store/audio-store";
import { useColors } from "@/hooks/use-color";

export interface TranscriptSegmentData {
  startSec: number;
  endSec: number;
  text: string;
  id?: number | string;
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
            key={seg.id ?? index}
            onPress={() => seek(seg.startSec * 1000)}
            style={{
              flexDirection: "row",
              gap: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: isActive
                ? colors.primary + "26"
                : "transparent",
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
              {seg.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
