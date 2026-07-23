import { useAudioStore, type AudioPlayMode } from "@/store/audio-store";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { useColors } from "@/hooks/use-color";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { getNextPlaybackRate } from "@/services/audio-player/notification-controls";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";
import { Icon, type IconKeys } from "@/components/ui/icon";
import {
  FLOATING_FOOTER_GLOBAL_AUDIO_ID,
  FLOATING_FOOTER_GLOBAL_AUDIO_PRIORITY,
  useFloatingFooterLayer,
} from "@/components/floating-footer";

const STALE_PAUSED_AUDIO_MS = 12 * 60 * 60 * 1000;
const PLAY_MODE_META: Record<
  AudioPlayMode,
  { icon: IconKeys; accessibilityLabel: string }
> = {
  off: {
    icon: "Circle",
    accessibilityLabel: "Album play mode off",
  },
  "repeat-one": {
    icon: "RefreshCw",
    accessibilityLabel: "Repeat current track",
  },
  "album-sequence": {
    icon: "SkipForward",
    accessibilityLabel: "Play next album track",
  },
  "repeat-album": {
    icon: "RotateCw",
    accessibilityLabel: "Repeat album",
  },
  "shuffle-album": {
    icon: "Shuffle",
    accessibilityLabel: "Shuffle album",
  },
};

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

// ── Marquee text ──────────────────────────────────────────────────────────────

