import { describe, expect, test } from "bun:test";

import { SELECTABLE_TRANSCRIPT_HTML } from "./selectable-transcript-html";
import {
	createTranscriptHydrateMessage,
	parseTranscriptSurfaceMessage,
} from "./selectable-transcript-protocol";
import {
	type TranscriptSegmentData,
	buildTranscriptDocument,
} from "./transcript-timing";

const segments: TranscriptSegmentData[] = [
	{
		id: "first",
		startSec: 10,
		endSec: 20,
		text: "قال <script>alert('no')</script>",
		words: [{ word: "قال", startSec: 10, endSec: 12 }],
	},
];

describe("selectable transcript protocol", () => {
	test("keeps transcript content in typed hydrate data instead of executable markup", () => {
		const document = buildTranscriptDocument(segments);
		const message = createTranscriptHydrateMessage({
			document,
			activeSegmentIndex: 0,
			activeWordIndex: 0,
			follow: true,
			initial: true,
			presentation: "read",
			selectionEnabled: true,
			contentPaddingVertical: 120,
			selection: null,
		});

		expect(message.type).toBe("hydrate");
		expect(message.segments[0]?.runs.map((run) => run.text).join("")).toBe(
			"قال <script>alert('no')</script>",
		);
		expect(SELECTABLE_TRANSCRIPT_HTML).not.toContain(
			"<script>alert('no')</script>",
		);
		expect(message.segments[0]?.separatorBefore).toBe("");
		expect(SELECTABLE_TRANSCRIPT_HTML).toContain(
			"createTextNode(segment.separatorBefore)",
		);
		expect(SELECTABLE_TRANSCRIPT_HTML).toContain(
			"message.initial || shouldFollowActive",
		);
	});

	test("changes the document key when same-length transcript text changes", () => {
		const sourceSegment = segments[0];
		if (!sourceSegment) throw new Error("Expected transcript fixture");
		const buildMessage = (text: string) =>
			createTranscriptHydrateMessage({
				document: buildTranscriptDocument([
					{ ...sourceSegment, text, words: [] },
				]),
				activeSegmentIndex: 0,
				activeWordIndex: -1,
				follow: true,
				initial: true,
				presentation: "read",
				selectionEnabled: true,
				contentPaddingVertical: 120,
				selection: null,
			});

		expect(buildMessage("قال").documentKey).not.toBe(
			buildMessage("ذهب").documentKey,
		);
	});

	test("accepts valid range events and rejects malformed or unknown messages", () => {
		expect(
			parseTranscriptSurfaceMessage(
				JSON.stringify({
					type: "selection",
					startOffset: 4,
					endOffset: 18,
					dragStartOffset: 18,
				}),
			),
		).toEqual({
			type: "selection",
			startOffset: 4,
			endOffset: 18,
			dragStartOffset: 18,
		});
		expect(parseTranscriptSurfaceMessage("not json")).toBeNull();
		expect(
			parseTranscriptSurfaceMessage(
				JSON.stringify({ type: "selection", startOffset: "4", endOffset: 18 }),
			),
		).toBeNull();
		expect(
			parseTranscriptSurfaceMessage(JSON.stringify({ type: "run-code" })),
		).toBeNull();
		expect(
			parseTranscriptSurfaceMessage(
				JSON.stringify({ type: "long-press-segment", index: 3 }),
			),
		).toEqual({ type: "long-press-segment", index: 3 });
		expect(
			parseTranscriptSurfaceMessage(
				JSON.stringify({
					type: "selection",
					startOffset: -1,
					endOffset: 2,
					dragStartOffset: 2,
				}),
			),
		).toBeNull();
	});
});
