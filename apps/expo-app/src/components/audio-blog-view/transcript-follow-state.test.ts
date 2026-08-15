import { describe, expect, test } from "bun:test";

import { resolveTranscriptScrollBehavior } from "./transcript-follow-state";

describe("transcript follow positioning", () => {
	test("jumps initially, follows later segment changes, and stays still while paused", () => {
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: false,
				follow: true,
				activeSegmentIndex: 120,
				previousActiveSegmentIndex: -1,
			}),
		).toBe("instant");
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: true,
				follow: true,
				activeSegmentIndex: 121,
				previousActiveSegmentIndex: 120,
			}),
		).toBe("smooth");
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: true,
				follow: true,
				activeSegmentIndex: 121,
				previousActiveSegmentIndex: 121,
			}),
		).toBeNull();
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: true,
				follow: false,
				activeSegmentIndex: 122,
				previousActiveSegmentIndex: 121,
			}),
		).toBeNull();
	});
});
