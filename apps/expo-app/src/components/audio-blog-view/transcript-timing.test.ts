import { describe, expect, test } from "bun:test";

import {
	type TranscriptSegmentData,
	buildTranscriptDocument,
	buildTranscriptTextSelection,
	findActiveSegmentIndex,
	findActiveWordIndex,
	rebaseTranscriptTextSelection,
	selectTranscriptSegment,
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

		expect(document.fullText).toBe("alpha beta\n\ngamma delta\n\nepsilon zeta");
		expect(document.segmentRanges).toEqual([
			expect.objectContaining({ index: 0, startOffset: 0, endOffset: 10 }),
			expect.objectContaining({ index: 1, startOffset: 12, endOffset: 23 }),
			expect.objectContaining({ index: 2, startOffset: 25, endOffset: 37 }),
		]);
		expect(document.wordRangesBySegment.map((ranges) => ranges.length)).toEqual(
			[2, 2, 2],
		);
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

	test("uses the original drag anchor for a backward multi-segment selection", () => {
		const document = buildTranscriptDocument(segments);
		const betaStart = document.fullText.indexOf("beta");
		const zetaEnd = document.fullText.indexOf("zeta") + "zeta".length;

		const selection = buildTranscriptTextSelection(
			document,
			zetaEnd,
			betaStart,
			zetaEnd,
		);

		expect(selection).toEqual(
			expect.objectContaining({
				text: "beta\n\ngamma delta\n\nepsilon zeta",
				dragStartOffset: zetaEnd,
				timestampSec: 25,
			}),
		);
	});

	test("ignores separator-only selections", () => {
		const document = buildTranscriptDocument(segments);
		const separatorStart = document.segmentRanges[0]!.endOffset;
		const separatorEnd = document.segmentRanges[1]!.startOffset;

		expect(
			buildTranscriptTextSelection(
				document,
				separatorStart,
				separatorEnd,
				null,
			),
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

	test("rebases a selection when an earlier transcript window is prepended", () => {
		const previousDocument = buildTranscriptDocument(segments.slice(1));
		const selection = buildTranscriptTextSelection(
			previousDocument,
			previousDocument.fullText.indexOf("delta"),
			previousDocument.fullText.indexOf("zeta") + "zeta".length,
			previousDocument.fullText.indexOf("epsilon"),
		);
		const nextDocument = buildTranscriptDocument(segments);

		expect(
			rebaseTranscriptTextSelection(previousDocument, nextDocument, selection),
		).toEqual(
			expect.objectContaining({
				text: "delta\n\nepsilon zeta",
				startSegmentIndex: 1,
				endSegmentIndex: 2,
				timestampSec: 20,
			}),
		);
	});

	test("does not mistake shifted fallback ids for stable segment identity", () => {
		const previousSegments = segments.slice(1).map((segment, index) => ({
			...segment,
			id: index,
		}));
		const nextSegments = segments.map((segment, index) => ({
			...segment,
			id: index,
		}));
		const previousDocument = buildTranscriptDocument(previousSegments);
		const selectedSegment = previousSegments[0];
		if (!selectedSegment) throw new Error("Expected transcript fixture");
		const selection = selectTranscriptSegment(
			previousDocument,
			selectedSegment,
		);

		expect(
			rebaseTranscriptTextSelection(
				previousDocument,
				buildTranscriptDocument(nextSegments),
				selection,
			),
		).toEqual(
			expect.objectContaining({
				text: "gamma delta",
				startSegmentIndex: 1,
				timestampSec: 10,
			}),
		);
	});

	test("preserves selection endpoints inside a segment separator", () => {
		const previousDocument = buildTranscriptDocument(segments.slice(1));
		const firstRange = previousDocument.segmentRanges[0];
		if (!firstRange) throw new Error("Expected transcript fixture");
		const separatorOffset = firstRange.endOffset + 1;
		const selection = buildTranscriptTextSelection(
			previousDocument,
			separatorOffset,
			previousDocument.fullText.length,
			separatorOffset,
		);
		const nextDocument = buildTranscriptDocument(segments);
		const nextFirstRange = nextDocument.segmentRanges[1];
		if (!nextFirstRange)
			throw new Error("Expected prepended transcript fixture");

		expect(
			rebaseTranscriptTextSelection(previousDocument, nextDocument, selection),
		).toEqual(
			expect.objectContaining({
				text: "\nepsilon zeta",
				startOffset: nextFirstRange.endOffset + 1,
			}),
		);
	});
});
