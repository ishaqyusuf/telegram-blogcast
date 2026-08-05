type GatewayStatus = {
	state: "unavailable" | "fetchable" | "preparing" | "ready" | "error";
	progress?: number;
	error?: string;
};

export type LocalMediaPlaybackResult =
	| { state: "ready"; url: string }
	| { state: "unavailable"; url: null };

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_ATTEMPTS = 15 * 60;

function appendPath(baseUrl: string, path: string) {
	return `${baseUrl.trim().replace(/\/+$/, "")}${path}`;
}

export function buildLocalMediaStreamUrl(
	gatewayBaseUrl: string,
	mediaId: number,
	ticket: string,
) {
	return appendPath(
		gatewayBaseUrl,
		`/api/telegram/local-media/${mediaId}/stream?ticket=${encodeURIComponent(ticket)}`,
	);
}

async function readJson<T>(response: Response): Promise<T> {
	if (response.ok) return (await response.json()) as T;
	const body = (await response.json().catch(() => null)) as {
		error?: string;
	} | null;
	throw new Error(body?.error || `Local media request failed (${response.status}).`);
}

export async function prepareLocalMediaPlayback(input: {
	mediaId: number;
	productionBaseUrl: string;
	gatewayBaseUrl: string;
	fetchImpl?: typeof fetch;
	signal?: AbortSignal;
	sleep?: (milliseconds: number) => Promise<void>;
	onProgress?: (progress: number) => void;
}): Promise<LocalMediaPlaybackResult> {
	const fetchImpl = input.fetchImpl ?? fetch;
	const sleep =
		input.sleep ??
		((milliseconds: number) =>
			new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
	const ticketResponse = await fetchImpl(
		appendPath(
			input.productionBaseUrl,
			"/api/telegram/local-media/ticket",
		),
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mediaId: input.mediaId }),
			signal: input.signal,
		},
	);
	const { ticket } = await readJson<{ ticket: string }>(ticketResponse);
	if (!ticket) throw new Error("The media gateway did not issue a playback ticket.");

	const statusUrl = appendPath(
		input.gatewayBaseUrl,
		`/api/telegram/local-media/${input.mediaId}?ticket=${encodeURIComponent(ticket)}`,
	);
	const requestStatus = async (method = "GET") =>
		readJson<GatewayStatus>(
			await fetchImpl(statusUrl, {
				method,
				headers: {
					Accept: "application/json",
					"ngrok-skip-browser-warning": "1",
				},
				signal: input.signal,
			}),
		);

	let status = await requestStatus();
	if (status.state === "unavailable") {
		return { state: "unavailable", url: null };
	}
	if (status.state === "fetchable" || status.state === "error") {
		status = await requestStatus("POST");
	}

	for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
		input.onProgress?.(status.progress ?? 0);
		if (status.state === "ready") {
			return {
				state: "ready",
				url: buildLocalMediaStreamUrl(
					input.gatewayBaseUrl,
					input.mediaId,
					ticket,
				),
			};
		}
		if (status.state === "unavailable") {
			return { state: "unavailable", url: null };
		}
		if (status.state === "error") {
			throw new Error(status.error || "Local media preparation failed.");
		}
		if (input.signal?.aborted) throw new Error("Local media request was cancelled.");
		await sleep(DEFAULT_POLL_INTERVAL_MS);
		status = await requestStatus();
	}

	throw new Error("Local media preparation timed out.");
}