function MarqueeText({ text, style }: { text: string; style?: any }) {
  const containerWidth = useRef(0);
  const textWidth = useRef(0);
  const anim = useRef(new Animated.Value(0)).current;
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  const startMarquee = () => {
    const overflow = textWidth.current - containerWidth.current;
    if (overflow <= 4) return; // fits — no animation needed
    loop.current?.stop();
    anim.setValue(0);
    loop.current = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(anim, {
          toValue: -overflow,
          duration: overflow * 22,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(anim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.current.start();
  };

  useEffect(() => {
    loop.current?.stop();
    anim.setValue(0);
    textWidth.current = 0;
  }, [anim, text]);

  useEffect(() => () => loop.current?.stop(), []);

  return (
    <View
      style={{ overflow: "hidden" }}
      onLayout={(e) => {
        containerWidth.current = e.nativeEvent.layout.width;
        startMarquee();
      }}
    >
      {/* Visible animated text — numberOfLines keeps it one line */}
      <Animated.Text
        numberOfLines={1}
        style={[style, { transform: [{ translateX: anim }] }]}
      >
        {text}
      </Animated.Text>

      {/* Off-screen ghost — measures true full text width */}
      <Text
        numberOfLines={1}
        onLayout={(e) => {
          textWidth.current = e.nativeEvent.layout.width;
          startMarquee();
        }}
        style={[
          style,
          {
            position: "absolute",
            opacity: 0,
            left: 0,
            right: undefined,
            width: 9999,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export function GlobalAudioBar() {
  const pathname = usePathname();
  const router = useRouter();
  const colors = useColors();

  const sound = useAudioStore((s) => s.sound);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const isLoading = useAudioStore((s) => s.isLoading);
  const isDownloading = useAudioStore((s) => s.isDownloading);
  const blog = useAudioStore((s) => s.blog);
  const position = useAudioStore((s) => s.position);
  const duration = useAudioStore((s) => s.duration);
  const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
  const seek = useAudioStore((s) => s.seek);
  const sleepTimerEnd = useAudioStore((s) => s.sleepTimerEnd);
  const clearSleepTimer = useAudioStore((s) => s.clearSleepTimer);
  const pause = useAudioStore((s) => s.pause);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);
  const playMode = useAudioStore((s) => s.playMode);
  const albumQueue = useAudioStore((s) => s.albumQueue);
  const cyclePlayMode = useAudioStore((s) => s.cyclePlayMode);
  const pausedAt = useAudioStore((s) => s.pausedAt);
  const unloadAudio = useAudioStore((s) => s.unloadAudio);
  const hidden = useGlobalAudioBarStore((s) => s.hidden);
  const scrollHidden = useGlobalAudioBarStore((s) => s.scrollHidden);

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
  }, [clearSleepTimer, pause, sleepTimerEnd]);

  useEffect(() => {
    if (!sound || isPlaying || !pausedAt) return;

    const maybeHideStaleAudio = () => {
      if (Date.now() - pausedAt > STALE_PAUSED_AUDIO_MS) {
        void unloadAudio();
      }
    };

    maybeHideStaleAudio();
    const id = setInterval(maybeHideStaleAudio, 60 * 1000);
    return () => clearInterval(id);
  }, [isPlaying, pausedAt, sound, unloadAudio]);

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
        }),
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
    }
    return () => spinLoop.current?.stop();
  }, [isPlaying, spinAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const visible = !(
    hidden ||
    scrollHidden ||
    !sound ||
    pathname.includes("blog-view-2")
  );
  const title = getAudioDisplayTitle(blog, "Now Playing");
  const blogId = blog?.id;
  const progress = duration > 0 ? position / duration : 0;
  const albumName = (blog?.audio as any)?.albumName as string | undefined;
  const albumTrackIndex = (blog?.audio as any)?.albumTrackIndex as
    | number
    | undefined;
  const timeLabel = `${formatTime(position)} / ${formatTime(duration)}`;
  const indexLabel =
    albumName && albumTrackIndex
      ? `Track ${albumTrackIndex} · ${albumName}`
      : null;
  const canUseAlbumPlayMode = Boolean(albumName && albumQueue?.length);
  const playModeMeta = PLAY_MODE_META[playMode];
  const isPlaybackBusy = isLoading || isDownloading;
  const isDark = colors.background === "rgb(10, 10, 10)";
  const playerBackground = isDark ? "rgb(126, 63, 6)" : colors.card;
  const playerBorder = isDark ? "rgba(255, 255, 255, 0.12)" : colors.border;
  const playerMuted = isDark
    ? "rgba(255, 255, 255, 0.72)"
    : colors.mutedForeground;
  const playerText = isDark ? "rgb(255, 255, 255)" : colors.foreground;
  const playerControl = isDark ? "rgb(34, 197, 94)" : colors.primary;
  const cycleSpeed = () => {
    setPlaybackRate(getNextPlaybackRate(playbackRate));
  };

  const openComments = () => {
    if (!blogId) return;
    router.push(`/blog-view-2/${blogId}?openComments=1` as any);
  };

  const CARD_H = 64;
  const ART = 42;

  useFloatingFooterLayer({
    id: FLOATING_FOOTER_GLOBAL_AUDIO_ID,
    priority: FLOATING_FOOTER_GLOBAL_AUDIO_PRIORITY,
    visible,
    render: () => (
      <View pointerEvents="box-none" style={{ paddingHorizontal: 12 }}>
        {/* ── Card ─────────────────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: playerBackground,
            borderRadius: 12,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.48 : 0.22,
            shadowRadius: 18,
            elevation: 14,
            borderWidth: 1,
            borderColor: playerBorder,
          }}
        >
          {/* ── Top row ─────────────────────────────────────────────────── */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 10,
              paddingTop: 8,
              paddingBottom: 7,
              gap: 8,
              height: CARD_H,
            }}
          >
            {/* Album art — spinning disc */}
            <Pressable
              onPress={() => router.push(`/blog-view-2/${blogId}` as any)}
              style={{
                width: ART,
                height: ART,
                borderRadius: 8,
                backgroundColor: isDark ? "rgba(0, 0, 0, 0.24)" : colors.muted,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Icon name="Disc3" size={ART - 12} color={playerControl} />
              </Animated.View>
              {/* Center hub dot */}
              <View
                style={{
                  position: "absolute",
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: playerBackground,
                }}
              />
            </Pressable>

            {/* Track info */}
            <Pressable
              onPress={() => router.push(`/blog-view-2/${blogId}` as any)}
              style={{ flex: 1, minWidth: 86 }}
            >
              <MarqueeText
                text={title}
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: playerText,
                }}
              />
              <Text
                numberOfLines={1}
                ellipsizeMode="clip"
                style={{
                  fontSize: 11,
                  color: sleepRemaining != null ? "#fbbf24" : playerMuted,
                  marginTop: 2,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {sleepRemaining != null
                  ? `💤 ${formatSleepRemaining(sleepRemaining)}`
                  : indexLabel
                    ? `${timeLabel} · ${indexLabel}`
                    : timeLabel}
              </Text>
            </Pressable>

            {/* Controls */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <Pressable
                onPress={cycleSpeed}
                hitSlop={10}
                style={{
                  minWidth: 34,
                  paddingHorizontal: 6,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: isDark ? "rgba(0, 0, 0, 0.2)" : colors.muted,
                  alignItems: "center",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: playerMuted,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  {playbackRate}x
                </Text>
              </Pressable>

              {canUseAlbumPlayMode ? (
                <Pressable
                  onPress={cyclePlayMode}
                  hitSlop={10}
                  accessibilityLabel={playModeMeta.accessibilityLabel}
                  style={{
                    width: 28,
                    height: 28,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={playModeMeta.icon}
                    size={19}
                    color={playMode === "off" ? playerMuted : playerControl}
                  />
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => seek(Math.max(0, position - 5000))}
                hitSlop={10}
                style={{ padding: 4 }}
              >
                <Icon name="Backward5" size={26} color={playerMuted} />
              </Pressable>

              <Pressable
                onPress={() => togglePlayPause()}
                disabled={isLoading}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.14)"
                    : colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: isDark ? "#000" : colors.primary,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.6,
                  shadowRadius: 6,
                  elevation: 6,
                  opacity: isLoading ? 0.85 : 1,
                }}
              >
                {isPlaybackBusy ? (
                  <ActivityIndicator size="small" color={playerText} />
                ) : isPlaying ? (
                  <Icon
                    name="Pause"
                    size={18}
                    color={playerText}
                    fill={playerText}
                  />
                ) : (
                  <Icon
                    name="Play"
                    size={18}
                    color={playerText}
                    fill={playerText}
                    style={{ marginLeft: 2 }}
                  />
                )}
              </Pressable>

              <Pressable
                onPress={() => seek(Math.min(duration, position + 5000))}
                hitSlop={10}
                style={{ padding: 4 }}
              >
                <Icon name="Forward5" size={26} color={playerMuted} />
              </Pressable>

              <Pressable
                onPress={openComments}
                hitSlop={10}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.76)"
                    : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="Plus" size={20} color={playerText} />
              </Pressable>
            </View>
          </View>

          {/* ── Progress bar (full-width, flush to bottom of card) ────────── */}
          <View
            style={{
              height: 3,
              backgroundColor: isDark ? "rgba(0, 0, 0, 0.24)" : colors.muted,
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                backgroundColor: playerControl,
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      </View>
    ),
  });

  return null;
}
