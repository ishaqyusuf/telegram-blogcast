import type {
	CachedTranscriptWindow,
	ServerTranscriptWindow,
	TranscriptCacheRepository,
} from "@/db/transcript-cache-repository";
import type { TranscriptCacheController } from "@/lib/transcript-cache-controller";

export const FULL_TRANSCRIPT_WINDOW_SEC = 300;

function sameRevision(
	window: CachedTranscriptWindow,
	server: ServerTranscriptWindow,
) {
	return window.transcriptId === (server.transcriptId ?? null) &&
		(window.transcriptUpdatedAt?.getTime() ?? null) ===
			(server.transcriptUpdatedAt?.getTime() ?? null);
}

export function isTranscriptRangeCached(
	windows: readonly CachedTranscriptWindow[],
	revision: ServerTranscriptWindow,
	startSec: number,
	endSec: number,
) {
	let coveredUntil = startSec;
	for (const window of windows
		.filter((candidate) => candidate.status === "done" && sameRevision(candidate, revision))
		.sort((a, b) => a.windowStartSec - b.windowStartSec)) {
		if (window.windowStartSec > coveredUntil) break;
		coveredUntil = Math.max(coveredUntil, window.windowEndSec);
		if (coveredUntil >= endSec) return true;
	}
	return false;
}

/** Fill the existing SQLite window cache once a saved transcript covers the audio. */
export async function cacheFullTranscript(input: {
	mediaId: number;
	cache: TranscriptCacheRepository;
	controller: TranscriptCacheController;
	fetchWindow: (startSec: number) => Promise<ServerTranscriptWindow>;
	isCurrent: () => boolean;
	onFirstWindow?: (window: ServerTranscriptWindow) => void;
}) {
	const requestWindow = async (startSec: number) => {
		const captured: { value: ServerTranscriptWindow | null } = { value: null };
		const outcome = await input.controller.requestWindow({
			mediaId: input.mediaId,
			startSec,
			endSec: startSec + FULL_TRANSCRIPT_WINDOW_SEC,
			fetchServer: () => input.fetchWindow(startSec),
			onCachedWindows: () => undefined,
			onServerWindow: (window) => { captured.value = window; },
			onServerError: () => undefined,
		});
		return outcome.status === "applied" ? captured.value : null;
	};

	if (!input.isCurrent()) return;
	const first = await requestWindow(0);
	if (first && input.isCurrent()) input.onFirstWindow?.(first);
	if (!first || !input.isCurrent() || !first.transcriptId || first.status !== "done") return;
	const durationSec = Math.max(first.durationSec ?? 0, first.maxEndSec ?? 0);
	if (durationSec <= 0 || (first.durationSec ?? 0) > 0 &&
		(first.maxEndSec ?? 0) < (first.durationSec ?? 0) - 3) return;
	const endSec = Math.ceil(durationSec / FULL_TRANSCRIPT_WINDOW_SEC) * FULL_TRANSCRIPT_WINDOW_SEC;
	const cached = await input.cache.readOverlappingWindows({
		mediaId: input.mediaId,
		startSec: 0,
		endSec,
	});
	for (let startSec = 0; startSec < endSec && input.isCurrent(); startSec += FULL_TRANSCRIPT_WINDOW_SEC) {
		if (isTranscriptRangeCached(cached, first, startSec, startSec + FULL_TRANSCRIPT_WINDOW_SEC)) continue;
		const window = await requestWindow(startSec);
		if (!window) return;
		cached.push(...await input.cache.readOverlappingWindows({
			mediaId: input.mediaId,
			startSec,
			endSec: startSec + FULL_TRANSCRIPT_WINDOW_SEC,
		}));
	}
}
