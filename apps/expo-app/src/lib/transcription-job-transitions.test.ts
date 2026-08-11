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

	test("handles an empty initial load before an external job completes", () => {
		const initial = getCompletedTranscriptJobTransitions(new Map(), [], false);
		const queued = getCompletedTranscriptJobTransitions(
			initial.nextStatuses,
			[{ id: 4, status: "queued" }],
			true,
		);
		const running = getCompletedTranscriptJobTransitions(
			queued.nextStatuses,
			[{ id: 4, status: "running" }],
			true,
		);
		const completed = getCompletedTranscriptJobTransitions(
			running.nextStatuses,
			[{ id: 4, status: "completed" }],
			true,
		);

		expect(initial.completedJobIds).toEqual([]);
		expect(queued.completedJobIds).toEqual([]);
		expect(running.completedJobIds).toEqual([]);
		expect(completed.completedJobIds).toEqual([4]);
	});

	test("treats a new completed job after an empty initial load as new", () => {
		const initial = getCompletedTranscriptJobTransitions(new Map(), [], false);
		const discovered = getCompletedTranscriptJobTransitions(
			initial.nextStatuses,
			[{ id: 5, status: "completed" }],
			true,
		);

		expect(discovered.completedJobIds).toEqual([5]);
	});
});
