import { describe, expect, test } from "bun:test";

import { DEFAULT_TRANSCRIPTION_WORKER_STALE_MS } from "./transcription-worker";

describe("transcription worker recovery", () => {
	test("reclaims interrupted work within thirty seconds by default", () => {
		expect(DEFAULT_TRANSCRIPTION_WORKER_STALE_MS).toBe(30_000);
	});
});
