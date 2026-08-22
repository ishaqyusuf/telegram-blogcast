import {
	isWorkerAuthorized,
	unauthorizedWorkerResponse,
} from "@/lib/transcription-worker-http";
import { getTranscriptionQueueControlState } from "@api/transcription-queue-control";

export async function POST(request: Request) {
	if (!isWorkerAuthorized(request)) return unauthorizedWorkerResponse();

	return Response.json({ ok: true, ...getTranscriptionQueueControlState() });
}
