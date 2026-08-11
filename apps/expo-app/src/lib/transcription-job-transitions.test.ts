import { describe, expect, test } from "bun:test";

import { getCompletedTranscriptJobTransitions } from "./transcription-job-transitions";

describe("transcription job completion transitions", () => {
	test("does not invalidate for completed jobs in the initial snapshot", () => {
		const result = getCompletedTranscriptJobTransitions(
			new Map(),
			[{ id: 1, status: "completed" }],
			false,
		);

		expect(result.completedJobIds).toEqual([]);
		expect(result.nextStatuses).toEqual(new Map([[1, "completed"]]));
	});

	test("detects queued and running jobs that become completed", () => {
		const result = getCompletedTranscriptJobTransitions(
			new Map([
				[1, "queued"],
				[2, "running"],
				[3, "completed"],
			]),
			[
				{ id: 1, status: "completed" },
				{ id: 2, status: "completed" },
				{ id: 3, status: "completed" },
			],
			true,
		);

		expect(result.completedJobIds).toEqual([1, 2]);
	});

	test("detects a newly appearing completed job after initialization", () => {
		const result = getCompletedTranscriptJobTransitions(
			new Map([[1, "running"]]),
			[
				{ id: 1, status: "running" },
				{ id: 2, status: "completed" },
			],
			true,
		);

		expect(result.completedJobIds).toEqual([2]);
	});
});
