import { describe, expect, test } from "bun:test";

import {
	buildTranscriptDocument,
	buildTranscriptTextSelection,
	findActiveSegmentIndex,
	findActiveWordIndex,
	selectTranscriptSegment,
	type TranscriptSegmentData,
} from "./transcript-timing";

const segments: TranscriptSegmentData[] = [
	{
		id: "chunk-0-line-0",
		startSec: 0,
		endSec: 10,
		text: "alpha beta",
		words: [
			{ word: "alpha", startSec: 0, endSec: 5 },
			{ word: "beta", startSec: 5, endSec: 10 },
		],
	},
	{
		id: "chunk-0-line-1",
		startSec: 10,
		endSec: 20,
		text: "gamma delta",
		words: [
			{ word: "gamma", startSec: 10, endSec: 15 },
			{ word: "delta", startSec: 15, endSec: 20 },
		],
	},
	{
		id: "chunk-1-line-0",
		startSec: 20,
		endSec: 30,
		text: "epsilon zeta",
		words: [
			{ word: "epsilon", startSec: 20, endSec: 25 },
			{ word: "zeta", startSec: 25, endSec: 30 },
		],
	},
];

describe("transcript timing helpers", () => {
	test("builds one continuous document across transcript chunks", () => {
		const document = buildTranscriptDocument(segments);

		expect(document.fullText).toBe(
			"alpha beta\n\ngamma delta\n\nepsilon zeta",
		);
		expect(document.segmentRanges).toEqual([
			expect.objectContaining({ index: 0, startOffset: 0, endOffset: 10 }),
			expect.objectContaining({ index: 1, startOffset: 12, endOffset: 23 }),
			expect.objectContaining({ index: 2, startOffset: 25, endOffset: 37 }),
		]);
		expect(document.wordRangesBySegment.map((ranges) => ranges.length)).toEqual([
			2, 2, 2,
		]);
	});

	test("resolves selection metadata across segment and chunk boundaries", () => {
		const document = buildTranscriptDocument(segments);
		const startOffset = document.fullText.indexOf("beta");
		const endOffset = document.fullText.indexOf("zeta") + "zeta".length;
		const dragStartOffset = document.fullText.indexOf("epsilon");

		const selection = buildTranscriptTextSelection(
			document,
			startOffset,
			endOffset,
			dragStartOffset,
		);

		expect(selection).toEqual(
			expect.objectContaining({
				text: "beta\n\ngamma delta\n\nepsilon zeta",
				startOffset,
				endOffset,
				dragStartOffset,
				startSegmentIndex: 0,
				endSegmentIndex: 2,
				timestampSec: 20,
			}),
		);
	});

	test("ignores separator-only selections", () => {
		const document = buildTranscriptDocument(segments);
		const separatorStart = document.segmentRanges[0]!.endOffset;
		const separatorEnd = document.segmentRanges[1]!.startOffset;

		expect(
			buildTranscriptTextSelection(document, separatorStart, separatorEnd, null),
		).toBeNull();
	});

	test("selects a full segment using stable transcript identity", () => {
		const document = buildTranscriptDocument(segments);

		const selection = selectTranscriptSegment(document, {
			...segments[1]!,
			text: "gamma delta",
		});

		expect(selection).toEqual(
			expect.objectContaining({
				text: "gamma delta",
				startSegmentIndex: 1,
				endSegmentIndex: 1,
				timestampSec: 10,
			}),
		);
	});

	test("finds active segment and word at boundaries", () => {
		expect(findActiveSegmentIndex(segments, 0)).toBe(0);
		expect(findActiveSegmentIndex(segments, 10)).toBe(1);
		expect(findActiveSegmentIndex(segments, 30)).toBe(2);
		expect(findActiveWordIndex(segments[1]!.words, 10)).toBe(0);
		expect(findActiveWordIndex(segments[1]!.words, 15)).toBe(1);
		expect(findActiveWordIndex(segments[1]!.words, 20)).toBe(1);
	});
});
