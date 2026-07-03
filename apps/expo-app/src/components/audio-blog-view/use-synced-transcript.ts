import { useEffect, useMemo, useState } from "react";

import {
	findActiveSegmentIndex,
	findActiveWordIndex,
	type TranscriptSegmentData,
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

export function useSyncedTranscript({
	segments,
	positionSecOverride,
}: {
	segments: TranscriptSegmentData[];
	positionSecOverride?: number;
}) {
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
		const syncFromPosition = (positionSec: number) => {
			const nextState = deriveSyncedTranscriptState(segments, positionSec);
			setState((previous) =>
				isSameSyncedTranscriptState(previous, nextState)
					? previous
					: nextState,
			);
		};

		if (positionSecOverride != null) {
			syncFromPosition(positionSecOverride);
			return;
		}

		syncFromPosition(useAudioStore.getState().position / 1000);
		return useAudioStore.subscribe((audioState) => {
			syncFromPosition(audioState.position / 1000);
		});
	}, [segments, positionSecOverride]);

	return state;
}
