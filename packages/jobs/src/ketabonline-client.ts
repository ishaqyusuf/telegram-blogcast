import { createHash } from "node:crypto";
import {
	KETABONLINE_API_BASE,
	KETABONLINE_LIMITS,
	KetabOnlineError,
	ketabOnlineArchiveEntryName,
	normalizeKetabOnlineIndexPart,
	normalizeKetabOnlineMetadata,
	normalizeKetabOnlineSearch,
	validateKetabOnlineContentUrl,
} from "@acme/document/book/ketabonline";
import { Uint8ArrayReader, ZipReader } from "@zip.js/zip.js";

// Sized from the verified large sample (5.3 MB ZIP, 70 MB JSON) with headroom; the worker
// machine is allocated for the uncompressed limit.
export const KETABONLINE_TRANSFER_LIMITS = {
	jsonResponseBytes: 8 * 1024 * 1024,
	archiveBytes: 64 * 1024 * 1024,
	archiveEntryBytes: 160 * 1024 * 1024,
	requestTimeoutMs: 20_000,
	archiveTimeoutMs: 120_000,
	attempts: 3,
} as const;

type FetchLike = typeof fetch;

export type KetabOnlineClientOptions = {
	fetch?: FetchLike;
	sleep?: (ms: number) => Promise<void>;
	signal?: AbortSignal;
	/** Interactive API calls use one short attempt; the worker keeps the bounded retry budget. */
	attempts?: number;
	requestTimeoutMs?: number;
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readLimited(response: Response, maxBytes: number) {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maxBytes)
		throw new KetabOnlineError("too_large", "KetabOnline returned more data than this import supports.");
	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel().catch(() => {});
			throw new KetabOnlineError("too_large", "KetabOnline returned more data than this import supports.");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export function createKetabOnlineClient(options: KetabOnlineClientOptions = {}) {
	const fetchImpl = options.fetch ?? fetch;
	const sleep = options.sleep ?? delay;
	const attempts = Math.max(1, Math.min(KETABONLINE_TRANSFER_LIMITS.attempts, options.attempts ?? KETABONLINE_TRANSFER_LIMITS.attempts));
	const requestTimeoutMs = options.requestTimeoutMs ?? KETABONLINE_TRANSFER_LIMITS.requestTimeoutMs;

	/** Bounded request with timeout, redirect refusal and limited backoff for 429/5xx. */
	async function request(url: URL, input: { timeoutMs: number; maxBytes: number; accept: string }) {
		let lastError: unknown;
		for (let attempt = 1; attempt <= attempts; attempt++) {
			const timeout = AbortSignal.timeout(input.timeoutMs);
			const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
			try {
				const response = await fetchImpl(url, {
					headers: { accept: input.accept },
					redirect: "manual",
					signal,
				});
				if (response.status >= 300 && response.status < 400)
					throw new KetabOnlineError("invalid_response", "KetabOnline redirected to an unverified location.");
				if (response.status === 404)
					throw new KetabOnlineError("not_found", "This book is not available on KetabOnline.");
				if (response.status === 429 || response.status >= 500) {
					const error = new KetabOnlineError(
						response.status === 429 ? "rate_limited" : "upstream",
						response.status === 429
							? "KetabOnline is limiting requests. Try again shortly."
							: "KetabOnline is temporarily unavailable. Try again shortly.",
						true,
					);
					await response.body?.cancel().catch(() => {});
					throw error;
				}
				if (!response.ok)
					throw new KetabOnlineError("upstream", `KetabOnline rejected the request (${response.status}).`);
				return { response, bytes: await readLimited(response, input.maxBytes) };
			} catch (error) {
				lastError =
					error instanceof KetabOnlineError
						? error
						: options.signal?.aborted
							? error
							: new KetabOnlineError("upstream", "KetabOnline could not be reached. Try again shortly.", true);
				const retryable = lastError instanceof KetabOnlineError && lastError.retryable;
				if (!retryable || attempt === attempts || options.signal?.aborted) break;
				await sleep(Math.min(8_000, 500 * 2 ** attempt));
			}
		}
		throw lastError;
	}

	async function getJson(path: string, params?: Record<string, string>) {
		const url = new URL(`${KETABONLINE_API_BASE}${path}`);
		for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
		const { bytes } = await request(url, {
			timeoutMs: requestTimeoutMs,
			maxBytes: KETABONLINE_TRANSFER_LIMITS.jsonResponseBytes,
			accept: "application/json",
		});
		try {
			return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
		} catch {
			// The service answers some failures with an HTML page and HTTP 200.
			throw new KetabOnlineError("invalid_response", "KetabOnline returned an unreadable response.", true);
		}
	}

	return {
		async search(input: { query: string; page: number; limit: number }) {
			const query = input.query.trim().slice(0, KETABONLINE_LIMITS.maxSearchQueryLength);
			return normalizeKetabOnlineSearch(
				await getJson("/books", {
					q: query,
					page: String(Math.max(1, Math.min(500, Math.trunc(input.page)))),
					limit: String(Math.max(1, Math.min(KETABONLINE_LIMITS.maxSearchLimit, Math.trunc(input.limit)))),
				}),
			);
		},

		async metadata(bookId: number) {
			return normalizeKetabOnlineMetadata(await getJson(`/books/${bookId}`), bookId);
		},

		async indexPart(bookId: number, partName: string) {
			return normalizeKetabOnlineIndexPart(
				await getJson(`/books/${bookId}/index`, { is_recursive: "1", part: partName }),
				{ bookId, partName },
			);
		},

		/** Downloads the content ZIP and returns its single validated JSON member as text. */
		async archive(contentUrl: string, bookId: number) {
			const url = validateKetabOnlineContentUrl(contentUrl, bookId);
			const { bytes } = await request(url, {
				timeoutMs: KETABONLINE_TRANSFER_LIMITS.archiveTimeoutMs,
				maxBytes: KETABONLINE_TRANSFER_LIMITS.archiveBytes,
				accept: "application/zip",
			});
			const text = await extractArchiveJson(bytes, bookId);
			return {
				text,
				archiveBytes: bytes.byteLength,
				archiveSha256: createHash("sha256").update(bytes).digest("hex"),
			};
		},
	};
}

export type KetabOnlineClient = ReturnType<typeof createKetabOnlineClient>;

export async function extractArchiveJson(bytes: Uint8Array, bookId: number) {
	const expected = ketabOnlineArchiveEntryName(bookId);
	const reader = new ZipReader(new Uint8ArrayReader(bytes), { useWebWorkers: false });
	try {
		let entries;
		try {
			entries = await reader.getEntries();
		} catch {
			throw new KetabOnlineError("invalid_archive", "The book archive is corrupt.", true);
		}
		const files = entries.filter((entry) => !entry.directory);
		// Exact-name matching also rejects traversal names such as ../x.json.
		if (files.length !== 1 || files[0]?.filename !== expected)
			throw new KetabOnlineError("invalid_archive", "The book archive has unexpected contents.");
		const entry = files[0];
		if (entry.uncompressedSize > KETABONLINE_TRANSFER_LIMITS.archiveEntryBytes)
			throw new KetabOnlineError("too_large", "This book is larger than the import limit.");
		const chunks: Uint8Array[] = [];
		let total = 0;
		// Count inflated bytes as they stream so a lying size header cannot exhaust memory.
		const sink = new WritableStream<Uint8Array>({
			write(chunk) {
				total += chunk.byteLength;
				if (total > KETABONLINE_TRANSFER_LIMITS.archiveEntryBytes)
					throw new KetabOnlineError("too_large", "This book is larger than the import limit.");
				chunks.push(chunk);
			},
		});
		try {
			await entry.getData!(sink, { checkSignature: true });
		} catch (error) {
			if (error instanceof KetabOnlineError) throw error;
			if (total > KETABONLINE_TRANSFER_LIMITS.archiveEntryBytes)
				throw new KetabOnlineError("too_large", "This book is larger than the import limit.");
			throw new KetabOnlineError("invalid_archive", "The book archive is corrupt.", true);
		}
		const decoder = new TextDecoder("utf-8", { fatal: true });
		let text = "";
		try {
			for (const chunk of chunks) text += decoder.decode(chunk, { stream: true });
			text += decoder.decode();
		} catch {
			throw new KetabOnlineError("invalid_archive", "The book archive is not valid UTF-8 text.");
		}
		return text;
	} finally {
		await reader.close().catch(() => {});
	}
}
