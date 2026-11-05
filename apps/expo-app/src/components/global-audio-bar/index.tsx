import { shouldShowAudioBar } from "@/lib/audio-bar-visibility";
import { useAudioStore, type AudioPlayMode } from "@/store/audio-store";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { useFloatingBottomSheetStore } from "@/components/ui/floating-bottom-sheet-store";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";
import { AnimatedMarquee } from "@/components/ui/animated-marquee";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { rememberAudioDetailFromPost } from "@/lib/audio-detail-preview";
import { getNextPlaybackRate } from "@/services/audio-player/notification-controls";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
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

export function GlobalAudioBar() {
	const pathname = usePathname();
	const router = useRouter();
	const colors = useColors();
	const [optionsVisible, setOptionsVisible] = useState(false);
	const insets = useSafeAreaInsets();

	const sound = useAudioStore((s) => s.sound);
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const isLoading = useAudioStore((s) => s.isLoading);
	const blog = useAudioStore((s) => s.blog);
	const position = useAudioStore((s) => s.position);
	const duration = useAudioStore((s) => s.duration);
	const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
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
	const hasOpenFloatingSheet = useFloatingBottomSheetStore(
		(s) => Object.keys(s.openSheetIds).length > 0,
	);
	const audioDetailPlayerVisible = useGlobalAudioBarStore(
		(s) => s.audioDetailPlayerVisible,
	);
	const viewedAudioMediaId = useGlobalAudioBarStore(
		(s) => s.viewedAudioMediaId,
	);

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

	const audioDetailMatch = pathname.match(/^\/blog-view-2\/([^/]+)/);
	const viewedAudioId = audioDetailMatch?.[1] ?? null;
	const visible = shouldShowAudioBar({
		pathname,
		hasAudio: Boolean(sound),
		activeBlogId: blog?.id,
		activeMediaId: (blog?.audio as any)?.mediaId,
		viewedMediaId: viewedAudioMediaId,
		hidden,
		sheetOpen: hasOpenFloatingSheet,
		scrollHidden,
		detailVisible: audioDetailPlayerVisible,
	});
	const title = getAudioDisplayTitle(blog, "Now Playing");
	const blogId = blog?.id;
	const showTitle = !viewedAudioId || String(blogId) !== viewedAudioId;
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
	const isPlaybackBusy = isLoading && !isPlaying;
	const cycleSpeed = () => {
		setPlaybackRate(getNextPlaybackRate(playbackRate));
	};

	const openComments = () => {
		if (!blogId) return;
		if (blog) rememberAudioDetailFromPost(blog);
		router.push(`/blog-view-2/${blogId}?openComments=1` as any);
	};

	const openAudioDetail = () => {
		if (!blogId) return;
		if (blog) rememberAudioDetailFromPost(blog);
		router.push(`/blog-view-2/${blogId}` as any);
	};

	useFloatingFooterLayer({
		id: FLOATING_FOOTER_GLOBAL_AUDIO_ID,
		priority: FLOATING_FOOTER_GLOBAL_AUDIO_PRIORITY,
		visible,
		render: () => (
			<View pointerEvents="box-none" style={{ paddingHorizontal: 12 }}>
				<View
					style={{
						backgroundColor: colors.card,
						borderRadius: 14,
						overflow: "hidden",
						shadowColor: "#000",
						shadowOffset: { width: 0, height: 8 },
						shadowOpacity: 0.22,
						shadowRadius: 18,
						elevation: 14,
					}}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 2,
							paddingLeft: 13,
							paddingRight: 8,
							paddingVertical: 10,
						}}
					>
						<Pressable
							onPress={openAudioDetail}
							onLongPress={() => setOptionsVisible(true)}
							accessibilityRole="button"
							accessibilityLabel={`Open audio details: ${title}`}
							accessibilityHint="Hold for playback speed, album mode and comments"
							accessibilityActions={[
								{ name: "longpress", label: "Playback options" },
							]}
							onAccessibilityAction={(event) => {
								if (event.nativeEvent.actionName === "longpress")
									setOptionsVisible(true);
							}}
							android_ripple={{
								color: withAlpha(colors.primary, 0.14),
								foreground: true,
							}}
							style={({ pressed }) => ({
								flex: 1,
								minWidth: 0,
								minHeight: 48,
								justifyContent: "center",
								opacity: pressed ? 0.7 : 1,
							})}
						>
							{showTitle ? (
								<AnimatedMarquee
									key={title}
									text={title}
									style={{
										fontSize: 13,
										fontWeight: "600",
										color: colors.foreground,
									}}
								/>
							) : null}
							<Text
								numberOfLines={1}
								style={{
									color: colors.mutedForeground,
									fontSize: 10,
									marginTop: showTitle ? 3 : 0,
									fontVariant: ["tabular-nums"],
								}}
							>
								{sleepRemaining != null
									? `${timeLabel} · Sleep ${formatSleepRemaining(sleepRemaining)}`
									: `${timeLabel}${indexLabel ? ` · ${indexLabel}` : ""}`}
							</Text>
						</Pressable>
						<Pressable
							onPress={() => {
								const state = useAudioStore.getState();
								void state.seek(Math.max(0, state.position - 5000));
							}}
							disabled={isPlaybackBusy || duration <= 0}
							accessibilityRole="button"
							accessibilityLabel="Rewind 5 seconds"
							accessibilityState={{ disabled: isPlaybackBusy || duration <= 0 }}
							android_ripple={{
								color: withAlpha(colors.primary, 0.14),
								foreground: true,
							}}
							style={({ pressed }) => ({
								minWidth: 48,
								minHeight: 48,
								alignItems: "center",
								justifyContent: "center",
								opacity:
									isPlaybackBusy || duration <= 0 ? 0.45 : pressed ? 0.7 : 1,
							})}
						>
							<Icon name="Backward5" size={32} color={colors.foreground} />
						</Pressable>
						<Pressable
							onPress={() => togglePlayPause()}
							disabled={isPlaybackBusy}
							accessibilityRole="button"
							accessibilityLabel={
								isPlaybackBusy ? "Loading audio" : isPlaying ? "Pause" : "Play"
							}
							accessibilityState={{
								disabled: isPlaybackBusy,
								busy: isPlaybackBusy,
							}}
							android_ripple={{
								color: withAlpha(colors.primaryForeground, 0.2),
								foreground: true,
							}}
							style={({ pressed }) => ({
								width: 48,
								height: 48,
								borderRadius: 24,
								backgroundColor: colors.primary,
								alignItems: "center",
								justifyContent: "center",
								opacity: isPlaybackBusy ? 0.65 : pressed ? 0.7 : 1,
							})}
						>
							{isPlaybackBusy ? (
								<ActivityIndicator
									size="small"
									color={colors.primaryForeground}
								/>
							) : (
								<Icon
									name={isPlaying ? "Pause" : "Play"}
									size={21}
									color={colors.primaryForeground}
									fill={colors.primaryForeground}
								/>
							)}
						</Pressable>
						<Pressable
							onPress={() => {
								const state = useAudioStore.getState();
								void state.seek(
									Math.min(state.duration, state.position + 5000),
								);
							}}
							disabled={isPlaybackBusy || duration <= 0}
							accessibilityRole="button"
							accessibilityLabel="Forward 5 seconds"
							accessibilityState={{ disabled: isPlaybackBusy || duration <= 0 }}
							android_ripple={{
								color: withAlpha(colors.primary, 0.14),
								foreground: true,
							}}
							style={({ pressed }) => ({
								minWidth: 48,
								minHeight: 48,
								alignItems: "center",
								justifyContent: "center",
								opacity:
									isPlaybackBusy || duration <= 0 ? 0.45 : pressed ? 0.7 : 1,
							})}
						>
							<Icon name="Forward5" size={32} color={colors.foreground} />
						</Pressable>
					</View>
					<View style={{ height: 3, backgroundColor: colors.muted }}>
						<View
							style={{
								height: 3,
								width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
								backgroundColor: colors.primary,
							}}
						/>
					</View>
				</View>
			</View>
		),
	});

	return (
		<FloatingBottomSheet
			visible={optionsVisible}
			onClose={() => setOptionsVisible(false)}
			bottomInset={Math.max(48, insets.bottom + 20)}
			title="Playback options"
			accessibilityLabel="Playback options"
		>
			<View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 8 }}>
				<Pressable
					onPress={cycleSpeed}
					accessibilityRole="button"
					accessibilityLabel={`Playback speed ${playbackRate} times`}
					android_ripple={{ color: withAlpha(colors.primary, 0.14) }}
					style={({ pressed }) => ({
						minHeight: 48,
						paddingHorizontal: 12,
						borderRadius: 10,
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						backgroundColor: pressed ? colors.muted : colors.secondary,
					})}
				>
					<Text style={{ color: colors.foreground, fontSize: 14 }}>
						Playback speed
					</Text>
					<Text
						style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}
					>
						{playbackRate}×
					</Text>
				</Pressable>
				{canUseAlbumPlayMode ? (
					<Pressable
						onPress={cyclePlayMode}
						accessibilityRole="button"
						accessibilityLabel={playModeMeta.accessibilityLabel}
						android_ripple={{ color: withAlpha(colors.primary, 0.14) }}
						style={({ pressed }) => ({
							minHeight: 48,
							paddingHorizontal: 12,
							borderRadius: 10,
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							backgroundColor: pressed ? colors.muted : colors.secondary,
						})}
					>
						<Text style={{ color: colors.foreground, fontSize: 14 }}>
							{playModeMeta.accessibilityLabel}
						</Text>
						<Icon name={playModeMeta.icon} size={21} color={colors.primary} />
					</Pressable>
				) : null}
				<Pressable
					onPress={() => {
						setOptionsVisible(false);
						openComments();
					}}
					accessibilityRole="button"
					android_ripple={{ color: withAlpha(colors.primary, 0.14) }}
					style={({ pressed }) => ({
						minHeight: 48,
						paddingHorizontal: 12,
						borderRadius: 10,
						flexDirection: "row",
						alignItems: "center",
						gap: 12,
						backgroundColor: pressed ? colors.muted : colors.secondary,
					})}
				>
					<Icon name="MessageSquare" size={21} color={colors.foreground} />
					<Text style={{ color: colors.foreground, fontSize: 14 }}>
						Timestamped comments
					</Text>
				</Pressable>
				<Pressable
					onPress={() => {
						setOptionsVisible(false);
						openAudioDetail();
					}}
					accessibilityRole="button"
					android_ripple={{ color: withAlpha(colors.primary, 0.14) }}
					style={({ pressed }) => ({
						minHeight: 48,
						paddingHorizontal: 12,
						borderRadius: 10,
						flexDirection: "row",
						alignItems: "center",
						gap: 12,
						backgroundColor: pressed ? colors.muted : colors.secondary,
					})}
				>
					<Icon name="Headphones" size={21} color={colors.foreground} />
					<Text style={{ color: colors.foreground, fontSize: 14 }}>
						Open full player
					</Text>
				</Pressable>
			</View>
		</FloatingBottomSheet>
	);
}
