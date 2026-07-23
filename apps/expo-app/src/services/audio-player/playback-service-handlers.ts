import {
	ANDROID_NOTIFICATION_ACTION_IDS,
	AUDIO_JUMP_SECONDS,
	getNextPlaybackRate,
} from "./notification-controls";

export const REMOTE_PLAYBACK_EVENTS = {
	customAction: "remote-custom-action",
	duck: "remote-duck",
	jumpBackward: "remote-jump-backward",
	jumpForward: "remote-jump-forward",
	pause: "remote-pause",
	play: "remote-play",
	seek: "remote-seek",
	stop: "remote-stop",
} as const;

export const REMOTE_PLAYBACK_SNAPSHOT_EVENT =
	"audio-remote-playback-snapshot" as const;

export interface RemotePlaybackSnapshot {
	state: unknown;
	isPlaying: boolean;
	position: number;
	duration: number;
	buffered: number;
	playbackRate: number;
}

export interface RemotePlaybackEvent {
	id?: string;
	interval?: number;
	paused?: boolean;
	permanent?: boolean;
	position?: number;
}

export interface PlaybackServicePlayer {
	addEventListener: (
		event: string,
		listener: (event?: RemotePlaybackEvent) => void | Promise<void>,
	) => unknown;
	getActiveTrack: () => Promise<
		{ id?: string | number; blogId?: string | number } | undefined
	>;
	getPlaybackState: () => Promise<unknown>;
	getProgress: () => Promise<{
		buffered: number;
		duration: number;
		position: number;
	}>;
	getRate: () => Promise<number>;
	pause: () => Promise<void>;
	play: () => Promise<void>;
	seekTo: (position: number) => Promise<void>;
	setRate: (rate: number) => Promise<void>;
}

interface PlaybackServiceHandlerDependencies {
	player: PlaybackServicePlayer;
	publishSnapshot: (snapshot: RemotePlaybackSnapshot) => void;
	refreshNotificationOptions?: (playbackRate: number) => Promise<void>;
	openComments?: (blogId: string) => Promise<void>;
	isPlayingState?: (state: unknown) => boolean;
	onError?: (action: string, error: unknown) => void;
}

async function readSnapshot(
	player: PlaybackServicePlayer,
	isPlayingState: (state: unknown) => boolean,
): Promise<RemotePlaybackSnapshot> {
	const [playbackState, progress, playbackRate] = await Promise.all([
		player.getPlaybackState(),
		player.getProgress(),
		player.getRate(),
	]);
	const state =
		typeof playbackState === "object" &&
		playbackState !== null &&
		"state" in playbackState
			? playbackState.state
			: playbackState;

	return {
		state,
		isPlaying: isPlayingState(state),
		position: progress.position,
		duration: progress.duration,
		buffered: progress.buffered,
		playbackRate,
	};
}

async function seekBySeconds(
	player: PlaybackServicePlayer,
	offsetSeconds: number,
) {
	const progress = await player.getProgress();
	const duration = Number.isFinite(progress.duration) ? progress.duration : 0;
	const nextPosition = Math.max(
		0,
		duration > 0
			? Math.min(duration, progress.position + offsetSeconds)
			: progress.position + offsetSeconds,
	);

	await player.seekTo(nextPosition);
}

export function registerPlaybackServiceHandlers({
	player,
	publishSnapshot,
	refreshNotificationOptions = async () => undefined,
	openComments = async () => undefined,
	isPlayingState = (state) => state === "playing" || state === "buffering",
	onError = (action, error) => {
		console.warn(`[audio] remote ${action} failed`, error);
	},
}: PlaybackServiceHandlerDependencies) {
	const runRemoteAction = async (
		actionName: string,
		action: () => Promise<void>,
	) => {
		try {
			await action();
			publishSnapshot(await readSnapshot(player, isPlayingState));
		} catch (error) {
			onError(actionName, error);
		}
	};

	player.addEventListener(REMOTE_PLAYBACK_EVENTS.play, () =>
		runRemoteAction("play", () => player.play()),
	);

	player.addEventListener(REMOTE_PLAYBACK_EVENTS.pause, () =>
		runRemoteAction("pause", () => player.pause()),
	);

	player.addEventListener(REMOTE_PLAYBACK_EVENTS.stop, () =>
		runRemoteAction("stop", () => player.pause()),
	);

	player.addEventListener(REMOTE_PLAYBACK_EVENTS.jumpBackward, (event) => {
		const offset = event?.interval ?? AUDIO_JUMP_SECONDS;
		return runRemoteAction("jump backward", () =>
			seekBySeconds(player, -Math.abs(offset)),
		);
	});

	player.addEventListener(REMOTE_PLAYBACK_EVENTS.jumpForward, (event) => {
		const offset = event?.interval ?? AUDIO_JUMP_SECONDS;
		return runRemoteAction("jump forward", () =>
			seekBySeconds(player, Math.abs(offset)),
		);
	});

	player.addEventListener(REMOTE_PLAYBACK_EVENTS.seek, (event) =>
		runRemoteAction("seek", () => player.seekTo(event?.position ?? 0)),
	);

	player.addEventListener(REMOTE_PLAYBACK_EVENTS.duck, (event) => {
		if (!event?.paused && !event?.permanent) return;
		return runRemoteAction("duck", () => player.pause());
	});

	player.addEventListener(REMOTE_PLAYBACK_EVENTS.customAction, (event) => {
		switch (event?.id) {
			case ANDROID_NOTIFICATION_ACTION_IDS.cyclePlaybackRate:
				return runRemoteAction("cycle playback rate", async () => {
					const nextRate = getNextPlaybackRate(await player.getRate());
					await player.setRate(nextRate);
					await refreshNotificationOptions(nextRate);
				});
			case ANDROID_NOTIFICATION_ACTION_IDS.openComments:
				return runRemoteAction("open comments", async () => {
					const track = await player.getActiveTrack();
					const blogId = track?.blogId ?? track?.id;
					if (blogId === undefined || blogId === null) return;
					await openComments(String(blogId));
				});
			default:
				return undefined;
		}
	});
}
