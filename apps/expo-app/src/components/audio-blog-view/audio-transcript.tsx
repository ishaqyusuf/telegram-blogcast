import { Pressable } from "@/components/ui/pressable";
import { useMutation, useQuery } from "@/lib/react-query";
import { Modal, PanResponder, Text, TextInput, View } from "react-native";
import { useEffect, useRef, useState } from "react";

import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { useAudioStore } from "@/store/audio-store";
import { useColors } from "@/hooks/use-color";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseMmSs(str: string): number {
  const [mm, ss] = str.split(":").map(Number);
  return (mm || 0) * 60 + (ss || 0);
}

// ── Provider config ───────────────────────────────────────────────────────────

type Provider = "openai" | "groq";

const PROVIDERS: { id: Provider; label: string; costPerMin: number }[] = [
  { id: "openai", label: "OpenAI Whisper", costPerMin: 0.006 },
  { id: "groq", label: "Groq Whisper", costPerMin: 0 },
];

function formatCost(durationSec: number, costPerMin: number) {
  const cost = (durationSec / 60) * costPerMin;
  if (cost === 0) return "Free";
  return `~$${cost.toFixed(4)}`;
}

// ── Provider picker sheet ─────────────────────────────────────────────────────

function ProviderSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: Provider;
  onSelect: (p: Provider) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            gap: 4,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              backgroundColor: colors.muted,
              borderRadius: 2,
              alignSelf: "center",
              marginBottom: 12,
            }}
          />
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.foreground,
              marginBottom: 8,
            }}
          >
            Select AI Provider
          </Text>
          {PROVIDERS.map((p) => {
            const isSelected = p.id === selected;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  onSelect(p.id);
                  onClose();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: isSelected
                    ? colors.primary + "22"
                    : "transparent",
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    {p.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {p.costPerMin === 0 ? "Free" : `$${p.costPerMin}/min`}
                  </Text>
                </View>
                {isSelected && (
                  <Icon
                    name="CheckCircle2"
                    size={20}
                    className="text-primary"
                  />
                )}
              </Pressable>
            );
          })}
          <View style={{ height: 12 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Dual seek bar ─────────────────────────────────────────────────────────────

function DualSeekBar({
  fromSec,
  toSec,
  maxSec,
  onFromChange,
  onToChange,
}: {
  fromSec: number;
  toSec: number;
  maxSec: number;
  onFromChange: (sec: number) => void;
  onToChange: (sec: number) => void;
}) {
  const colors = useColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const THUMB = 20;

  // Refs to avoid stale closures in PanResponder
  const trackWidthRef = useRef(0);
  const fromSecRef = useRef(fromSec);
  const toSecRef = useRef(toSec);
  const maxSecRef = useRef(maxSec);
  const onFromRef = useRef(onFromChange);
  const onToRef = useRef(onToChange);
  const activeThumb = useRef<"from" | "to" | null>(null);

  useEffect(() => {
    fromSecRef.current = fromSec;
  }, [fromSec]);
  useEffect(() => {
    toSecRef.current = toSec;
  }, [toSec]);
  useEffect(() => {
    maxSecRef.current = maxSec;
  }, [maxSec]);
  useEffect(() => {
    onFromRef.current = onFromChange;
  }, [onFromChange]);
  useEffect(() => {
    onToRef.current = onToChange;
  }, [onToChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const w = trackWidthRef.current;
        const max = maxSecRef.current;
        if (!w || !max) return;
        const fromX = (fromSecRef.current / max) * w;
        const toX = (toSecRef.current / max) * w;
        activeThumb.current =
          Math.abs(x - fromX) <= Math.abs(x - toX) ? "from" : "to";
        const sec = Math.round((x / w) * max);
        if (activeThumb.current === "from") {
          const newFrom = Math.max(0, Math.min(sec, toSecRef.current - 1));
          fromSecRef.current = newFrom;
          onFromRef.current(newFrom);
        } else {
          const newTo = Math.max(fromSecRef.current + 1, Math.min(sec, max));
          toSecRef.current = newTo;
          onToRef.current(newTo);
        }
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const w = trackWidthRef.current;
        const max = maxSecRef.current;
        if (!w || !max || !activeThumb.current) return;
        const sec = Math.round((x / w) * max);
        if (activeThumb.current === "from") {
          const newFrom = Math.max(0, Math.min(sec, toSecRef.current - 1));
          fromSecRef.current = newFrom;
          onFromRef.current(newFrom);
        } else {
          const newTo = Math.max(fromSecRef.current + 1, Math.min(sec, max));
          toSecRef.current = newTo;
          onToRef.current(newTo);
        }
      },
      onPanResponderRelease: () => {
        activeThumb.current = null;
      },
    }),
  ).current;

  const fromX =
    maxSec > 0 && trackWidth > 0 ? (fromSec / maxSec) * trackWidth : 0;
  const toX =
    maxSec > 0 && trackWidth > 0 ? (toSec / maxSec) * trackWidth : trackWidth;

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{ height: 44, justifyContent: "center" }}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
          setTrackWidth(e.nativeEvent.layout.width);
        }}
        {...panResponder.panHandlers}
      >
        {/* Track background */}
        <View
          style={{ height: 4, backgroundColor: colors.muted, borderRadius: 2 }}
        />
        {/* Active range highlight */}
        <View
          style={{
            position: "absolute",
            left: fromX,
            width: Math.max(0, toX - fromX),
            height: 4,
            backgroundColor: colors.primary,
            borderRadius: 2,
          }}
        />
        {trackWidth > 0 && (
          <>
            {/* From thumb */}
            <View
              style={{
                position: "absolute",
                left: Math.max(0, fromX - THUMB / 2),
                width: THUMB,
                height: THUMB,
                borderRadius: THUMB / 2,
                backgroundColor: colors.background,
                borderWidth: 2.5,
                borderColor: colors.primary,
              }}
            />
            {/* To thumb */}
            <View
              style={{
                position: "absolute",
                left: Math.min(trackWidth - THUMB, toX - THUMB / 2),
                width: THUMB,
                height: THUMB,
                borderRadius: THUMB / 2,
                backgroundColor: colors.primary,
              }}
            />
          </>
        )}
      </View>
      {/* Time labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}
        >
          {formatSec(fromSec)}
        </Text>
        <Text
          style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}
        >
          {formatSec(toSec)}
        </Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AudioTranscriptProps {
  mediaId: number;
  telegramFileId?: string;
}

export function AudioTranscript({
  mediaId,
  telegramFileId,
}: AudioTranscriptProps) {
  const colors = useColors();
  const positionSec = useAudioStore((s) => s.position) / 1000;
  const durationMs = useAudioStore((s) => s.duration);
  const seek = useAudioStore((s) => s.seek);

  const durationSec = Math.floor(durationMs / 1000);

  const [provider, setProvider] = useState<Provider>("openai");
  const [providerSheetVisible, setProviderSheetVisible] = useState(false);
  const [fromStr, setFromStr] = useState("00:00");
  const [toStr, setToStr] = useState(() => formatSec(durationSec || 300));

  const fromSec = parseMmSs(fromStr);
  const toSec = parseMmSs(toStr);
  const rangeSec = Math.max(0, toSec - fromSec);
  const providerConfig = PROVIDERS.find((p) => p.id === provider)!;

  const { data: transcript, refetch } = useQuery(
    _trpc.blog.getTranscript.queryOptions({ mediaId }),
  );

  const { mutate: startTranscribe, isPending: isTranscribing } = useMutation(
    _trpc.blog.transcribeRange.mutationOptions({
      onSuccess() {
        refetch();
      },
    }),
  );

  // ── No transcript yet ───────────────────────────────────────────────────────
  if (!transcript || transcript.status === "failed") {
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
            No transcript yet
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.mutedForeground,
              textAlign: "center",
            }}
          >
            Select a range and provider, then generate a transcript to read
            along.
          </Text>
        </View>

        {/* Range seek bar */}
        <View style={{ width: "100%", gap: 10 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.mutedForeground,
              textAlign: "center",
            }}
          >
            Transcribe range
          </Text>
          <DualSeekBar
            fromSec={fromSec}
            toSec={toSec}
            maxSec={durationSec || 300}
            onFromChange={(sec) => setFromStr(formatSec(sec))}
            onToChange={(sec) => setToStr(formatSec(sec))}
          />
          {/* Fine-tune inputs */}
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
                onChangeText={setToStr}
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
        </View>

        {/* Provider selector */}
        <Pressable
          onPress={() => setProviderSheetVisible(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.muted,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="Sparkles" size={16} className="text-primary" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: colors.foreground,
              }}
            >
              {providerConfig.label}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
                {formatCost(rangeSec, providerConfig.costPerMin)}
              </Text>
            </View>
            <Icon
              name="ChevronRight"
              size={16}
              className="text-muted-foreground"
            />
          </View>
        </Pressable>

        {/* Transcribe button */}
        <Pressable
          onPress={() => {
            if (!telegramFileId) return;
            startTranscribe({
              fileId: telegramFileId,
              fromSec,
              toSec,
              provider,
            });
          }}
          disabled={isTranscribing || !telegramFileId || rangeSec <= 0}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: colors.primary,
            opacity:
              isTranscribing || !telegramFileId || rangeSec <= 0 ? 0.4 : 1,
            width: "100%",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.primaryForeground,
            }}
          >
            {isTranscribing ? "Transcribing…" : "Transcribe Audio"}
          </Text>
        </Pressable>

        <ProviderSheet
          visible={providerSheetVisible}
          selected={provider}
          onSelect={setProvider}
          onClose={() => setProviderSheetVisible(false)}
        />
      </View>
    );
  }

  // ── In progress ─────────────────────────────────────────────────────────────
  if (transcript.status === "processing" || transcript.status === "pending") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          paddingVertical: 48,
        }}
      >
        <Icon name="Loader" size={28} className="text-primary" />
        <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
          Transcribing…
        </Text>
      </View>
    );
  }

  // ── Done — show segments ───────────────────────────────────────────────────
  const segments = transcript.segments ?? [];
  const activeIdx = segments.findIndex(
    (s) => positionSec >= s.startSec && positionSec < s.endSec,
  );

  return (
    <View style={{ gap: 4, paddingHorizontal: 16, paddingVertical: 12 }}>
      {segments.length ? (
        segments.map((seg, index) => {
          const isActive = index === activeIdx;
          return (
            <Pressable
              key={seg.id}
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
              {/* Timestamp badge */}
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
              {/* Text */}
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
        })
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
            Transcript is empty
          </Text>
        </View>
      )}
    </View>
  );
}
