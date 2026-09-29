import { describe, expect, test } from "bun:test";

import type {
	CachedTranscriptWindow,
	ServerTranscriptWindow,
	TranscriptCacheRepository,
} from "@/db/transcript-cache-repository";
import { createTranscriptCacheController } from "./transcript-cache-controller";
import { cacheFullTranscript, isTranscriptRangeCached } from "./full-transcript-cache";

const revision = new Date("2026-09-29T09:00:00.000Z");

function serverWindow(startSec: number): ServerTranscriptWindow {
	return {
		mediaId: 42,
		transcriptId: 7,
		transcriptUpdatedAt: revision,
		status: "done",
		windowStartSec: startSec,
		windowEndSec: startSec + 300,
		durationSec: 900,
		segmentCount: 3,
		maxEndSec: 899,
		segments: [{ id: startSec, startSec: startSec + 1, endSec: startSec + 2, text: "saved" }],
	};
}

function cachedWindow(window: ServerTranscriptWindow): CachedTranscriptWindow {
	return {
		...window,
		transcriptId: window.transcriptId ?? null,
		transcriptUpdatedAt: window.transcriptUpdatedAt ?? null,
		status: window.status ?? null,
		windowDurationSec: 300,
		durationSec: window.durationSec ?? null,
		segmentCount: window.segmentCount ?? 0,
		maxEndSec: window.maxEndSec ?? 0,
		previousWindowStartSec: null,
		nextWindowStartSec: null,
		hasPrevious: false,
		hasNext: false,
		cachedAtMs: 1,
		segments: [],
	};
}

describe("full transcript cache", () => {
	test("fills missing ranges once and checks only the first window on revisit", async () => {
		const windows = new Map<number, CachedTranscriptWindow>();
		const cache: TranscriptCacheRepository = {
			readOverlappingWindows: async ({ startSec, endSec }) =>
				[...windows.values()].filter((window) =>
					window.windowStartSec < endSec && window.windowEndSec > startSec,
				),
			upsertServerWindow: async (window) => {
				windows.set(window.windowStartSec, cachedWindow(window));
				return true;
			},
			invalidateMediaTranscript: async () => { windows.clear(); },
		};
		const controller = createTranscriptCacheController({
			getCache: async () => cache,
			recoverCache: async () => cache,
		});
		const fetched: number[] = [];
		const input = {
			mediaId: 42,
			cache,
			controller,
			isCurrent: () => true,
			fetchWindow: async (startSec: number) => {
				fetched.push(startSec);
				return serverWindow(startSec);
			},
		};
		await cacheFullTranscript(input);
		expect(fetched).toEqual([0, 300, 600]);
		expect(isTranscriptRangeCached([...windows.values()], serverWindow(0), 0, 900)).toBe(true);
		fetched.length = 0;
		await cacheFullTranscript(input);
		expect(fetched).toEqual([0]);
	});

	test("ignores an unfinished cached range for a complete transcript", () => {
		const unfinished = cachedWindow(serverWindow(0));
		unfinished.status = "pending";
		expect(isTranscriptRangeCached([unfinished], serverWindow(0), 0, 300)).toBe(false);
	});
});
