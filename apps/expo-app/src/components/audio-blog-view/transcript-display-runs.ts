import type {
	TranscriptDocument,
	TranscriptSegmentData,
} from "@/components/audio-blog-view/transcript-timing";

export type TranscriptDisplayRun = {
	key: string;
	text: string;
	startOffset: number;
	endOffset: number;
	segmentIndex: number;
	wordIndex: number | null;
	startSec: number;
	endSec: number;
};

export type TranscriptDisplaySegment = {
	key: string;
	index: number;
	segment: TranscriptSegmentData;
	separatorBefore: string;
	startOffset: number;
	endOffset: number;
	runs: TranscriptDisplayRun[];
};

export function getTranscriptDisplaySegmentKey(
	segment: TranscriptSegmentData,
	_index: number,
) {
	return `${segment.id == null ? "time" : `id:${segment.id}`}:${segment.startSec}:${segment.endSec}`;
}

export function buildTranscriptDisplayRuns(
	document: TranscriptDocument,
): TranscriptDisplaySegment[] {
	return document.segmentRanges.map((segmentRange) => {
		const wordRanges = document.wordRangesBySegment[segmentRange.index] ?? [];
		const boundaries = new Set<number>([
			segmentRange.startOffset,
			segmentRange.endOffset,
		]);

		for (const wordRange of wordRanges) {
			boundaries.add(wordRange.startOffset);
			boundaries.add(wordRange.endOffset);
		}

		const orderedBoundaries = [...boundaries].sort((a, b) => a - b);
		const runs: TranscriptDisplayRun[] = [];
		for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
			const startOffset = orderedBoundaries[index] ?? segmentRange.startOffset;
			const endOffset = orderedBoundaries[index + 1] ?? segmentRange.endOffset;
			if (endOffset <= startOffset) continue;

			const wordRange = wordRanges.find(
				(candidate) =>
					candidate.startOffset <= startOffset &&
					candidate.endOffset >= endOffset,
			);
			const text = document.fullText.slice(startOffset, endOffset);
			if (!text) continue;

			runs.push({
				key: `${segmentRange.index}:${startOffset}:${endOffset}`,
				text,
				startOffset,
				endOffset,
				segmentIndex: segmentRange.index,
				wordIndex: wordRange?.wordIndex ?? null,
				startSec: wordRange?.word.startSec ?? segmentRange.segment.startSec,
				endSec: wordRange?.word.endSec ?? segmentRange.segment.endSec,
			});
		}

		return {
			key: getTranscriptDisplaySegmentKey(
				segmentRange.segment,
				segmentRange.index,
			),
			index: segmentRange.index,
			segment: segmentRange.segment,
			separatorBefore:
				segmentRange.index === 0
					? ""
					: document.fullText.slice(
							document.segmentRanges[segmentRange.index - 1]?.endOffset ??
								segmentRange.startOffset,
							segmentRange.startOffset,
						),
			startOffset: segmentRange.startOffset,
			endOffset: segmentRange.endOffset,
			runs,
		};
	});
}
