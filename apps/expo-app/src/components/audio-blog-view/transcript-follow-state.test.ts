import { describe, expect, test } from "bun:test";

import { resolveTranscriptScrollBehavior } from "./transcript-follow-state";

describe("transcript follow positioning", () => {
	test("jumps initially, follows later segment changes, and stays still while paused", () => {
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: false,
				wasFollowing: true,
				follow: true,
				activeSegmentIndex: 120,
				previousActiveSegmentIndex: -1,
			}),
		).toBe("instant");
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: true,
				wasFollowing: true,
				follow: true,
				activeSegmentIndex: 121,
				previousActiveSegmentIndex: 120,
			}),
		).toBe("smooth");
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: true,
				wasFollowing: true,
				follow: true,
				activeSegmentIndex: 121,
				previousActiveSegmentIndex: 121,
			}),
		).toBeNull();
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: true,
				wasFollowing: true,
				follow: false,
				activeSegmentIndex: 122,
				previousActiveSegmentIndex: 121,
			}),
		).toBeNull();
	});

	test("Live resumes following with an immediate catch-up", () => {
		expect(
			resolveTranscriptScrollBehavior({
				hasPositioned: true,
				wasFollowing: false,
				follow: true,
				activeSegmentIndex: 120,
				previousActiveSegmentIndex: 30,
			}),
		).toBe("instant");
	});
});
