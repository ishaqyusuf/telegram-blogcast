import { getLocalTranscriberUrl, isPrivateNetworkHost } from "@/lib/base-url";

const envBaseUrl = process.env.EXPO_PUBLIC_TRANSCRIBER_URL;
const TRANSCRIBER_PLACEHOLDER_TOKENS = ["YOUR_MAC_LAN_IP", "YOUR_DEVICE_IP"];

function normalizeTranscriberUrl(value?: string | null) {
	const normalized = value?.trim().replace(/\/+$/, "");
	if (!normalized) return null;
	if (isPlaceholderTranscriberUrl(normalized)) return null;
	try {
		if (!isPrivateNetworkHost(new URL(normalized).hostname)) return null;
	} catch {
		return null;
	}
	return normalized;
}

export function isPlaceholderTranscriberUrl(value?: string | null) {
	if (!value) return false;
	const upper = value.toUpperCase();
	return TRANSCRIBER_PLACEHOLDER_TOKENS.some((token) => upper.includes(token));
}

export function getDefaultTranscriberUrl(savedUrl?: string | null) {
	try {
		return getLocalTranscriberUrl();
	} catch {}
	const saved = normalizeTranscriberUrl(savedUrl);
	if (saved) return saved;
	const env = normalizeTranscriberUrl(envBaseUrl);
	if (env) return env;
	return null;
}

export function isHttpTranscriberUrl(value?: string | null) {
	if (!value || isPlaceholderTranscriberUrl(value)) return false;
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

export async function checkTranscriberHealth(
	baseUrl = getDefaultTranscriberUrl(),
): Promise<boolean> {
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
	} catch {
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
