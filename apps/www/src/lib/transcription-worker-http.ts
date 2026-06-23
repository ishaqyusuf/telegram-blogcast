import { db } from "@acme/db";
import { getWorkerIdFromBody } from "@api/transcription-worker";

export const transcriptionWorkerDb = db as any;

export const TRANSCRIPTION_WORKER_STALE_MS = Number.parseInt(
    process.env.TRANSCRIPTION_WORKER_STALE_MS ?? `${10 * 60 * 1000}`,
    10,
);

export const TRANSCRIPTION_WORKER_MAX_RETRIES = Number.parseInt(
    process.env.TRANSCRIPTION_WORKER_MAX_RETRIES ?? "3",
    10,
);

export async function readJsonBody(request: Request) {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

export function isWorkerAuthorized(request: Request) {
    const token = process.env.TRANSCRIPTION_WORKER_TOKEN;
    if (!token) return true;

    const header = request.headers.get("authorization") ?? "";
    return header === `Bearer ${token}`;
}

export function unauthorizedWorkerResponse() {
    return Response.json({ ok: false, error: "Unauthorized worker." }, { status: 401 });
}

export function parseJobId(value: string) {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) ? id : null;
}

export function invalidJobIdResponse() {
    return Response.json(
        { ok: false, error: "Invalid transcription job id." },
        { status: 400 },
    );
}

export async function getParams<T extends Record<string, string>>(
    params: T | Promise<T>,
) {
    return params instanceof Promise ? params : Promise.resolve(params);
}

export { getWorkerIdFromBody };
