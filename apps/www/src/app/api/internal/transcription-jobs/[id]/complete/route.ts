import { completeTranscriptionJob } from "@api/transcription-worker";
import {
    getParams,
    getWorkerIdFromBody,
    invalidJobIdResponse,
    isWorkerAuthorized,
    parseJobId,
    readJsonBody,
    transcriptionWorkerDb,
    unauthorizedWorkerResponse,
} from "@/lib/transcription-worker-http";

export async function POST(
    request: Request,
    context: { params: { id: string } | Promise<{ id: string }> },
) {
    if (!isWorkerAuthorized(request)) return unauthorizedWorkerResponse();

    const params = await getParams(context.params);
    const id = parseJobId(params.id);
    if (id == null) return invalidJobIdResponse();

    const body = await readJsonBody(request);
    const job = await completeTranscriptionJob(transcriptionWorkerDb, {
        id,
        workerId: getWorkerIdFromBody(body),
        segments: Array.isArray(body?.segments) ? body.segments : undefined,
    });

    if (!job) {
        return Response.json(
            { ok: false, error: "Transcription job not found." },
            { status: 404 },
        );
    }

    return Response.json({ ok: true, job });
}
