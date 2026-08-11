import type {
	CachedTranscriptWindow,
	ServerTranscriptWindow,
	TranscriptCacheRepository,
} from "@/db/transcript-cache-repository";

export type TranscriptCacheWindowRequest<
	TWindow extends ServerTranscriptWindow = ServerTranscriptWindow,
> = {
	mediaId: number;
	startSec: number;
	endSec: number;
	fetchServer: () => Promise<TWindow>;
	onCachedWindows: (windows: CachedTranscriptWindow[]) => void;
	onServerWindow: (window: TWindow) => void;
	onServerError: (error: unknown) => void;
};

export type TranscriptCacheControllerOptions = {
	getCache: () => Promise<TranscriptCacheRepository>;
	recoverCache: () => Promise<TranscriptCacheRepository>;
};

export type TranscriptCacheController = {
	requestWindow<TWindow extends ServerTranscriptWindow>(
		request: TranscriptCacheWindowRequest<TWindow>,
	): Promise<void>;
	invalidateMediaTranscript(mediaId: number): Promise<void>;
};

function requestKey(mediaId: number, startSec: number, endSec: number) {
	return `${mediaId}:${startSec}:${endSec}`;
}

/**
 * Coordinates the disposable SQLite cache with the authoritative server.
 * Cache reads happen before the server request, while the server response is
 * still fetched and persisted for every window the caller asks to refresh.
 */
export function createTranscriptCacheController(
	options: TranscriptCacheControllerOptions,
): TranscriptCacheController {
	const openCache = options.getCache;
	const recoverCache = options.recoverCache;
	let cachePromise: Promise<TranscriptCacheRepository | null> | null = null;
	let cacheRecoveryAttempted = false;
	let cacheDisabled = false;
	const pendingRequests = new Map<string, Promise<void>>();
	const mediaGenerations = new Map<number, number>();

	async function loadCache() {
		if (cacheDisabled) return null;
		if (!cachePromise) {
			cachePromise = Promise.resolve()
				.then(openCache)
				.catch(async () => {
					if (cacheRecoveryAttempted) {
						cacheDisabled = true;
						return null;
					}

					cacheRecoveryAttempted = true;
					try {
						return await recoverCache();
					} catch {
						cacheDisabled = true;
						return null;
					}
				});
		}
		return cachePromise;
	}

	async function runCacheOperation<T>(
		operation: (cache: TranscriptCacheRepository) => Promise<T>,
	) {
		const cache = await loadCache();
		if (!cache) return null;

		try {
			return await operation(cache);
		} catch {
			if (cacheRecoveryAttempted || cacheDisabled) {
				cacheDisabled = true;
				return null;
			}

			cacheRecoveryAttempted = true;
			try {
				const recoveredCache = await recoverCache();
				cachePromise = Promise.resolve(recoveredCache);
				try {
					return await operation(recoveredCache);
				} catch {
					cacheDisabled = true;
					return null;
				}
			} catch {
				cacheDisabled = true;
				return null;
			}
		}
	}

	function generationFor(mediaId: number) {
		return mediaGenerations.get(mediaId) ?? 0;
	}

	function isCurrent(mediaId: number, generation: number) {
		return generationFor(mediaId) === generation;
	}

	function discardPendingMediaRequests(mediaId: number) {
		const prefix = `${mediaId}:`;
		for (const key of pendingRequests.keys()) {
			if (key.startsWith(prefix)) pendingRequests.delete(key);
		}
	}

	async function loadWindow<TWindow extends ServerTranscriptWindow>(
		request: TranscriptCacheWindowRequest<TWindow>,
		generation: number,
	) {
		const cachedWindows = await runCacheOperation((cache) =>
			cache.readOverlappingWindows({
				mediaId: request.mediaId,
				startSec: request.startSec,
				endSec: request.endSec,
			}),
		);
		if (!isCurrent(request.mediaId, generation)) return;
		if (cachedWindows) request.onCachedWindows(cachedWindows);

		let serverWindow: TWindow;
		try {
			serverWindow = await request.fetchServer();
		} catch (error) {
			if (isCurrent(request.mediaId, generation)) {
				request.onServerError(error);
			}
			return;
		}

		if (!isCurrent(request.mediaId, generation)) return;
		request.onServerWindow(serverWindow);
		if (!isCurrent(request.mediaId, generation)) return;
		await runCacheOperation((cache) => cache.upsertServerWindow(serverWindow));
	}

	return {
		requestWindow<TWindow extends ServerTranscriptWindow>(
			request: TranscriptCacheWindowRequest<TWindow>,
		) {
			const key = requestKey(request.mediaId, request.startSec, request.endSec);
			const pending = pendingRequests.get(key);
			if (pending) return pending;

			const generation = generationFor(request.mediaId);
			const promise = loadWindow(request, generation).finally(() => {
				if (pendingRequests.get(key) === promise) {
					pendingRequests.delete(key);
				}
			});
			pendingRequests.set(key, promise);
			return promise;
		},

		async invalidateMediaTranscript(mediaId: number) {
			mediaGenerations.set(mediaId, generationFor(mediaId) + 1);
			discardPendingMediaRequests(mediaId);
			await runCacheOperation((cache) =>
				cache.invalidateMediaTranscript(mediaId),
			);
		},
	};
}
