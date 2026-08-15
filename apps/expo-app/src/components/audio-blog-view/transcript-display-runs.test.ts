import { describe, expect, test } from "bun:test";

import { buildTranscriptDisplayRuns } from "./transcript-display-runs";
import {
	type TranscriptSegmentData,
	buildTranscriptDocument,
} from "./transcript-timing";

const arabicSegments: TranscriptSegmentData[] = [
	{
		id: "arabic-1",
		startSec: 0,
		endSec: 4,
		text: "قال  هذه السورة",
		words: [
			{ word: "قال", startSec: 0, endSec: 1 },
			{ word: "هذه", startSec: 1, endSec: 2.5 },
			{ word: "السورة", startSec: 2.5, endSec: 4 },
		],
	},
	{
		id: "arabic-2",
		startSec: 4,
		endSec: 8,
		text: "لَك أن تَقْرَأَ من كلِّ القرآن",
		words: [
			{ word: "لَك", startSec: 4, endSec: 4.8 },
			{ word: "أن", startSec: 4.8, endSec: 5.4 },
			{ word: "تَقْرَأَ", startSec: 5.4, endSec: 6.2 },
			{ word: "من", startSec: 6.2, endSec: 6.8 },
			{ word: "كلِّ", startSec: 6.8, endSec: 7.3 },
			{ word: "القرآن", startSec: 7.3, endSec: 8 },
		],
	},
];

describe("transcript display runs", () => {
	test("preserves exact Arabic text while exposing stable timed word ranges", () => {
		const document = buildTranscriptDocument(arabicSegments);
		const segments = buildTranscriptDisplayRuns(document);

		expect(
			segments.map((segment) => segment.runs.map((run) => run.text).join("")),
		).toEqual(arabicSegments.map((segment) => segment.text));
		expect(segments[0]?.runs).toEqual([
			expect.objectContaining({ text: "قال", wordIndex: 0 }),
			expect.objectContaining({ text: "  ", wordIndex: null }),
			expect.objectContaining({ text: "هذه", wordIndex: 1 }),
			expect.objectContaining({ text: " ", wordIndex: null }),
			expect.objectContaining({ text: "السورة", wordIndex: 2 }),
		]);
		expect(segments[1]?.runs.map((run) => run.text).join("")).toBe(
			"لَك أن تَقْرَأَ من كلِّ القرآن",
		);
	});

	test("preserves punctuation, repeated words, and segments without word timings", () => {
		const source: TranscriptSegmentData[] = [
			{
				id: "repeated",
				startSec: 0,
				endSec: 3,
				text: "قال، قال  قال",
				words: [
					{ word: "قال", startSec: 0, endSec: 1 },
					{ word: "قال", startSec: 1, endSec: 2 },
					{ word: "قال", startSec: 2, endSec: 3 },
				],
			},
			{
				id: "untimed",
				startSec: 3,
				endSec: 5,
				text: "  بِلَا تَوْقِيتٍ  ",
			},
		];
		const display = buildTranscriptDisplayRuns(buildTranscriptDocument(source));

		expect(
			display.map((segment) => segment.runs.map((run) => run.text).join("")),
		).toEqual(source.map((segment) => segment.text));
		expect(
			display[0]?.runs.filter((run) => run.wordIndex != null),
		).toHaveLength(3);
		expect(display[1]?.runs).toEqual([
			expect.objectContaining({ text: "  بِلَا تَوْقِيتٍ  ", wordIndex: null }),
		]);
	});

	test("keeps segment keys stable when an earlier window is prepended", () => {
		const laterSegment: TranscriptSegmentData = {
			startSec: 30,
			endSec: 35,
			text: "المقطع الحالي",
		};
		const before = buildTranscriptDisplayRuns(
			buildTranscriptDocument([laterSegment]),
		);
		const after = buildTranscriptDisplayRuns(
			buildTranscriptDocument([
				{ startSec: 25, endSec: 30, text: "المقطع السابق" },
				{ ...laterSegment, text: "الْمَقْطَعُ الْحَالِي" },
			]),
		);

		expect(before[0]?.key).toBe(after[1]?.key);
	});
});
