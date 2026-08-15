export type TranscriptPlaybackClockInput = {
	positionSec: number;
	sampledAtMs: number;
	nowMs: number;
	isPlaying: boolean;
	isLoading: boolean;
	isSeeking: boolean;
	playbackRate: number;
	durationSec: number;
};

const MAX_PROJECTION_MS = 750;

export function projectPlaybackPositionSec({
	positionSec,
	sampledAtMs,
	nowMs,
	isPlaying,
	isLoading,
	isSeeking,
	playbackRate,
	durationSec,
}: TranscriptPlaybackClockInput) {
	const safePosition = Math.max(0, positionSec);
	if (!isPlaying || isLoading || isSeeking) {
		return durationSec > 0 ? Math.min(durationSec, safePosition) : safePosition;
	}

	const elapsedSec =
		Math.min(MAX_PROJECTION_MS, Math.max(0, nowMs - sampledAtMs)) / 1000;
	const projected = safePosition + elapsedSec * Math.max(0, playbackRate);
	return durationSec > 0 ? Math.min(durationSec, projected) : projected;
}
