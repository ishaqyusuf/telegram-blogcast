import { normalizePlaybackRate } from "./notification-controls";
import type { RemotePlaybackSnapshot } from "./playback-service-handlers";

interface CurrentRemotePlaybackState {
	duration: number;
	isSeeking: boolean;
	pausedAt: number | null;
	playedAt: number | null;
	position: number;
}

interface RemotePlaybackStateUpdate {
	duration: number;
	isPlaying: boolean;
	pausedAt: number | null;
	playbackRate: number;
	playedAt: number | null;
	position: number;
}

function secondsToMillis(seconds: number) {
	return Math.max(0, Math.round(seconds * 1000));
}

export function getRemotePlaybackStateUpdate({
	snapshot,
	current,
	now,
}: {
	snapshot: RemotePlaybackSnapshot;
	current: CurrentRemotePlaybackState;
	now: number;
}): RemotePlaybackStateUpdate {
	const duration = secondsToMillis(snapshot.duration) || current.duration;

	return {
		duration,
		isPlaying: snapshot.isPlaying,
		pausedAt: snapshot.isPlaying ? null : now,
		playbackRate: normalizePlaybackRate(snapshot.playbackRate),
		playedAt: snapshot.isPlaying ? now : current.playedAt,
		position: current.isSeeking
			? current.position
			: secondsToMillis(snapshot.position),
	};
}
