import {
	mkdir,
	readFile,
	readdir,
	rename,
	stat,
	unlink,
	utimes,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import type { LocalMediaStatus } from "@acme/blog";

import type { LocalMediaSource } from "./source";

export type ReadyLocalMediaFile = {
	path: string;
	size: number;
	fileName: string;
	mimeType: string;
};

type CacheMetadata = Omit<ReadyLocalMediaFile, "path">;

type DownloadInput = {
	source: LocalMediaSource;
	destination: string;
	onProgress: (progress: number, downloadedBytes?: number) => void;
};

type InFlightPreparation = {
	progress: number;
	promise: Promise<LocalMediaStatus>;
};

function clampProgress(value: number) {
	return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function createLocalMediaCache(input: {
	cacheDir: string;
	maxBytes?: number;
	resolveSource: (mediaId: number) => Promise<LocalMediaSource | null>;
	download: (input: DownloadInput) => Promise<void>;
}) {
	const inFlight = new Map<number, InFlightPreparation>();
	const lastErrors = new Map<number, string>();
	const maxBytes = input.maxBytes && input.maxBytes > 0 ? input.maxBytes : null;
	let initialization: Promise<void> | null = null;
	let downloadQueue: Promise<void> = Promise.resolve();

	const paths = (mediaId: number) => ({
		data: join(input.cacheDir, `media-${mediaId}.data`),
		metadata: join(input.cacheDir, `media-${mediaId}.json`),
		temporaryData: join(input.cacheDir, `media-${mediaId}.data.part`),
		temporaryMetadata: join(input.cacheDir, `media-${mediaId}.json.part`),
	});

	function initialize() {
		initialization ??= (async () => {
			await mkdir(input.cacheDir, { recursive: true });
			const entries = await readdir(input.cacheDir, { withFileTypes: true });
			await Promise.all(
				entries
					.filter((entry) => entry.isFile() && entry.name.endsWith(".part"))
					.map((entry) =>
						unlink(join(input.cacheDir, entry.name)).catch(() => undefined),
					),
			);
		})();
		return initialization;
	}

	function enqueueDownload<T>(operation: () => Promise<T>) {
		const result = downloadQueue.then(operation, operation);
		downloadQueue = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	async function getReadyFile(
		mediaId: number,
	): Promise<ReadyLocalMediaFile | null> {
		await initialize();
		const target = paths(mediaId);
		try {
			const [fileStats, rawMetadata] = await Promise.all([
				stat(target.data),
				readFile(target.metadata, "utf8"),
			]);
			if (!fileStats.isFile() || fileStats.size <= 0) return null;
			const metadata = JSON.parse(rawMetadata) as Partial<CacheMetadata>;
			if (
				typeof metadata.fileName !== "string" ||
				typeof metadata.mimeType !== "string"
			) {
				return null;
			}
			return {
				path: target.data,
				size: fileStats.size,
				fileName: metadata.fileName,
				mimeType: metadata.mimeType,
			};
		} catch {
			return null;
		}
	}

	async function markAccessed(mediaId: number) {
		await initialize();
		const target = paths(mediaId);
		const now = new Date();
		await Promise.all([
			utimes(target.data, now, now),
			utimes(target.metadata, now, now),
		]);
	}

	function readyStatus(file: ReadyLocalMediaFile): LocalMediaStatus {
		return {
			state: "ready",
			progress: 1,
			size: file.size,
			fileName: file.fileName,
			mimeType: file.mimeType,
		};
	}

	async function listCachedFiles() {
		const entries = await readdir(input.cacheDir, { withFileTypes: true });
		return Promise.all(
			entries
				.filter((entry) => entry.isFile() && entry.name.endsWith(".data"))
				.map(async (entry) => {
					const path = join(input.cacheDir, entry.name);
					const fileStats = await stat(path);
					return {
						path,
						name: entry.name,
						size: fileStats.size,
						mtimeMs: fileStats.mtimeMs,
					};
				}),
		);
	}

	async function removeCachedFile(file: { path: string; name: string }) {
		await Promise.all([
			unlink(file.path).catch(() => undefined),
			unlink(join(input.cacheDir, file.name.replace(/\.data$/, ".json"))).catch(
				() => undefined,
			),
		]);
	}

	async function reserveSpace(requiredBytes: number) {
		if (!maxBytes) return;
		if (requiredBytes > maxBytes) {
			throw new Error("Media exceeds the configured local cache quota.");
		}
		const cachedFiles = await listCachedFiles();
		let totalBytes = cachedFiles.reduce((total, file) => total + file.size, 0);
		for (const file of cachedFiles.sort(
			(left, right) => left.mtimeMs - right.mtimeMs,
		)) {
			if (totalBytes + requiredBytes <= maxBytes) break;
			await removeCachedFile(file);
			totalBytes -= file.size;
		}
	}

	async function enforceQuota(currentDataPath: string) {
		if (!maxBytes) return;

		const cachedFiles = await listCachedFiles();
		let totalBytes = cachedFiles.reduce((total, file) => total + file.size, 0);
		for (const file of cachedFiles
			.filter((candidate) => candidate.path !== currentDataPath)
			.sort((left, right) => left.mtimeMs - right.mtimeMs)) {
			if (totalBytes <= maxBytes) break;
			await removeCachedFile(file);
			totalBytes -= file.size;
		}
		if (totalBytes > maxBytes) {
			const current = cachedFiles.find(
				(candidate) => candidate.path === currentDataPath,
			);
			if (current) {
				await removeCachedFile(current);
			}
			throw new Error("Media exceeds the configured local cache quota.");
		}
	}

	async function getStatus(mediaId: number): Promise<LocalMediaStatus> {
		const active = inFlight.get(mediaId);
		if (active) {
			return { state: "preparing", progress: active.progress };
		}

		const ready = await getReadyFile(mediaId);
		if (ready) return readyStatus(ready);

		const error = lastErrors.get(mediaId);
		if (error) return { state: "error", progress: 0, error };

		return (await input.resolveSource(mediaId))
			? { state: "fetchable", progress: 0 }
			: { state: "unavailable", progress: 0 };
	}

	function prepare(mediaId: number): Promise<LocalMediaStatus> {
		const active = inFlight.get(mediaId);
		if (active) return active.promise;

		const state: InFlightPreparation = {
			progress: 0,
			promise: Promise.resolve({ state: "preparing", progress: 0 }),
		};
		const task = Promise.resolve().then(async () => {
			await initialize();
			const existing = await getReadyFile(mediaId);
			if (existing) return readyStatus(existing);

			lastErrors.delete(mediaId);
			const source = await input.resolveSource(mediaId);
			if (!source) {
				return { state: "unavailable", progress: 0 } as const;
			}
			if (maxBytes && source.size && source.size > maxBytes) {
				throw new Error("Media exceeds the configured local cache quota.");
			}

			const target = paths(mediaId);
			return enqueueDownload(async () => {
				const queuedExisting = await getReadyFile(mediaId);
				if (queuedExisting) return readyStatus(queuedExisting);
				await reserveSpace(source.size ?? maxBytes ?? 0);
				await Promise.all([
					unlink(target.temporaryData).catch(() => undefined),
					unlink(target.temporaryMetadata).catch(() => undefined),
				]);
				await input.download({
					source,
					destination: target.temporaryData,
					onProgress: (progress, downloadedBytes) => {
						if (maxBytes && downloadedBytes && downloadedBytes > maxBytes) {
							throw new Error(
								"Media exceeds the configured local cache quota.",
							);
						}
						state.progress = clampProgress(progress);
					},
				});

				const downloaded = await stat(target.temporaryData);
				if (!downloaded.isFile() || downloaded.size <= 0) {
					throw new Error("Telegram did not return a readable media file.");
				}
				if (maxBytes && downloaded.size > maxBytes) {
					throw new Error("Media exceeds the configured local cache quota.");
				}
				const metadata: CacheMetadata = {
					size: downloaded.size,
					fileName: source.fileName,
					mimeType: source.mimeType,
				};
				await writeFile(target.temporaryMetadata, JSON.stringify(metadata));
				await rename(target.temporaryData, target.data);
				await rename(target.temporaryMetadata, target.metadata);
				await enforceQuota(target.data);
				const committed = await getReadyFile(mediaId);
				if (!committed) {
					throw new Error("Prepared media was evicted before it became ready.");
				}
				return readyStatus(committed);
			});
		});

		state.promise = task
			.catch(async (error) => {
				const target = paths(mediaId);
				await Promise.all([
					unlink(target.temporaryData).catch(() => undefined),
					unlink(target.temporaryMetadata).catch(() => undefined),
				]);
				const message =
					error instanceof Error
						? error.message
						: "Local media preparation failed.";
				lastErrors.set(mediaId, message);
				return { state: "error", progress: 0, error: message } as const;
			})
			.finally(() => {
				inFlight.delete(mediaId);
			});
		inFlight.set(mediaId, state);
		return state.promise;
	}

	return { getReadyFile, getStatus, markAccessed, prepare };
}

export type LocalMediaCache = ReturnType<typeof createLocalMediaCache>;
