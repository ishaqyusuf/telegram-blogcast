import { describe, expect, test } from "bun:test";

import {
	getResumePosition,
	getSessionPosition,
	planPlayHistoryWrites,
	rememberSessionPosition,
} from "./play-history";

const idle = { mediaId: null, isPlaying: false, isSeeking: false, position: 0 };

describe("play history", () => {
	test("viewing audio does not create history; playback does", () => {
		const loaded = {
			mediaId: 7,
			isPlaying: false,
			isSeeking: false,
			position: 0,
		};
		expect(planPlayHistoryWrites(idle, loaded)).toEqual([]);
		expect(
			planPlayHistoryWrites(loaded, { ...loaded, isPlaying: true }),
		).toEqual([{ mediaId: 7, progressMs: 0 }]);
	});

	test("pause, seek, and switching tracks save the correct media position", () => {
		const playing = {
			mediaId: 7,
			isPlaying: true,
			isSeeking: false,
			position: 40_000,
		};
		expect(
			planPlayHistoryWrites(playing, {
				...playing,
				isPlaying: false,
				position: 39_000,
			}),
		).toEqual([{ mediaId: 7, progressMs: 39_000 }]);
		expect(
			planPlayHistoryWrites(
				{ ...playing, isPlaying: false },
				{ ...playing, isPlaying: false, position: 38_500 },
			),
		).toEqual([{ mediaId: 7, progressMs: 38_500 }]);
		expect(
			planPlayHistoryWrites(
				{ ...playing, isPlaying: false },
				{ ...playing, isPlaying: false, position: 65_000 },
			),
		).toEqual([{ mediaId: 7, progressMs: 65_000 }]);
		expect(
			planPlayHistoryWrites(
				{ ...playing, isSeeking: true, position: 65_000 },
				{ ...playing, isSeeking: false, position: 65_000 },
			),
		).toEqual([{ mediaId: 7, progressMs: 65_000 }]);
		expect(
			planPlayHistoryWrites(playing, {
				mediaId: 8,
				isPlaying: false,
				isSeeking: false,
				position: 0,
			}),
		).toEqual([{ mediaId: 7, progressMs: 40_000 }]);
	});

	test("resume uses saved milliseconds and replays completed tracks", () => {
		expect(getResumePosition(72_000, 120_000)).toBe(72_000);
		expect(getResumePosition(119_500, 120_000)).toBe(0);
		expect(getResumePosition(72_000, 0)).toBe(72_000);
		rememberSessionPosition(7, 72_000);
		expect(getSessionPosition(7)).toBe(72_000);
	});
});
