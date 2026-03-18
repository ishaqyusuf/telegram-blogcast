import { useAudioStore } from "@/store/audio-store";
import { useColors } from "@/hooks/use-color";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SkipBack5Icon, SkipForward5Icon } from "./skip-icons";
import { Disc3, Pause, Play } from "lucide-react-native";

function formatSleepRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function GlobalAudioBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const colors = useColors();

  const sound = useAudioStore((s) => s.sound);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const blog = useAudioStore((s) => s.blog);
  const position = useAudioStore((s) => s.position);
  const duration = useAudioStore((s) => s.duration);
  const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
  const seek = useAudioStore((s) => s.seek);
  const sleepTimerEnd = useAudioStore((s) => s.sleepTimerEnd);
  const clearSleepTimer = useAudioStore((s) => s.clearSleepTimer);
  const pause = useAudioStore((s) => s.pause);

  // ── Sleep timer countdown + enforcement ────────────────────────────────────
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!sleepTimerEnd) {
      setSleepRemaining(null);
      return;
    }
    const tick = () => {
      const remaining = sleepTimerEnd - Date.now();
      if (remaining <= 0) {
        setSleepRemaining(null);
        clearSleepTimer();
        pause();
      } else {
        setSleepRemaining(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEnd]);

  // ── Spinning disc animation ────────────────────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isPlaying) {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 5000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
    }
    return () => spinLoop.current?.stop();
  }, [isPlaying]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Hide on the full audio screen or when nothing loaded
  if (!sound || pathname.includes("blog-view-2")) return null;

  const title = blog?.audio?.title ?? blog?.caption ?? "Now Playing";
  const blogId = blog?.id;
  const progress = duration > 0 ? position / duration : 0;

  const CARD_H = 72;
  const ART = 52;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: insets.bottom + 10,
        left: 12,
        right: 12,
        zIndex: 999,
      }}
    >
      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.55,
          shadowRadius: 16,
          elevation: 14,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {/* ── Top row ─────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 8,
            gap: 12,
            height: CARD_H,
          }}
        >
          {/* Album art — spinning disc */}
          <Pressable
            onPress={() => router.push(`/blog-view-2/${blogId}/index` as any)}
            style={{
              width: ART,
              height: ART,
              borderRadius: ART / 2,
              backgroundColor: colors.muted,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Disc3 size={ART - 4} color={colors.primary} strokeWidth={1.5} />
            </Animated.View>
            {/* Center hub dot */}
            <View
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.card,
              }}
            />
          </Pressable>

          {/* Track info */}
          <Pressable
            onPress={() => router.push(`/blog-view-2/${blogId}/index` as any)}
            style={{ flex: 1 }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.foreground,
                textAlign: "left",
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: sleepRemaining != null ? "#f59e0b" : colors.mutedForeground,
                marginTop: 2,
              }}
            >
              {sleepRemaining != null
                ? `💤 ${formatSleepRemaining(sleepRemaining)}`
                : `${formatTime(position)} / ${formatTime(duration)}`}
            </Text>
          </Pressable>

          {/* Controls */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Pressable
              onPress={() => seek(Math.max(0, position - 5000))}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <SkipBack5Icon size={26} color={colors.mutedForeground} />
            </Pressable>

            <Pressable
              onPress={() => togglePlayPause()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.6,
                shadowRadius: 6,
                elevation: 6,
              }}
            >
              {isPlaying ? (
                <Pause size={18} color="#000" fill="#000" />
              ) : (
                <Play size={18} color="#000" fill="#000" style={{ marginLeft: 2 }} />
              )}
            </Pressable>

            <Pressable
              onPress={() => seek(Math.min(duration, position + 5000))}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <SkipForward5Icon size={26} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        {/* ── Progress bar (full-width, flush to bottom of card) ────────── */}
        <View
          style={{
            height: 3,
            backgroundColor: colors.muted,
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              backgroundColor: colors.primary,
              borderRadius: 2,
            }}
          />
        </View>
      </View>
    </View>
  );
}
