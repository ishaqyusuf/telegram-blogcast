import { useEffect, useMemo, useState } from "react";

import { projectPlaybackPositionSec } from "@/components/audio-blog-view/transcript-playback-clock";
import {
	type TranscriptSegmentData,
	findActiveSegmentIndex,
	findActiveWordIndex,
} from "@/components/audio-blog-view/transcript-timing";
import { useAudioStore } from "@/store/audio-store";

export type SyncedTranscriptState = {
	activeSegmentIndex: number;
	activeWordIndex: number;
};

function deriveSyncedTranscriptState(
	segments: TranscriptSegmentData[],
	positionSec: number,
): SyncedTranscriptState {
	const activeSegmentIndex = findActiveSegmentIndex(segments, positionSec);
	const activeWordIndex = findActiveWordIndex(
		activeSegmentIndex >= 0 ? segments[activeSegmentIndex]?.words : undefined,
		positionSec,
	);

	return { activeSegmentIndex, activeWordIndex };
}

function isSameSyncedTranscriptState(
	previous: SyncedTranscriptState,
	next: SyncedTranscriptState,
) {
	return (
		previous.activeSegmentIndex === next.activeSegmentIndex &&
		previous.activeWordIndex === next.activeWordIndex
	);
}

function nowMs() {
	return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function findNextTranscriptBoundarySec(
	segments: TranscriptSegmentData[],
	positionSec: number,
) {
	let low = 0;
	let high = segments.length - 1;
	let candidateIndex = segments.length;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		const segment = segments[middle];
		if (!segment) break;
		if (segment.endSec > positionSec) {
			candidateIndex = middle;
			high = middle - 1;
		} else {
			low = middle + 1;
		}
	}

	let nextBoundary = Number.POSITIVE_INFINITY;
	for (
		let index = candidateIndex;
		index < Math.min(segments.length, candidateIndex + 2);
		index += 1
	) {
		const segment = segments[index];
		if (!segment) continue;
		if (segment.startSec > positionSec)
			nextBoundary = Math.min(nextBoundary, segment.startSec);
		if (segment.endSec > positionSec)
			nextBoundary = Math.min(nextBoundary, segment.endSec);
		for (const word of segment.words ?? []) {
			if (word.timingSource === "estimated") continue;
			if (word.startSec > positionSec)
				nextBoundary = Math.min(nextBoundary, word.startSec);
			if (word.endSec > positionSec)
				nextBoundary = Math.min(nextBoundary, word.endSec);
		}
	}

	return Number.isFinite(nextBoundary) ? nextBoundary : null;
}

export function useSyncedTranscript({
	segments,
	positionSecOverride,
}: {
	segments: TranscriptSegmentData[];
	positionSecOverride?: number;
}) {
	const audioPositionMs = useAudioStore((audioState) => audioState.position);
	const isPlaying = useAudioStore((audioState) => audioState.isPlaying);
	const isLoading = useAudioStore((audioState) => audioState.isLoading);
	const isSeeking = useAudioStore((audioState) => audioState.isSeeking);
	const playbackRate = useAudioStore((audioState) => audioState.playbackRate);
	const durationMs = useAudioStore((audioState) => audioState.duration);
	const initialState = useMemo(
		() =>
			deriveSyncedTranscriptState(
				segments,
				positionSecOverride ?? useAudioStore.getState().position / 1000,
			),
		[segments, positionSecOverride],
	);
	const [state, setState] = useState(initialState);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		const sampledAtMs = nowMs();
		const syncFromPosition = (positionSec: number) => {
			const nextState = deriveSyncedTranscriptState(segments, positionSec);
			setState((previous) =>
				isSameSyncedTranscriptState(previous, nextState) ? previous : nextState,
			);
		};

		if (positionSecOverride != null) {
			syncFromPosition(positionSecOverride);
			return;
		}

		const tick = () => {
			const projectedPositionSec = projectPlaybackPositionSec({
				positionSec: audioPositionMs / 1000,
				sampledAtMs,
				nowMs: nowMs(),
				isPlaying,
				isLoading,
				isSeeking,
				playbackRate,
				durationSec: durationMs / 1000,
			});
			syncFromPosition(projectedPositionSec);

			if (!isPlaying || isLoading || isSeeking) return;
			const nextBoundarySec = findNextTranscriptBoundarySec(
				segments,
				projectedPositionSec,
			);
			const boundaryDelayMs =
				nextBoundarySec == null
					? 250
					: ((nextBoundarySec - projectedPositionSec) /
							Math.max(0.1, playbackRate)) *
						1000;
			timer = setTimeout(tick, Math.min(250, Math.max(16, boundaryDelayMs)));
		};

		tick();
		return () => {
			if (timer) clearTimeout(timer);
		};
	}, [
		audioPositionMs,
		durationMs,
		isLoading,
		isPlaying,
		isSeeking,
		playbackRate,
		positionSecOverride,
		segments,
	]);

	return state;
}
