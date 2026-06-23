import { saveTranscriptionJobChunk } from "@api/transcription-worker";
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

    try {
        const job = await saveTranscriptionJobChunk(transcriptionWorkerDb, {
            id,
            workerId: getWorkerIdFromBody(body),
            chunkStartSec: body?.chunkStartSec,
            chunkEndSec: body?.chunkEndSec,
            segments: Array.isArray(body?.segments) ? body.segments : [],
            progressPercent: body?.progressPercent,
            stage: body?.stage,
            currentChunk: body?.currentChunk,
            totalChunks: body?.totalChunks,
            model: typeof body?.model === "string" ? body.model : undefined,
        });

        if (!job) {
            return Response.json(
                {
                    ok: false,
                    error: "Transcription job is not claimed by this worker.",
                },
                { status: 409 },
            );
        }

        return Response.json({ ok: true, job });
    } catch (error) {
        return Response.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Invalid chunk.",
            },
            { status: 400 },
        );
    }
}
