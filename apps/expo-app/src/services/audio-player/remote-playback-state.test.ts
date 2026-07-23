import { describe, expect, test } from "bun:test";

import { getRemotePlaybackStateUpdate } from "./remote-playback-state";

describe("remote playback snapshot state", () => {
	test("updates playback state, progress, and rate in milliseconds", () => {
		expect(
			getRemotePlaybackStateUpdate({
				snapshot: {
					state: "playing",
					isPlaying: true,
					position: 12.345,
					duration: 100,
					buffered: 30,
					playbackRate: 0.75,
				},
				current: {
					duration: 0,
					isSeeking: false,
					pausedAt: 10,
					playedAt: 20,
					position: 0,
				},
				now: 1_000,
			}),
		).toEqual({
			duration: 100_000,
			isPlaying: true,
			pausedAt: null,
			playbackRate: 1,
			playedAt: 1_000,
			position: 12_345,
		});
	});

	test("preserves the local seek position while applying a paused snapshot", () => {
		expect(
			getRemotePlaybackStateUpdate({
				snapshot: {
					state: "paused",
					isPlaying: false,
					position: 55,
					duration: 100,
					buffered: 60,
					playbackRate: 1.25,
				},
				current: {
					duration: 90_000,
					isSeeking: true,
					pausedAt: null,
					playedAt: 20,
					position: 42_000,
				},
				now: 2_000,
			}),
		).toEqual({
			duration: 100_000,
			isPlaying: false,
			pausedAt: 2_000,
			playbackRate: 1.25,
			playedAt: 20,
			position: 42_000,
		});
	});
});
