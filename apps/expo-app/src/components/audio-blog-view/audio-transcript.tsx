import { useMutation, useQuery } from "@/lib/react-query";
import { useRef } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useAudioStore } from "@/store/audio-store";

function formatSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface AudioTranscriptProps {
  mediaId: number;
  telegramFileId?: string;
}

export function AudioTranscript({ mediaId, telegramFileId }: AudioTranscriptProps) {
  const flatListRef = useRef<FlatList>(null);
  const positionSec = useAudioStore((s) => s.position) / 1000;
  const seek = useAudioStore((s) => s.seek);

  const { data: transcript, refetch } = useQuery(
    _trpc.blog.getTranscript.queryOptions({ mediaId })
  );

  const { mutate: startTranscribe, isPending: isTranscribing } = useMutation(
    _trpc.blog.transcribeRange.mutationOptions({
      onSuccess() {
        refetch();
      },
    })
  );

  // ── No transcript yet ─────────────────────────────────────────────────────
  if (!transcript || transcript.status === "failed") {
    return (
      <View className="flex-1 items-center justify-center gap-4 py-12 px-6">
        <View className="size-16 rounded-full bg-muted items-center justify-center">
          <Icon name="FileText" size={28} className="text-muted-foreground" />
        </View>
        <View className="items-center gap-1">
          <Text className="text-base font-bold text-foreground">
            No transcript yet
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            Generate a transcript to read along with the audio
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (!telegramFileId) return;
            startTranscribe({
              fileId: telegramFileId,
              fromSec: 0,
              toSec: 600,
              provider: "openai",
            });
          }}
          disabled={isTranscribing || !telegramFileId}
          className="px-6 py-3 rounded-full bg-primary active:opacity-80 disabled:opacity-40"
        >
          <Text className="text-sm font-bold text-primary-foreground">
            {isTranscribing ? "Transcribing…" : "Transcribe Audio"}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── In progress ───────────────────────────────────────────────────────────
  if (transcript.status === "processing" || transcript.status === "pending") {
    return (
      <View className="flex-1 items-center justify-center gap-3 py-12">
        <Icon name="Loader" size={28} className="text-primary" />
        <Text className="text-sm text-muted-foreground">Transcribing…</Text>
      </View>
    );
  }

  // ── Done — show segments ──────────────────────────────────────────────────
  const segments = transcript.segments ?? [];
  const activeIdx = segments.findIndex(
    (s) => positionSec >= s.startSec && positionSec < s.endSec
  );

  return (
    <FlatList
      ref={flatListRef}
      data={segments}
      keyExtractor={(s) => String(s.id)}
      contentContainerClassName="px-4 py-3 gap-1"
      renderItem={({ item: seg, index }) => {
        const isActive = index === activeIdx;
        return (
          <Pressable
            onPress={() => seek(seg.startSec * 1000)}
            className={`flex-row gap-3 px-3 py-2.5 rounded-xl active:opacity-70 ${
              isActive ? "bg-primary/15" : ""
            }`}
          >
            {/* Timestamp badge */}
            <View
              className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded-md ${
                isActive ? "bg-primary" : "bg-muted"
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {formatSec(seg.startSec)}
              </Text>
            </View>
            {/* Text */}
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                lineHeight: 22,
                textAlign: "right",
                writingDirection: "rtl",
                color: isActive ? "#ffffff" : "#b3b3b3",
                fontWeight: isActive ? "500" : "400",
              }}
            >
              {seg.text}
            </Text>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View className="items-center py-10">
          <Text className="text-sm text-muted-foreground">
            Transcript is empty
          </Text>
        </View>
      }
    />
  );
}
