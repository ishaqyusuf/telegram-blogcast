import {
	mkdir,
	readFile,
	readdir,
	rename,
	stat,
	unlink,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import type { LocalMediaSource } from "./source";

export type LocalMediaStatus =
	| { state: "unavailable"; progress: 0 }
	| { state: "fetchable"; progress: 0 }
	| { state: "preparing"; progress: number }
	| { state: "error"; progress: 0; error: string }
	| {
			state: "ready";
			progress: 1;
			size: number;
			fileName: string;
			mimeType: string;
	  };

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
	onProgress: (progress: number) => void;
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

	const paths = (mediaId: number) => ({
		data: join(input.cacheDir, `media-${mediaId}.data`),
		metadata: join(input.cacheDir, `media-${mediaId}.json`),
		temporaryData: join(input.cacheDir, `media-${mediaId}.data.part`),
		temporaryMetadata: join(input.cacheDir, `media-${mediaId}.json.part`),
	});

	async function getReadyFile(
		mediaId: number,
	): Promise<ReadyLocalMediaFile | null> {
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

	function readyStatus(file: ReadyLocalMediaFile): LocalMediaStatus {
		return {
			state: "ready",
			progress: 1,
			size: file.size,
			fileName: file.fileName,
			mimeType: file.mimeType,
		};
	}

	async function enforceQuota(currentDataPath: string) {
		if (!input.maxBytes || input.maxBytes <= 0) return;

		const entries = await readdir(input.cacheDir, { withFileTypes: true });
		const cachedFiles = await Promise.all(
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
		let totalBytes = cachedFiles.reduce((total, file) => total + file.size, 0);
		for (const file of cachedFiles
			.filter((candidate) => candidate.path !== currentDataPath)
			.sort((left, right) => left.mtimeMs - right.mtimeMs)) {
			if (totalBytes <= input.maxBytes) break;
			await Promise.all([
				unlink(file.path).catch(() => undefined),
				unlink(
					join(input.cacheDir, file.name.replace(/\.data$/, ".json")),
				).catch(() => undefined),
			]);
			totalBytes -= file.size;
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
			const existing = await getReadyFile(mediaId);
			if (existing) return readyStatus(existing);

			lastErrors.delete(mediaId);
			const source = await input.resolveSource(mediaId);
			if (!source) {
				return { state: "unavailable", progress: 0 } as const;
			}

			await mkdir(input.cacheDir, { recursive: true });
			const target = paths(mediaId);
			await Promise.all([
				unlink(target.temporaryData).catch(() => undefined),
				unlink(target.temporaryMetadata).catch(() => undefined),
			]);
			await input.download({
				source,
				destination: target.temporaryData,
				onProgress: (progress) => {
					state.progress = clampProgress(progress);
				},
			});

			const downloaded = await stat(target.temporaryData);
			if (!downloaded.isFile() || downloaded.size <= 0) {
				throw new Error("Telegram did not return a readable media file.");
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
			return readyStatus({ ...metadata, path: target.data });
		});

		state.promise = task
			.catch((error) => {
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

	return { getReadyFile, getStatus, prepare };
}

export type LocalMediaCache = ReturnType<typeof createLocalMediaCache>;
