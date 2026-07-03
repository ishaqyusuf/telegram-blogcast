export interface TranscriptWordData {
	word: string;
	startSec: number;
	endSec: number;
}

export interface TranscriptSegmentData {
	startSec: number;
	endSec: number;
	text: string;
	id?: number | string;
	words?: TranscriptWordData[];
}

export type RawTranscriptSegment = {
	id?: string | number;
	from?: number;
	to?: number;
	startSec?: number;
	endSec?: number;
	text: string;
	words?: RawTranscriptWord[];
};

type RawTranscriptWord = {
	word?: string;
	text?: string;
	start?: number;
	end?: number;
	from?: number;
	to?: number;
	startSec?: number;
	endSec?: number;
};

export type TranscriptSegmentRange = {
	index: number;
	segment: TranscriptSegmentData;
	startOffset: number;
	endOffset: number;
};

export type TranscriptWordRange = {
	segmentIndex: number;
	wordIndex: number;
	word: TranscriptWordData;
	startOffset: number;
	endOffset: number;
};

export type TranscriptDocument = {
	fullText: string;
	segments: TranscriptSegmentData[];
	segmentRanges: TranscriptSegmentRange[];
	wordRanges: TranscriptWordRange[];
	wordRangesBySegment: TranscriptWordRange[][];
};

export type TranscriptTextSelection = {
	text: string;
	startOffset: number;
	endOffset: number;
	dragStartOffset: number;
	startSegmentIndex: number;
	endSegmentIndex: number;
	timestampSec: number;
};

const SEGMENT_SEPARATOR = "\n\n";

function toFiniteNumber(value: unknown) {
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function normalizeTranscriptWords(words: unknown) {
	if (!Array.isArray(words)) return [];

	return words
		.map((word: RawTranscriptWord): TranscriptWordData | null => {
			const text = String(word?.word ?? word?.text ?? "").trim();
			const startSec = toFiniteNumber(word?.startSec ?? word?.start ?? word?.from);
			const endSec = toFiniteNumber(word?.endSec ?? word?.end ?? word?.to);

			if (!text || startSec == null || endSec == null || endSec <= startSec) {
				return null;
			}

			return { word: text, startSec, endSec };
		})
		.filter((word): word is TranscriptWordData => Boolean(word));
}

function distributeWords(segment: {
	text: string;
	startSec: number;
	endSec: number;
}) {
	const tokens = segment.text.trim().split(/\s+/).filter(Boolean);
	if (!tokens.length || segment.endSec <= segment.startSec) return [];

	const duration = segment.endSec - segment.startSec;
	return tokens.map((word, index) => {
		const startSec = segment.startSec + (duration * index) / tokens.length;
		const endSec = segment.startSec + (duration * (index + 1)) / tokens.length;
		return { word, startSec, endSec };
	});
}

export function normalizeTranscriptSegment(
	segment: RawTranscriptSegment,
	index: number,
): TranscriptSegmentData {
	const startSec = toFiniteNumber(segment.startSec ?? segment.from) ?? 0;
	const endSec = Math.max(
		startSec,
		toFiniteNumber(segment.endSec ?? segment.to) ?? startSec,
	);
	const normalized = {
		id: segment.id ?? index,
		startSec,
		endSec,
		text: segment.text,
	};
	const words = normalizeTranscriptWords(segment.words);

	return {
		...normalized,
		words: words.length > 0 ? words : distributeWords(normalized),
	};
}

export function findActiveSegmentIndex(
	segments: TranscriptSegmentData[],
	positionSec: number,
) {
	let low = 0;
	let high = segments.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const segment = segments[mid];
		if (!segment) break;

		if (positionSec < segment.startSec) {
			high = mid - 1;
		} else if (positionSec >= segment.endSec) {
			low = mid + 1;
		} else {
			return mid;
		}
	}

	const previousIndex = low - 1;
	if (previousIndex >= 0 && previousIndex < segments.length) {
		return previousIndex;
	}

	return -1;
}

export function findActiveWordIndex(
	words: TranscriptWordData[] | undefined,
	positionSec: number,
) {
	if (!words?.length) return -1;

	let low = 0;
	let high = words.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const word = words[mid];
		if (!word) break;

		if (positionSec < word.startSec) {
			high = mid - 1;
		} else if (positionSec >= word.endSec) {
			low = mid + 1;
		} else {
			return mid;
		}
	}

	if (positionSec < words[0]!.startSec) return 0;
	return Math.min(words.length - 1, Math.max(0, low - 1));
}

function findWordOffset(text: string, word: string, fromOffset: number) {
	const trimmed = word.trim();
	if (!trimmed) return null;

	const exactIndex = text.indexOf(trimmed, fromOffset);
	if (exactIndex !== -1) return exactIndex;

	const looseWord = trimmed.replace(/\s+/g, " ");
	const looseIndex = text.indexOf(looseWord, fromOffset);
	return looseIndex === -1 ? null : looseIndex;
}

