import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Text, TextInput, View } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalTranscription } from "@/hooks/use-local-transcription";
import {
  TranscriptSegments,
  type TranscriptSegmentData,
} from "@/components/audio-blog-view/transcript-segments";
import { useAudioStore } from "@/store/audio-store";
import { useColors } from "@/hooks/use-color";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { checkTranscriberHealth, getDefaultTranscriberUrl } from "@/lib/transcribe";
import { _trpc } from "@/components/static-trpc";
import { useMutation, useQueryClient } from "@/lib/react-query";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";

function formatSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseMmSs(str: string): number {
  const [mm, ss] = str.split(":").map(Number);
  return (mm || 0) * 60 + (ss || 0);
}

function getReachableAudioUrl(...candidates: (string | null | undefined)[]) {
  return candidates.find((candidate) => {
    if (!candidate) return false;
    return candidate.startsWith("http://") || candidate.startsWith("https://");
  }) ?? null;
}

interface LocalTranscribeProps {
  mediaId: number;
  telegramFileId?: string;
  audioUrl?: string | null;
}

export function LocalTranscribe({
  mediaId,
  telegramFileId,
  audioUrl: remoteAudioUrl,
}: LocalTranscribeProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const durationMs = useAudioStore((s) => s.duration);
  const uri = useAudioStore((s) => s.uri);
  const localTranscriberBaseUrl = useAppSettingsStore((s) => s.localTranscriberBaseUrl);
  const transcriberUrl = getDefaultTranscriberUrl(localTranscriberBaseUrl);
  const {
    jobs,
    queuedCount,
    enqueue,
    runQueued,
    isRunning: isRunningQueue,
  } = useTranscriptionQueue(mediaId);

  const durationSec = Math.floor(durationMs / 1000);

  const [fromStr, setFromStr] = useState("00:00");
  const [toStr, setToStr] = useState(() => formatSec(durationSec || 300));
  const toStrTouchedRef = useRef(false);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);

  const { isTranscribing, result, error, transcribe, reset, setError } =
    useLocalTranscription();
  const saveTranscript = useMutation(
    _trpc.blog.saveTranscript.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(_trpc.blog.getTranscript.queryOptions({ mediaId }));
      },
    }),
  );

  const fromSec = parseMmSs(fromStr);
  const toSec = parseMmSs(toStr);

  useEffect(() => {
    if (durationSec <= 0 || toStrTouchedRef.current) return;
    setToStr(formatSec(durationSec));
  }, [durationSec]);

  const mappedSegments: TranscriptSegmentData[] = useMemo(() => {
    if (!result?.segments) return [];
    return result.segments.map((seg, i) => ({
      startSec: seg.start,
      endSec: seg.end,
      text: seg.text,
      id: i,
    }));
  }, [result]);
  const reachableAudioUrl = getReachableAudioUrl(remoteAudioUrl, uri);
  const hasQueueableAudioSource = Boolean(reachableAudioUrl || telegramFileId);

  const queueCurrentRange = useCallback(async () => {
    setQueueMessage(null);
    if (!hasQueueableAudioSource) {
      setError(
        "No remote audio source is available to queue. Use audio with a web URL or Telegram file ID.",
      );
      return;
    }

    let queueAudioUrl = reachableAudioUrl;
    if (!queueAudioUrl && telegramFileId) {
      setResolvingUrl(true);
      try {
        const resolved = await getTelegramFileUrl(telegramFileId);
        queueAudioUrl = getReachableAudioUrl(resolved?.url);
      } finally {
        setResolvingUrl(false);
      }
    }

    if (!queueAudioUrl) {
      setError("Could not resolve a reachable audio URL for this queued job.");
      return;
    }

    try {
      await enqueue({
        mediaId,
        telegramFileId,
        audioUrl: queueAudioUrl,
        fromSec: fromSec > 0 ? fromSec : null,
        toSec: toSec < durationSec ? toSec : null,
        language: "ar",
        transcriberUrl,
      });
      setError(null);
      setQueueMessage(
        "Added to transcription queue. The local service will process it when online.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not add this range to the transcription queue.",
      );
    }
  }, [
    durationSec,
    enqueue,
    fromSec,
    hasQueueableAudioSource,
    mediaId,
    reachableAudioUrl,
    setError,
    telegramFileId,
    toSec,
    transcriberUrl,
  ]);

  const handleTranscribe = useCallback(async () => {
    reset();
    setQueueMessage(null);
    setResolvingUrl(true);

    let audioUrl: string | undefined | null = reachableAudioUrl;

    try {
      await checkTranscriberHealth(transcriberUrl);
    } catch (err) {
      setResolvingUrl(false);
      setError(
        `${
          err instanceof Error ? err.message : "Local transcriber is not reachable."
        } You can add this range to the queue and run it later.`,
      );
      return;
    }

    if (!audioUrl && telegramFileId) {
      try {
        const resolved = await getTelegramFileUrl(telegramFileId);
        audioUrl = resolved?.url;
      } catch {
        // fall through
      }
    }

    setResolvingUrl(false);

    if (!audioUrl) {
      setError(
        "No audio URL available. Start playback first, or ensure the audio file is accessible.",
      );
      return;
    }

    const transcription = await transcribe(
      {
        audioUrl,
        from: fromSec > 0 ? fromSec : undefined,
        to: toSec < durationSec ? toSec : undefined,
        language: "ar",
      },
      transcriberUrl,
    );
    if (transcription?.segments?.length) {
      saveTranscript.mutate({
        mediaId,
        segments: transcription.segments.map((segment) => ({
          startSec: segment.start,
          endSec: segment.end,
          text: segment.text,
        })),
      });
    }
  }, [
    reachableAudioUrl,
    telegramFileId,
    fromSec,
    toSec,
    durationSec,
    transcribe,
    reset,
    setError,
    saveTranscript,
    mediaId,
    transcriberUrl,
  ]);

  const rangeSec = Math.max(0, toSec - fromSec);
  const isBusy = isTranscribing || resolvingUrl || isRunningQueue;
  const failedQueueJobs = jobs.filter((job) => job.status === "failed");

  // ── Result view ───────────────────────────────────────────────────────────────

  if (result) {
    return (
      <View style={{ gap: 8, paddingVertical: 12 }}>
        {/* Info bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                backgroundColor: colors.primary + "22",
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: colors.primary,
                }}
              >
                MLX Whisper
              </Text>
            </View>
            <Text
              style={{ fontSize: 11, color: colors.mutedForeground }}
            >
              {result.cached ? "cached" : `${result.processingSeconds}s`}
            </Text>
          </View>
          <Pressable
            onPress={reset}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: colors.muted,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              Transcribe again
            </Text>
          </Pressable>
        </View>

        <TranscriptSegments segments={mappedSegments} />
      </View>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────────

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        paddingVertical: 48,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="FileText" size={28} className="text-muted-foreground" />
      </View>

      <View style={{ alignItems: "center", gap: 4 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: colors.foreground,
          }}
        >
          Local Transcription
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.mutedForeground,
            textAlign: "center",
          }}
        >
          Transcribe this audio locally using MLX Whisper on your Mac.
          Requires the transcriber service to be running on your LAN.
        </Text>
      </View>

      {/* Range inputs */}
      <View style={{ width: "100%", gap: 10 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: colors.mutedForeground,
            textAlign: "center",
          }}
        >
          Transcribe range (optional)
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              From
            </Text>
            <TextInput
              value={fromStr}
              onChangeText={setFromStr}
              placeholder="00:00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              style={{
                backgroundColor: colors.muted,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
                fontSize: 15,
                color: colors.foreground,
                textAlign: "center",
                width: 80,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 16,
              color: colors.mutedForeground,
              marginTop: 16,
            }}
          >
            →
          </Text>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              To
            </Text>
            <TextInput
              value={toStr}
              onChangeText={(value) => {
                toStrTouchedRef.current = true;
                setToStr(value);
              }}
              placeholder="05:00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              style={{
                backgroundColor: colors.muted,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
                fontSize: 15,
                color: colors.foreground,
                textAlign: "center",
                width: 80,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          </View>
        </View>
        {durationSec > 0 && (
          <Text
            style={{
              fontSize: 11,
              color: colors.mutedForeground,
              textAlign: "center",
            }}
          >
            Range: {formatSec(fromSec)} – {formatSec(toSec)} (total audio:{" "}
            {formatSec(durationSec)})
          </Text>
        )}
      </View>

      {/* Error */}
      {error && (
        <View
          style={{
            width: "100%",
            padding: 12,
            backgroundColor: colors.muted,
            borderRadius: 10,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: colors.destructive,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
        </View>
      )}

      {queueMessage ? (
        <View
          style={{
            width: "100%",
            padding: 12,
            backgroundColor: colors.muted,
            borderRadius: 10,
          }}
        >
          <Text
            style={{ fontSize: 13, color: colors.foreground, textAlign: "center" }}
          >
            {queueMessage}
          </Text>
        </View>
      ) : null}

      {queuedCount > 0 && (
        <Pressable
          onPress={() => {
            runQueued()
              .then(() => {
                queryClient.invalidateQueries(
                  _trpc.blog.getTranscript.queryOptions({ mediaId }),
                );
              })
              .catch((error) => {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Queued transcription failed.",
                );
              });
          }}
          disabled={isBusy}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 11,
            borderRadius: 999,
            backgroundColor: colors.muted,
            opacity: isBusy ? 0.5 : 1,
            width: "100%",
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Icon name="ListOrdered" size={16} className="text-primary" />
          <Text
            style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}
          >
            {isRunningQueue
              ? "Refreshing queue..."
              : `Refresh queue (${queuedCount})`}
          </Text>
        </Pressable>
      )}
      {failedQueueJobs.length > 0 ? (
        <Text
          style={{ fontSize: 12, color: colors.destructive, textAlign: "center" }}
        >
          {failedQueueJobs.length} queued transcription failed. Check the local service and refresh.
        </Text>
      ) : null}

      <Pressable
        onPress={queueCurrentRange}
        disabled={!hasQueueableAudioSource || isBusy || rangeSec <= 0}
        style={{
          paddingHorizontal: 18,
          paddingVertical: 11,
          borderRadius: 999,
          backgroundColor: colors.muted,
          opacity:
            !hasQueueableAudioSource || isBusy || rangeSec <= 0 ? 0.45 : 1,
          width: "100%",
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Icon name="ListOrdered" size={16} className="text-primary" />
        <Text
          style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}
        >
          Add range to queue
        </Text>
      </Pressable>

      {/* Transcribe button */}
      <Pressable
        onPress={handleTranscribe}
        disabled={isBusy || rangeSec <= 0}
        style={{
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: colors.primary,
          opacity: isBusy || rangeSec <= 0 ? 0.4 : 1,
          width: "100%",
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {isTranscribing && (
          <Icon name="Loader" size={16} color={colors.primaryForeground} />
        )}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: colors.primaryForeground,
          }}
        >
          {isBusy ? "Transcribing…" : "Transcribe Locally"}
        </Text>
      </Pressable>
    </View>
  );
}
