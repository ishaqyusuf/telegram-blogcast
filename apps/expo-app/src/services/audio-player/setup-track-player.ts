import {
	AUDIO_JUMP_SECONDS,
	type TrackPlayerAndroidCustomAction,
	buildTrackPlayerNotificationOptions,
	normalizePlaybackRate,
} from "./notification-controls";
import TrackPlayer, {
	AndroidAudioContentType,
	AppKilledPlaybackBehavior,
	Capability,
	isTrackPlayerAvailable,
} from "./track-player-safe";

let setupPromise: Promise<void> | null = null;

export { AUDIO_JUMP_SECONDS } from "./notification-controls";

const notificationIcons = {
	comments: "notification_comments",
	jumpBackward: "notification_jump_backward_5",
	jumpForward: "notification_jump_forward_5",
	"speed-1": "notification_speed_1",
	"speed-1-25": "notification_speed_1_25",
	"speed-1-5": "notification_speed_1_5",
	"speed-1-75": "notification_speed_1_75",
	"speed-2": "notification_speed_2",
} as const;

type TrackPlayerUpdateOptions = Parameters<
	typeof TrackPlayer.updateOptions
>[0] & {
	androidCustomActions: TrackPlayerAndroidCustomAction[];
};

function getTrackPlayerUpdateOptions(
	playbackRate: number,
): TrackPlayerUpdateOptions {
	const supportedPlaybackRate = normalizePlaybackRate(playbackRate);

	return {
		android: {
			appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
			alwaysPauseOnInterruption: true,
		},
		backwardJumpInterval: AUDIO_JUMP_SECONDS,
		forwardJumpInterval: AUDIO_JUMP_SECONDS,
		progressUpdateEventInterval: 0.25,
		...buildTrackPlayerNotificationOptions({
			capability: {
				jumpBackward: Capability.JumpBackward,
				jumpForward: Capability.JumpForward,
				pause: Capability.Pause,
				play: Capability.Play,
				seekTo: Capability.SeekTo,
			},
			icons: notificationIcons,
			playbackRate: supportedPlaybackRate,
		}),
	};
}

export async function setupTrackPlayer(playbackRate = 1) {
	if (!isTrackPlayerAvailable) {
		throw new Error(
			"Audio playback needs a fresh Expo development build with react-native-track-player included.",
		);
	}

	if (!setupPromise) {
		setupPromise = TrackPlayer.setupPlayer({
			androidAudioContentType: AndroidAudioContentType.Speech,
			autoHandleInterruptions: true,
			autoUpdateMetadata: true,
			minBuffer: 10,
			maxBuffer: 50,
			playBuffer: 1.5,
			backBuffer: 30,
		}).catch((error: unknown) => {
			const code =
				typeof error === "object" && error && "code" in error
					? String((error as { code?: unknown }).code)
					: null;

			if (code === "player_already_initialized") {
				return;
			}

			setupPromise = null;
			throw error;
		});
	}

	await setupPromise;

	await TrackPlayer.updateOptions(getTrackPlayerUpdateOptions(playbackRate));
}

export async function refreshTrackPlayerNotificationOptions(
	playbackRate: number,
) {
	await TrackPlayer.updateOptions(getTrackPlayerUpdateOptions(playbackRate));
}