function getWordRangesForSegment(
	segment: TranscriptSegmentData,
	segmentIndex: number,
	segmentStartOffset: number,
) {
	const ranges: TranscriptWordRange[] = [];
	let nextSearchOffset = 0;

	for (const [wordIndex, word] of (segment.words ?? []).entries()) {
		const localStart = findWordOffset(
			segment.text,
			word.word,
			nextSearchOffset,
		);
		if (localStart == null) continue;

		const localEnd = Math.min(
			segment.text.length,
			localStart + word.word.trim().length,
		);
		nextSearchOffset = localEnd;

		ranges.push({
			segmentIndex,
			wordIndex,
			word,
			startOffset: segmentStartOffset + localStart,
			endOffset: segmentStartOffset + localEnd,
		});
	}

	return ranges;
}

export function buildTranscriptDocument(
	segments: TranscriptSegmentData[],
): TranscriptDocument {
	let fullText = "";
	const segmentRanges: TranscriptSegmentRange[] = [];
	const wordRanges: TranscriptWordRange[] = [];
	const wordRangesBySegment: TranscriptWordRange[][] = [];

	segments.forEach((segment, index) => {
		if (index > 0) fullText += SEGMENT_SEPARATOR;

		const startOffset = fullText.length;
		fullText += segment.text;
		const endOffset = fullText.length;
		const segmentWordRanges = getWordRangesForSegment(
			segment,
			index,
			startOffset,
		);

		segmentRanges.push({ index, segment, startOffset, endOffset });
		wordRangesBySegment[index] = segmentWordRanges;
		wordRanges.push(...segmentWordRanges);
	});

	return {
		fullText,
		segments,
		segmentRanges,
		wordRanges,
		wordRangesBySegment,
	};
}

function offsetInsideRange(
	offset: number,
	startOffset: number,
	endOffset: number,
) {
	return offset >= startOffset && offset < endOffset;
}

function getSegmentRangeAtOffset(document: TranscriptDocument, offset: number) {
	const direct = document.segmentRanges.find((range) =>
		offsetInsideRange(offset, range.startOffset, range.endOffset),
	);
	if (direct) return direct;

	return (
		document.segmentRanges.find((range) => offset <= range.endOffset) ??
		document.segmentRanges.at(-1) ??
		null
	);
}

function getWordRangeAtOffset(document: TranscriptDocument, offset: number) {
	return (
		document.wordRanges.find((range) =>
			offsetInsideRange(offset, range.startOffset, range.endOffset),
		) ?? null
	);
}

function resolveTimestampAtOffset(
	document: TranscriptDocument,
	offset: number,
) {
	const wordRange = getWordRangeAtOffset(document, offset);
	if (wordRange) return wordRange.word.startSec;

	const segmentRange = getSegmentRangeAtOffset(document, offset);
	return segmentRange?.segment.startSec ?? 0;
}

function getIntersectingSegmentIndexes(
	document: TranscriptDocument,
	startOffset: number,
	endOffset: number,
) {
	const ranges = document.segmentRanges.filter(
		(range) => range.startOffset < endOffset && range.endOffset > startOffset,
	);

	return {
		startSegmentIndex: ranges[0]?.index ?? 0,
		endSegmentIndex: ranges.at(-1)?.index ?? ranges[0]?.index ?? 0,
	};
}

export function buildTranscriptTextSelection(
	document: TranscriptDocument,
	selectionStartOffset: number,
	selectionEndOffset: number,
	collapsedDragStartOffset: number | null,
): TranscriptTextSelection | null {
	const startOffset = Math.max(
		0,
		Math.min(selectionStartOffset, selectionEndOffset),
	);
	const endOffset = Math.min(
		document.fullText.length,
		Math.max(selectionStartOffset, selectionEndOffset),
	);

	if (endOffset <= startOffset) return null;

	const text = document.fullText.slice(startOffset, endOffset);
	if (!text.trim()) return null;

	const hasUsableDragStart =
		collapsedDragStartOffset != null &&
		collapsedDragStartOffset >= startOffset &&
		collapsedDragStartOffset <= endOffset;
	const dragStartOffset = hasUsableDragStart
		? collapsedDragStartOffset
		: startOffset;
	const { startSegmentIndex, endSegmentIndex } = getIntersectingSegmentIndexes(
		document,
		startOffset,
		endOffset,
	);

	return {
		text,
		startOffset,
		endOffset,
		dragStartOffset,
		startSegmentIndex,
		endSegmentIndex,
		timestampSec: resolveTimestampAtOffset(document, dragStartOffset),
	};
}

export function selectTranscriptSegment(
	document: TranscriptDocument,
	segment: TranscriptSegmentData,
): TranscriptTextSelection | null {
	const range = document.segmentRanges.find(
		(candidate) =>
			candidate.segment.id === segment.id ||
			(candidate.segment.startSec === segment.startSec &&
				candidate.segment.endSec === segment.endSec &&
				candidate.segment.text === segment.text),
	);

	if (!range) return null;

	return buildTranscriptTextSelection(
		document,
		range.startOffset,
		range.endOffset,
		range.startOffset,
	);
}
