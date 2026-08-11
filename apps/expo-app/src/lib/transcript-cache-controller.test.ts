import { describe, expect, test } from "bun:test";

import type {
	CachedTranscriptWindow,
	ServerTranscriptWindow,
	TranscriptCacheRepository,
} from "@/db/transcript-cache-repository";

import { createTranscriptCacheController } from "./transcript-cache-controller";

const cachedWindow: CachedTranscriptWindow = {
	mediaId: 42,
	transcriptId: 7,
	transcriptUpdatedAt: new Date("2026-08-11T08:00:00.000Z"),
	status: "done",
	windowStartSec: 0,
	windowEndSec: 60,
	windowDurationSec: 60,
	durationSec: 180,
	segmentCount: 1,
	maxEndSec: 20,
	previousWindowStartSec: null,
	nextWindowStartSec: 60,
	hasPrevious: false,
	hasNext: true,
	cachedAtMs: 1234,
	segments: [
		{
			id: "101",
			startSec: 10,
			endSec: 20,
			text: "cached transcript",
			words: [],
			status: "done",
			model: null,
		},
	],
};

const serverWindow: ServerTranscriptWindow = {
	...cachedWindow,
	segments: cachedWindow.segments,
};

function createFakeCache(overrides: Partial<TranscriptCacheRepository> = {}) {
	return {
		readOverlappingWindows: async () => [cachedWindow],
		upsertServerWindow: async () => undefined,
		invalidateMediaTranscript: async () => undefined,
		...overrides,
	} satisfies TranscriptCacheRepository;
}

describe("transcript cache controller", () => {
	test("renders cached windows before refreshing and persists the server response", async () => {
		const events: string[] = [];
		let persistedWindow: ServerTranscriptWindow | undefined;
		const cache = createFakeCache({
			readOverlappingWindows: async () => {
				events.push("cache");
				return [cachedWindow];
			},
			upsertServerWindow: async (window) => {
				persistedWindow = window;
				events.push("persist");
			},
		});
		const controller = createTranscriptCacheController({
			getCache: async () => cache,
			recoverCache: async () => cache,
		});

		await controller.requestWindow({
			mediaId: 42,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => {
				events.push("server");
				return serverWindow;
			},
			onCachedWindows: () => events.push("render-cache"),
			onServerWindow: () => events.push("render-server"),
			onServerError: () => events.push("server-error"),
		});

		expect(events).toEqual([
			"cache",
			"render-cache",
			"server",
			"render-server",
			"persist",
		]);
		expect(persistedWindow).toBe(serverWindow);
	});

	test("deduplicates concurrent refreshes for the same window", async () => {
		let fetchCount = 0;
		let readCount = 0;
		const cache = createFakeCache({
			readOverlappingWindows: async () => {
				readCount += 1;
				return [];
			},
		});
		const controller = createTranscriptCacheController({
			getCache: async () => cache,
			recoverCache: async () => cache,
		});
		const request = {
			mediaId: 42,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => {
				fetchCount += 1;
				return serverWindow;
			},
			onCachedWindows: () => undefined,
			onServerWindow: () => undefined,
			onServerError: () => undefined,
		};

		await Promise.all([
			controller.requestWindow(request),
			controller.requestWindow(request),
		]);

		expect(readCount).toBe(1);
		expect(fetchCount).toBe(1);
	});

	test("discards an in-flight response after media transcript invalidation", async () => {
		let resolveServerStarted!: () => void;
		const serverStarted = new Promise<void>((resolve) => {
			resolveServerStarted = resolve;
		});
		let resolveServer!: (window: ServerTranscriptWindow) => void;
		const serverResponse = new Promise<ServerTranscriptWindow>((resolve) => {
			resolveServer = resolve;
		});
		let persisted = 0;
		let invalidated = 0;
		const events: string[] = [];
		const controller = createTranscriptCacheController({
			getCache: async () =>
				createFakeCache({
					upsertServerWindow: async () => {
						persisted += 1;
					},
					invalidateMediaTranscript: async () => {
						invalidated += 1;
					},
				}),
			recoverCache: async () => createFakeCache(),
		});
		const request = controller.requestWindow({
			mediaId: 42,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => {
				resolveServerStarted();
				return serverResponse;
			},
			onCachedWindows: () => events.push("cache"),
			onServerWindow: () => events.push("server"),
			onServerError: () => events.push("error"),
		});

		await serverStarted;
		await controller.invalidateMediaTranscript(42);
		resolveServer(serverWindow);
		await request;

		expect(events).toEqual(["cache"]);
		expect(persisted).toBe(0);
		expect(invalidated).toBe(1);
	});

	test("keeps cached content usable when the server refresh fails", async () => {
		const events: string[] = [];
		const controller = createTranscriptCacheController({
			getCache: async () => createFakeCache(),
			recoverCache: async () => createFakeCache(),
		});

		await controller.requestWindow({
			mediaId: 42,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => {
				throw new Error("offline");
			},
			onCachedWindows: (windows) => {
				events.push(`cached:${windows[0]?.segments[0]?.text}`);
			},
			onServerWindow: () => events.push("server"),
			onServerError: (error) =>
				events.push(error instanceof Error ? error.message : "unknown"),
		});

		expect(events).toEqual(["cached:cached transcript", "offline"]);
	});

	test("recovers a corrupt cache once before continuing with the server", async () => {
		let recoverCount = 0;
		let readCount = 0;
		const recoveredCache = createFakeCache({
			readOverlappingWindows: async () => {
				readCount += 1;
				return [cachedWindow];
			},
		});
		const controller = createTranscriptCacheController({
			getCache: async () => {
				throw new Error("malformed sqlite");
			},
			recoverCache: async () => {
				recoverCount += 1;
				return recoveredCache;
			},
		});

		await controller.requestWindow({
			mediaId: 42,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => serverWindow,
			onCachedWindows: (windows) => expect(windows).toHaveLength(1),
			onServerWindow: () => undefined,
			onServerError: () => undefined,
		});

		expect(recoverCount).toBe(1);
		expect(readCount).toBe(1);
	});

	test("does not loop cache recovery after recovery itself fails", async () => {
		let openCount = 0;
		let recoverCount = 0;
		const controller = createTranscriptCacheController({
			getCache: async () => {
				openCount += 1;
				throw new Error("malformed sqlite");
			},
			recoverCache: async () => {
				recoverCount += 1;
				throw new Error("cannot rebuild");
			},
		});
		const request = (startSec: number) =>
			controller.requestWindow({
				mediaId: 42,
				startSec,
				endSec: startSec + 60,
				fetchServer: async () => serverWindow,
				onCachedWindows: () => undefined,
				onServerWindow: () => undefined,
				onServerError: () => undefined,
			});

		await request(0);
		await request(60);

		expect(openCount).toBe(1);
		expect(recoverCount).toBe(1);
	});
});
