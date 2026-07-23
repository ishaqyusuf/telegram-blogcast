export const ANDROID_NOTIFICATION_ACTION_IDS = {
	cyclePlaybackRate: "cycle-playback-rate",
	jumpBackward: "jump-backward-5",
	jumpForward: "jump-forward-5",
	openComments: "open-comments",
	playPause: "play-pause",
} as const;

export const AUDIO_JUMP_SECONDS = 5;
export const AUDIO_PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2] as const;

export type AudioPlaybackRate = (typeof AUDIO_PLAYBACK_RATES)[number];
export type AndroidNotificationActionId =
	(typeof ANDROID_NOTIFICATION_ACTION_IDS)[keyof typeof ANDROID_NOTIFICATION_ACTION_IDS];

export type AndroidCustomNotificationIconKey =
	| "comments"
	| "speed-1"
	| "speed-1-25"
	| "speed-1-5"
	| "speed-1-75"
	| "speed-2";
export type AndroidNotificationIconResource = number | string;

export interface AndroidCustomNotificationActionSpec {
	id: AndroidNotificationActionId;
	title: string;
	iconKey: AndroidCustomNotificationIconKey;
	compact: boolean;
	placement: "start" | "end";
}

export interface AndroidNotificationControlSpec {
	expandedActionIds: AndroidNotificationActionId[];
	compactActionIds: AndroidNotificationActionId[];
	customActions: AndroidCustomNotificationActionSpec[];
}

export interface TrackPlayerNotificationCapabilityMap<TCapability = number> {
	jumpBackward: TCapability;
	jumpForward: TCapability;
	pause: TCapability;
	play: TCapability;
	seekTo: TCapability;
}

export type TrackPlayerNotificationIconMap = Record<
	AndroidCustomNotificationIconKey,
	AndroidNotificationIconResource
> & {
	jumpBackward: AndroidNotificationIconResource;
	jumpForward: AndroidNotificationIconResource;
};

export interface TrackPlayerAndroidCustomAction {
	id: AndroidNotificationActionId;
	title: string;
	icon: AndroidNotificationIconResource;
	isCompact: boolean;
	placement: "start" | "end";
}

export interface TrackPlayerNotificationOptions<TCapability = number> {
	capabilities: TCapability[];
	notificationCapabilities: TCapability[];
	compactCapabilities: TCapability[];
	rewindIcon: AndroidNotificationIconResource;
	forwardIcon: AndroidNotificationIconResource;
	androidCustomActions: TrackPlayerAndroidCustomAction[];
}

const PLAYBACK_RATE_ICON_KEYS: Record<
	AudioPlaybackRate,
	AndroidCustomNotificationIconKey
> = {
	1: "speed-1",
	1.25: "speed-1-25",
	1.5: "speed-1-5",
	1.75: "speed-1-75",
	2: "speed-2",
};

export function normalizePlaybackRate(rate: number): AudioPlaybackRate {
	return (
		AUDIO_PLAYBACK_RATES.find((option) => Math.abs(option - rate) < 0.01) ?? 1
	);
}

export async function synchronizePlaybackRate({
	nativeRate,
	storedRate,
	setNativeRate,
	refreshNotificationOptions,
}: {
	nativeRate: number;
	storedRate: number;
	setNativeRate: (rate: AudioPlaybackRate) => Promise<void>;
	refreshNotificationOptions: (rate: AudioPlaybackRate) => Promise<void>;
}): Promise<AudioPlaybackRate> {
	const playbackRate = normalizePlaybackRate(nativeRate);

	if (Math.abs(playbackRate - nativeRate) >= 0.01) {
		await setNativeRate(playbackRate);
	}
	if (Math.abs(playbackRate - storedRate) >= 0.01) {
		await refreshNotificationOptions(playbackRate);
	}

	return playbackRate;
}

export function getNextPlaybackRate(rate: number): AudioPlaybackRate {
	const currentRate = normalizePlaybackRate(rate);
	const currentIndex = AUDIO_PLAYBACK_RATES.indexOf(currentRate);

	return (
		AUDIO_PLAYBACK_RATES[(currentIndex + 1) % AUDIO_PLAYBACK_RATES.length] ?? 1
	);
}

export function buildAndroidNotificationControlSpec(
	rate: number,
): AndroidNotificationControlSpec {
	const playbackRate = normalizePlaybackRate(rate);

	return {
		expandedActionIds: [
			ANDROID_NOTIFICATION_ACTION_IDS.cyclePlaybackRate,
			ANDROID_NOTIFICATION_ACTION_IDS.jumpBackward,
			ANDROID_NOTIFICATION_ACTION_IDS.playPause,
			ANDROID_NOTIFICATION_ACTION_IDS.jumpForward,
			ANDROID_NOTIFICATION_ACTION_IDS.openComments,
		],
		compactActionIds: [
			ANDROID_NOTIFICATION_ACTION_IDS.jumpBackward,
			ANDROID_NOTIFICATION_ACTION_IDS.playPause,
			ANDROID_NOTIFICATION_ACTION_IDS.jumpForward,
		],
		customActions: [
			{
				id: ANDROID_NOTIFICATION_ACTION_IDS.cyclePlaybackRate,
				title: `Playback speed ${playbackRate}×`,
				iconKey: PLAYBACK_RATE_ICON_KEYS[playbackRate],
				compact: false,
				placement: "start",
			},
			{
				id: ANDROID_NOTIFICATION_ACTION_IDS.openComments,
				title: "Open comments",
				iconKey: "comments",
				compact: false,
				placement: "end",
			},
		],
	};
}

export function buildTrackPlayerNotificationOptions<TCapability>({
	capability,
	icons,
	playbackRate,
}: {
	capability: TrackPlayerNotificationCapabilityMap<TCapability>;
	icons: TrackPlayerNotificationIconMap;
	playbackRate: number;
}): TrackPlayerNotificationOptions<TCapability> {
	const spec = buildAndroidNotificationControlSpec(playbackRate);

	return {
		capabilities: [
			capability.play,
			capability.pause,
			capability.seekTo,
			capability.jumpBackward,
			capability.jumpForward,
		],
		notificationCapabilities: [
			capability.jumpBackward,
			capability.play,
			capability.jumpForward,
		],
		compactCapabilities: [
			capability.jumpBackward,
			capability.play,
			capability.jumpForward,
		],
		rewindIcon: icons.jumpBackward,
		forwardIcon: icons.jumpForward,
		androidCustomActions: spec.customActions.map((action) => ({
			id: action.id,
			title: action.title,
			icon: icons[action.iconKey],
			isCompact: action.compact,
			placement: action.placement,
		})),
	};
}
