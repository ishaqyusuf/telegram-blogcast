import { getLocalTranscriberUrl } from "@/lib/base-url";

const envBaseUrl = process.env.EXPO_PUBLIC_TRANSCRIBER_URL;

export function getDefaultTranscriberUrl(savedUrl?: string | null) {
  if (savedUrl) return savedUrl.trim().replace(/\/+$/, "");
  if (envBaseUrl) return envBaseUrl.trim().replace(/\/+$/, "");
  try {
    return getLocalTranscriberUrl();
  } catch {
    return null;
  }
}

export function isHttpTranscriberUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export interface TranscribeRequest {
  audioUrl: string;
  from?: number;
  to?: number;
  language?: string;
  force?: boolean;
  wordTimestamps?: boolean;
}

export interface TranscribeSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscribeResponse {
  ok: boolean;
  cached: boolean;
  cacheKey: string;
  audioUrl: string;
  from?: number;
  to?: number;
  language: string;
  model: string;
  text: string;
  segments: TranscribeSegment[];
  durationSeconds: number;
  processingSeconds: number;
  error?: { code: string; message: string };
}

export class TranscribeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "TranscribeError";
  }
}

export async function checkTranscriberHealth(baseUrl = getDefaultTranscriberUrl()): Promise<boolean> {
  if (!baseUrl) {
    throw new TranscribeError(
      "NO_URL",
      "Local transcriber URL is not configured",
    );
  }

  try {
    const res = await fetch(`${baseUrl}/health`);
    return res.ok;
  } catch {
    throw new TranscribeError(
      "NETWORK_ERROR",
      `Could not reach transcriber at ${baseUrl}`,
    );
  }
}

export async function transcribeAudio(
  params: TranscribeRequest,
  baseUrl = getDefaultTranscriberUrl(),
): Promise<TranscribeResponse> {
  if (!baseUrl) {
    throw new TranscribeError(
      "NO_URL",
      "Local transcriber URL is not configured",
    );
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    throw new TranscribeError(
      "NETWORK_ERROR",
      `Could not reach transcriber at ${baseUrl}`,
    );
  }

  let json: TranscribeResponse;
  try {
    json = await res.json();
  } catch {
    throw new TranscribeError(
      "PARSE_ERROR",
      `Unexpected response from transcriber (HTTP ${res.status})`,
    );
  }

  if (!json.ok) {
    throw new TranscribeError(
      json.error?.code ?? "UNKNOWN",
      json.error?.message ?? "Transcription failed",
    );
  }

  return json;
}
