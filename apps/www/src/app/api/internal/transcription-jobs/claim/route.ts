import { claimNextTranscriptionJob } from "@api/transcription-worker";
import {
    getWorkerIdFromBody,
    isWorkerAuthorized,
    readJsonBody,
    transcriptionWorkerDb,
    TRANSCRIPTION_WORKER_MAX_RETRIES,
    TRANSCRIPTION_WORKER_STALE_MS,
    unauthorizedWorkerResponse,
} from "@/lib/transcription-worker-http";

export async function POST(request: Request) {
    if (!isWorkerAuthorized(request)) return unauthorizedWorkerResponse();

    const body = await readJsonBody(request);
    const job = await claimNextTranscriptionJob(transcriptionWorkerDb, {
        workerId: getWorkerIdFromBody(body),
        staleMs: TRANSCRIPTION_WORKER_STALE_MS,
        maxRetries: TRANSCRIPTION_WORKER_MAX_RETRIES,
        jobId: Number.isInteger(body?.jobId) ? body.jobId : undefined,
    });

    return Response.json({ ok: true, job });
}
