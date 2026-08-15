import { describe, expect, test } from "bun:test";

import { projectPlaybackPositionSec } from "./transcript-playback-clock";

describe("transcript playback clock", () => {
	test("projects the latest native sample using elapsed time and playback rate", () => {
		expect(
			projectPlaybackPositionSec({
				positionSec: 10,
				sampledAtMs: 1_000,
				nowMs: 1_250,
				isPlaying: true,
				isLoading: false,
				isSeeking: false,
				playbackRate: 1.5,
				durationSec: 60,
			}),
		).toBe(10.375);
	});

	test("does not project while paused, buffering, or seeking", () => {
		const base = {
			positionSec: 10,
			sampledAtMs: 1_000,
			nowMs: 1_400,
			playbackRate: 2,
			durationSec: 60,
		};

		expect(
			projectPlaybackPositionSec({
				...base,
				isPlaying: false,
				isLoading: false,
				isSeeking: false,
			}),
		).toBe(10);
		expect(
			projectPlaybackPositionSec({
				...base,
				isPlaying: true,
				isLoading: true,
				isSeeking: false,
			}),
		).toBe(10);
		expect(
			projectPlaybackPositionSec({
				...base,
				isPlaying: true,
				isLoading: false,
				isSeeking: true,
			}),
		).toBe(10);
	});

	test("caps projection at the known duration", () => {
		expect(
			projectPlaybackPositionSec({
				positionSec: 9.9,
				sampledAtMs: 1_000,
				nowMs: 2_000,
				isPlaying: true,
				isLoading: false,
				isSeeking: false,
				playbackRate: 1,
				durationSec: 10,
			}),
		).toBe(10);
	});
});
