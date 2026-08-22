import {
	TRANSCRIPTION_WORKER_MAX_RETRIES,
	TRANSCRIPTION_WORKER_STALE_MS,
	getWorkerIdFromBody,
	isWorkerAuthorized,
	readJsonBody,
	transcriptionWorkerDb,
	unauthorizedWorkerResponse,
} from "@/lib/transcription-worker-http";
import { getTranscriptionQueueControlState } from "@api/transcription-queue-control";
import { claimNextTranscriptionJob } from "@api/transcription-worker";

export async function POST(request: Request) {
	if (!isWorkerAuthorized(request)) return unauthorizedWorkerResponse();

	const body = await readJsonBody(request);
	if (getTranscriptionQueueControlState().isPaused) {
		return Response.json({ ok: true, job: null, isPaused: true });
	}
	const job = await claimNextTranscriptionJob(transcriptionWorkerDb, {
		workerId: getWorkerIdFromBody(body),
		staleMs: TRANSCRIPTION_WORKER_STALE_MS,
		maxRetries: TRANSCRIPTION_WORKER_MAX_RETRIES,
		jobId: Number.isInteger(body?.jobId) ? body.jobId : undefined,
	});

	return Response.json({ ok: true, job });
}
