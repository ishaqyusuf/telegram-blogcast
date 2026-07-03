import { useAudioStore, type AudioPlayMode } from "@/store/audio-store";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { useColors } from "@/hooks/use-color";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Icon, type IconKeys } from "@/components/ui/icon";
import {
  FLOATING_FOOTER_GLOBAL_AUDIO_ID,
  FLOATING_FOOTER_GLOBAL_AUDIO_PRIORITY,
  useFloatingFooterLayer,
} from "@/components/floating-footer";

const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2];
const STALE_PAUSED_AUDIO_MS = 12 * 60 * 60 * 1000;
const PLAY_MODE_META: Record<
  AudioPlayMode,
  { icon: IconKeys; label: string; accessibilityLabel: string }
> = {
  off: {
    icon: "Circle",
    label: "Off",
    accessibilityLabel: "Album play mode off",
  },
  "repeat-one": {
    icon: "RefreshCw",
    label: "1",
    accessibilityLabel: "Repeat current track",
  },
  "album-sequence": {
    icon: "SkipForward",
    label: "Next",
    accessibilityLabel: "Play next album track",
  },
  "repeat-album": {
    icon: "RotateCw",
    label: "All",
    accessibilityLabel: "Repeat album",
  },
  "shuffle-album": {
    icon: "Shuffle",
    label: "Mix",
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

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.findIndex(
      (rate) => Math.abs(playbackRate - rate) < 0.01,
    );
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]!;
    setPlaybackRate(next);
  };

  const openComments = () => {
    if (!blogId) return;
    router.push(`/blog-view-2/${blogId}?openComments=1` as any);
  };

  const CARD_H = 72;
  const ART = 52;

  useFloatingFooterLayer({
    id: FLOATING_FOOTER_GLOBAL_AUDIO_ID,
    priority: FLOATING_FOOTER_GLOBAL_AUDIO_PRIORITY,
    visible,
    render: () => (
      <View pointerEvents="box-none" style={{ paddingHorizontal: 12 }}>
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
              onPress={() => router.push(`/blog-view-2/${blogId}` as any)}
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
                <Icon name="Disc3" size={ART - 4} color={colors.primary} />
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
              onPress={() => router.push(`/blog-view-2/${blogId}` as any)}
              style={{ flex: 1, minWidth: 0 }}
            >
              <MarqueeText
                text={title}
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.foreground,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  color:
                    sleepRemaining != null ? "#f59e0b" : colors.mutedForeground,
                  marginTop: 2,
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
                gap: 6,
              }}
            >
              <Pressable
                onPress={cycleSpeed}
                hitSlop={10}
                style={{
                  minWidth: 34,
                  paddingHorizontal: 7,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: colors.muted,
                  alignItems: "center",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.mutedForeground,
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
                    minWidth: 44,
                    paddingHorizontal: 7,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor:
                      playMode === "off" ? colors.muted : colors.primary,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 3,
                  }}
                >
                  <Icon
                    name={playModeMeta.icon}
                    size={13}
                    color={
                      playMode === "off"
                        ? colors.mutedForeground
                        : colors.primaryForeground
                    }
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      color:
                        playMode === "off"
                          ? colors.mutedForeground
                          : colors.primaryForeground,
                      fontSize: 10,
                      fontWeight: "900",
                    }}
                  >
                    {playModeMeta.label}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => seek(Math.max(0, position - 5000))}
                hitSlop={10}
                style={{ padding: 4 }}
              >
                <Icon
                  name="Backward5"
                  size={26}
                  color={colors.mutedForeground}
                />
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
                  <Icon name="Pause" size={18} color="#000" fill="#000" />
                ) : (
                  <Icon
                    name="Play"
                    size={18}
                    color="#000"
                    fill="#000"
                    style={{ marginLeft: 2 }}
                  />
                )}
              </Pressable>

              <Pressable
                onPress={() => seek(Math.min(duration, position + 5000))}
                hitSlop={10}
                style={{ padding: 4 }}
              >
                <Icon
                  name="Forward5"
                  size={26}
                  color={colors.mutedForeground}
                />
              </Pressable>

              <Pressable
                onPress={openComments}
                hitSlop={10}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="Plus" size={20} color={colors.foreground} />
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
    ),
  });

  return null;
}
