import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

let databaseCalls = 0;

mock.module("@acme/db", () => ({
	db: {
		$transaction: async () => {
			databaseCalls += 1;
			throw new Error("Paused claims must not query the database.");
		},
		transcriptionJob: {
			updateMany: async () => {
				databaseCalls += 1;
				return { count: 1 };
			},
			findUnique: async () => ({
				id: 42,
				status: "queued",
				stage: "paused",
				currentChunk: 4,
			}),
		},
	},
}));

const originalWorkerToken = process.env.TRANSCRIPTION_WORKER_TOKEN;
process.env.TRANSCRIPTION_WORKER_TOKEN = "";

const { getTranscriptionQueueControlState, setTranscriptionQueuePaused } =
	await import("@api/transcription-queue-control");
const { POST: claimJob } = await import("../transcription-jobs/claim/route");
const { POST: pauseJob } = await import(
	"../transcription-jobs/[id]/pause/route"
);
const { POST: getQueueState } = await import("./state/route");

beforeEach(() => {
	databaseCalls = 0;
	setTranscriptionQueuePaused(false);
});

afterAll(() => {
	setTranscriptionQueuePaused(false);
	if (originalWorkerToken === undefined) {
		process.env.TRANSCRIPTION_WORKER_TOKEN = undefined;
	} else {
		process.env.TRANSCRIPTION_WORKER_TOKEN = originalWorkerToken;
	}
});

function workerRequest(path: string) {
	return new Request(`http://local.test${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ workerId: "worker-1" }),
	});
}

describe("Next transcription queue worker routes", () => {
	test("reports the shared queue pause state", async () => {
		setTranscriptionQueuePaused(true);

		const response = await getQueueState(
			workerRequest("/api/internal/transcription-queue/state"),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			isPaused: true,
		});
	});

	test("does not claim another job while the queue is paused", async () => {
		setTranscriptionQueuePaused(true);

		const response = await claimJob(
			workerRequest("/api/internal/transcription-jobs/claim"),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			job: null,
			isPaused: true,
		});
		expect(databaseCalls).toBe(0);
	});

	test("requeues the running job when the worker pauses between chunks", async () => {
		const response = await pauseJob(
			workerRequest("/api/internal/transcription-jobs/42/pause"),
			{ params: { id: "42" } },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			ok: true,
			job: { id: 42, status: "queued", stage: "paused", currentChunk: 4 },
		});
		expect(databaseCalls).toBe(1);
		expect(getTranscriptionQueueControlState()).toEqual({ isPaused: false });
	});
});
