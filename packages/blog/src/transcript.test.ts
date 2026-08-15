import { describe, expect, test } from "bun:test";

import {
	TRANSCRIPT_TIMING_SOURCES,
	normalizeTranscriptTimingSource,
} from "./transcript";

describe("transcript timing contract", () => {
	test("normalizes measured and estimated timing provenance", () => {
		expect(TRANSCRIPT_TIMING_SOURCES).toEqual(["measured", "estimated"]);
		expect(normalizeTranscriptTimingSource("measured")).toBe("measured");
		expect(normalizeTranscriptTimingSource("estimated")).toBe("estimated");
		expect(
			normalizeTranscriptTimingSource(undefined, { estimated: true }),
		).toBe("estimated");
		expect(
			normalizeTranscriptTimingSource("legacy", { fallback: "measured" }),
		).toBe("measured");
	});
});
