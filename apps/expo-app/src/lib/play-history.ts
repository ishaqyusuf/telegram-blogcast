export type PlaybackHistorySnapshot = {
	mediaId: number | null;
	isPlaying: boolean;
	isSeeking: boolean;
	position: number;
};

export type PlayHistoryWrite = { mediaId: number; progressMs: number };

const sessionPositions = new Map<number, number>();

export function rememberSessionPosition(mediaId: number, progressMs: number) {
	sessionPositions.set(mediaId, progressMs);
}

export function getSessionPosition(mediaId: number) {
	return sessionPositions.get(mediaId);
}

/** Identify meaningful playback transitions without saving merely viewed audio. */
export function planPlayHistoryWrites(
	previous: PlaybackHistorySnapshot,
	current: PlaybackHistorySnapshot,
): PlayHistoryWrite[] {
	const writes: PlayHistoryWrite[] = [];
	if (previous.mediaId && previous.mediaId !== current.mediaId) {
		writes.push({ mediaId: previous.mediaId, progressMs: previous.position });
	}
	if (current.mediaId) {
		const started =
			current.isPlaying &&
			(previous.mediaId !== current.mediaId || !previous.isPlaying);
		const paused =
			previous.mediaId === current.mediaId &&
			previous.isPlaying &&
			!current.isPlaying;
		const sought =
			previous.mediaId === current.mediaId &&
			!current.isSeeking &&
			(previous.isSeeking ||
				(!current.isPlaying && current.position < previous.position) ||
				Math.abs(current.position - previous.position) >= 5_000);
		if (started || paused || sought) {
			writes.push({ mediaId: current.mediaId, progressMs: current.position });
		}
	}
	return writes;
}

export function getResumePosition(progressMs: number, durationMs: number) {
	if (!Number.isFinite(progressMs) || progressMs <= 0) return 0;
	const position = Math.max(0, Math.round(progressMs));
	if (durationMs > 0 && position >= durationMs - 750) return 0;
	return durationMs > 0 ? Math.min(position, durationMs) : position;
}
