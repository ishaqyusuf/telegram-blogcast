import { describe, expect, test } from "bun:test";

import {
	getTranscriptionQueueControlState,
	setTranscriptionQueuePaused,
} from "./transcription-queue-control";
import {
	DEFAULT_TRANSCRIPTION_WORKER_STALE_MS,
	pauseTranscriptionJob,
} from "./transcription-worker";

describe("transcription worker recovery", () => {
	test("reclaims interrupted work within thirty seconds by default", () => {
		expect(DEFAULT_TRANSCRIPTION_WORKER_STALE_MS).toBe(30_000);
	});

	test("stores queue pause state for claim and worker checks", () => {
		setTranscriptionQueuePaused(true);
		expect(getTranscriptionQueueControlState()).toEqual({ isPaused: true });
		setTranscriptionQueuePaused(false);
	});

	test("requeues a claimed job without clearing saved chunk progress", async () => {
		let updateInput: any;
		const db = {
			transcriptionJob: {
				updateMany: async (input: any) => {
					updateInput = input;
					return { count: 1 };
				},
				findUnique: async () => ({ id: 42, status: "queued", currentChunk: 4 }),
			},
		};

		const job = await pauseTranscriptionJob(db, {
			id: 42,
			workerId: "worker-1",
		});

		expect(updateInput.where).toMatchObject({ id: 42, status: "running" });
		expect(updateInput.data).toMatchObject({
			status: "queued",
			stage: "paused",
			workerId: null,
			lockedAt: null,
		});
		expect(updateInput.data.progressPercent).toBeUndefined();
		expect(updateInput.data.currentChunk).toBeUndefined();
		expect(job).toMatchObject({ id: 42, status: "queued", currentChunk: 4 });
	});
});
