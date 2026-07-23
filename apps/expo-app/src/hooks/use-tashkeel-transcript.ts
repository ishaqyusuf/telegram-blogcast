import { useEffect, useRef, useState } from "react";

import type { TranscriptSegmentData } from "@/components/audio-blog-view/transcript-timing";
import { diacritizeTextOnDevice } from "@/lib/on-device-tashkeel";
import { applyTashkeelToWords } from "@/lib/tashkeel-core";

type TashkeelTranscriptState = {
	segments: TranscriptSegmentData[];
	isLoading: boolean;
	error: string | null;
};

function segmentCacheKey(segment: TranscriptSegmentData) {
	const words = segment.words
		?.map((word) => `${word.startSec}:${word.endSec}:${word.word}`)
		.join("\u0001");
	return `${segment.id ?? ""}\u0000${segment.startSec}\u0000${segment.endSec}\u0000${segment.text}\u0000${words ?? ""}`;
}

export function useTashkeelTranscript(
	sourceSegments: TranscriptSegmentData[],
	enabled: boolean,
): TashkeelTranscriptState {
	const transformedSegmentsRef = useRef(
		new Map<string, TranscriptSegmentData>(),
	);
	const [state, setState] = useState<TashkeelTranscriptState>({
		segments: sourceSegments,
		isLoading: false,
		error: null,
	});

	useEffect(() => {
		let cancelled = false;

		if (!enabled || sourceSegments.length === 0) {
			setState({ segments: sourceSegments, isLoading: false, error: null });
			return () => {
				cancelled = true;
			};
		}

		const sourceEntries = sourceSegments.map(
			(segment) => [segmentCacheKey(segment), segment] as const,
		);
		const currentKeys = new Set(sourceEntries.map(([key]) => key));
		for (const key of transformedSegmentsRef.current.keys()) {
			if (!currentKeys.has(key)) transformedSegmentsRef.current.delete(key);
		}

		const displayedSegments = sourceEntries.map(
			([key, segment]) => transformedSegmentsRef.current.get(key) ?? segment,
		);
		const hasPendingSegments = sourceEntries.some(
			([key]) => !transformedSegmentsRef.current.has(key),
		);
		setState({
			segments: displayedSegments,
			isLoading: hasPendingSegments,
			error: null,
		});
		if (!hasPendingSegments) {
			return () => {
				cancelled = true;
			};
		}

		void (async () => {
			try {
				for (const [key, segment] of sourceEntries) {
					if (transformedSegmentsRef.current.has(key)) continue;
					const text = await diacritizeTextOnDevice(segment.text);
					transformedSegmentsRef.current.set(key, {
						...segment,
						text,
						words: segment.words
							? applyTashkeelToWords(segment.text, text, segment.words)
							: segment.words,
					});
				}
				if (!cancelled) {
					setState({
						segments: sourceEntries.map(
							([key, segment]) =>
								transformedSegmentsRef.current.get(key) ?? segment,
						),
						isLoading: false,
						error: null,
					});
				}
			} catch (error) {
				if (cancelled) return;
				setState({
					segments: sourceEntries.map(
						([key, segment]) =>
							transformedSegmentsRef.current.get(key) ?? segment,
					),
					isLoading: false,
					error:
						error instanceof Error
							? error.message
							: "Arabic vowels could not be added.",
				});
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [enabled, sourceSegments]);

	return state;
}
