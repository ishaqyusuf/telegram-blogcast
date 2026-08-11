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
		upsertServerWindow: async () => true,
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
				return true;
			},
		});
		const controller = createTranscriptCacheController({
			getCache: async () => cache,
			recoverCache: async () => cache,
		});

		const outcome = await controller.requestWindow({
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
			"persist",
			"render-server",
		]);
		expect(persistedWindow).toBe(serverWindow);
		expect(outcome).toEqual({ status: "applied" });
	});

	test("persists and renders only the newest out-of-order response", async () => {
		const persisted: ServerTranscriptWindow[] = [];
		const rendered: string[] = [];
		let resolveOlder!: (window: ServerTranscriptWindow) => void;
		let resolveNewer!: (window: ServerTranscriptWindow) => void;
		const olderResponse = new Promise<ServerTranscriptWindow>((resolve) => {
			resolveOlder = resolve;
		});
		const newerResponse = new Promise<ServerTranscriptWindow>((resolve) => {
			resolveNewer = resolve;
		});
		const olderWindow = {
			...serverWindow,
			windowStartSec: 0,
			windowEndSec: 60,
			transcriptUpdatedAt: new Date("2026-08-11T08:00:00.000Z"),
		};
		const newerWindow = {
			...serverWindow,
			windowStartSec: 60,
			windowEndSec: 120,
			transcriptUpdatedAt: new Date("2026-08-11T09:00:00.000Z"),
		};
		const cache = createFakeCache({
			readOverlappingWindows: async () => [],
			upsertServerWindow: async (window) => {
				persisted.push(window);
				return true;
			},
		});
		const controller = createTranscriptCacheController({
			getCache: async () => cache,
			recoverCache: async () => cache,
		});
		const request = (
			window: ServerTranscriptWindow,
			response: Promise<ServerTranscriptWindow>,
		) =>
			controller.requestWindow({
				mediaId: 42,
				startSec: window.windowStartSec,
				endSec: window.windowEndSec,
				fetchServer: async () => response,
				onCachedWindows: () => undefined,
				onServerWindow: () => rendered.push(window.windowStartSec.toString()),
				onServerError: () => undefined,
			});

		const olderRequest = request(olderWindow, olderResponse);
		const newerRequest = request(newerWindow, newerResponse);
		resolveNewer(newerWindow);
		const newerOutcome = await newerRequest;
		resolveOlder(olderWindow);
		const olderOutcome = await olderRequest;

		expect(rendered).toEqual(["60"]);
		expect(persisted).toEqual([newerWindow]);
		expect(newerOutcome).toEqual({ status: "applied" });
		expect(olderOutcome).toEqual({ status: "stale-rejected" });
	});

	test("does not render an older response that loses during persistence", async () => {
		let resolveOldPersist!: () => void;
		let signalOldPersistStarted!: () => void;
		const oldPersistStarted = new Promise<void>((resolve) => {
			signalOldPersistStarted = resolve;
		});
		const oldPersist = new Promise<void>((resolve) => {
			resolveOldPersist = resolve;
		});
		const oldWindow = {
			...serverWindow,
			windowStartSec: 0,
			windowEndSec: 60,
			transcriptUpdatedAt: new Date("2026-08-11T08:00:00.000Z"),
		};
		const newerWindow = {
			...serverWindow,
			windowStartSec: 60,
			windowEndSec: 120,
			transcriptUpdatedAt: new Date("2026-08-11T09:00:00.000Z"),
		};
		const rendered: string[] = [];
		const persisted: number[] = [];
		const cache = createFakeCache({
			readOverlappingWindows: async () => [],
			upsertServerWindow: async (window) => {
				if (window.windowStartSec === oldWindow.windowStartSec) {
					signalOldPersistStarted();
					await oldPersist;
				}
				persisted.push(window.windowStartSec);
				return true;
			},
		});
		const controller = createTranscriptCacheController({
			getCache: async () => cache,
			recoverCache: async () => cache,
		});
		const oldRequest = controller.requestWindow({
			mediaId: 42,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => oldWindow,
			onCachedWindows: () => undefined,
			onServerWindow: () => rendered.push("old"),
			onServerError: () => undefined,
		});

		await oldPersistStarted;
		const newerRequest = controller.requestWindow({
			mediaId: 42,
			startSec: 60,
			endSec: 120,
			fetchServer: async () => newerWindow,
			onCachedWindows: () => undefined,
			onServerWindow: () => rendered.push("new"),
			onServerError: () => undefined,
		});
		const newerOutcome = await newerRequest;
		resolveOldPersist();
		const oldOutcome = await oldRequest;

		expect(rendered).toEqual(["new"]);
		expect(persisted).toEqual([60, 0]);
		expect(newerOutcome).toEqual({ status: "applied" });
		expect(oldOutcome).toEqual({ status: "stale-rejected" });
	});

	test("does not let an unversioned response erase a timestamped cache", async () => {
		let persisted = 0;
		let renderedServer = 0;
		const cache = createFakeCache({
			upsertServerWindow: async () => {
				persisted += 1;
				return true;
			},
		});
		const controller = createTranscriptCacheController({
			getCache: async () => cache,
			recoverCache: async () => cache,
		});

		const outcome = await controller.requestWindow({
			mediaId: 42,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => ({
				...serverWindow,
				transcriptUpdatedAt: null,
				segments: [{ ...serverWindow.segments[0], text: "unversioned" }],
			}),
			onCachedWindows: () => undefined,
			onServerWindow: () => {
				renderedServer += 1;
			},
			onServerError: () => undefined,
		});

		expect(persisted).toBe(0);
		expect(renderedServer).toBe(0);
		expect(outcome).toEqual({ status: "stale-rejected" });
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
						return true;
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
		const outcome = await request;

		expect(events).toEqual(["cache"]);
		expect(persisted).toBe(0);
		expect(invalidated).toBe(1);
		expect(outcome).toEqual({ status: "cancelled" });
	});

	test("cancels callbacks for a navigated-away media without invalidating its cache", async () => {
		let resolveMediaA!: (window: ServerTranscriptWindow) => void;
		let mediaAStarted!: () => void;
		const mediaAStartedPromise = new Promise<void>((resolve) => {
			mediaAStarted = resolve;
		});
		const mediaAResponse = new Promise<ServerTranscriptWindow>((resolve) => {
			resolveMediaA = resolve;
		});
		const mediaAWindow = { ...serverWindow, mediaId: 1 };
		const mediaBWindow = { ...serverWindow, mediaId: 2 };
		const events: string[] = [];
		const persistedMediaIds: number[] = [];
		let invalidated = 0;
		const cache = createFakeCache({
			readOverlappingWindows: async () => [],
			upsertServerWindow: async (window) => {
				persistedMediaIds.push(window.mediaId);
				return true;
			},
			invalidateMediaTranscript: async () => {
				invalidated += 1;
			},
		});
		const controller = createTranscriptCacheController({
			getCache: async () => cache,
			recoverCache: async () => cache,
		});
		const mediaARequest = controller.requestWindow({
			mediaId: 1,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => {
				mediaAStarted();
				return mediaAResponse;
			},
			onCachedWindows: () => events.push("A-cache"),
			onServerWindow: () => events.push("A-server"),
			onServerError: () => events.push("A-error"),
		});

		await mediaAStartedPromise;
		controller.cancelMediaRequests(1);
		const mediaBOutcome = await controller.requestWindow({
			mediaId: 2,
			startSec: 0,
			endSec: 60,
			fetchServer: async () => mediaBWindow,
			onCachedWindows: () => events.push("B-cache"),
			onServerWindow: () => events.push("B-server"),
			onServerError: () => events.push("B-error"),
		});
		resolveMediaA(mediaAWindow);
		const mediaAOutcome = await mediaARequest;

		expect(events).toEqual(["A-cache", "B-cache", "B-server"]);
		expect(persistedMediaIds).toEqual([2]);
		expect(invalidated).toBe(0);
		expect(mediaBOutcome).toEqual({ status: "applied" });
		expect(mediaAOutcome).toEqual({ status: "cancelled" });
	});

	test("keeps cached content usable when the server refresh fails", async () => {
		const events: string[] = [];
		const controller = createTranscriptCacheController({
			getCache: async () => createFakeCache(),
			recoverCache: async () => createFakeCache(),
		});

		const outcome = await controller.requestWindow({
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
		expect(outcome).toEqual({ status: "error", error: expect.any(Error) });
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
