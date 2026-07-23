import { describe, expect, test } from "bun:test";

import {
	type PlaybackServicePlayer,
	REMOTE_PLAYBACK_EVENTS,
	type RemotePlaybackEvent,
	registerPlaybackServiceHandlers,
} from "./playback-service-handlers";

function createPlayer() {
	const listeners = new Map<string, (event?: RemotePlaybackEvent) => unknown>();
	let position = 40;
	let playing = false;
	let playbackRate = 1;

	const player: PlaybackServicePlayer = {
		addEventListener: (event, listener) => {
			listeners.set(event, listener);
		},
		getActiveTrack: async () => ({ id: "blog-1", blogId: "blog-1" }),
		getPlaybackState: async () => ({
			state: playing ? "playing" : "paused",
		}),
		getProgress: async () => ({
			buffered: 45,
			duration: 100,
			position,
		}),
		getRate: async () => playbackRate,
		pause: async () => {
			playing = false;
		},
		play: async () => {
			playing = true;
		},
		seekTo: async (nextPosition) => {
			position = nextPosition;
		},
		setRate: async (nextRate) => {
			playbackRate = nextRate;
		},
	};

	return {
		listeners,
		player,
		readPosition: () => position,
		readRate: () => playbackRate,
	};
}

describe("Android playback service handlers", () => {
	test("plays, pauses, and bounds five-second jumps while publishing snapshots", async () => {
		const { listeners, player, readPosition } = createPlayer();
		const snapshots: unknown[] = [];

		registerPlaybackServiceHandlers({
			player,
			publishSnapshot: (snapshot) => snapshots.push(snapshot),
		});

		await listeners.get(REMOTE_PLAYBACK_EVENTS.play)?.();
		expect(snapshots.at(-1)).toEqual({
			state: "playing",
			isPlaying: true,
			position: 40,
			duration: 100,
			buffered: 45,
			playbackRate: 1,
		});

		await listeners.get(REMOTE_PLAYBACK_EVENTS.jumpBackward)?.();
		expect(readPosition()).toBe(35);

		await listeners.get(REMOTE_PLAYBACK_EVENTS.jumpForward)?.();
		expect(readPosition()).toBe(40);

		await listeners.get(REMOTE_PLAYBACK_EVENTS.jumpBackward)?.({
			interval: 50,
		});
		expect(readPosition()).toBe(0);

		await listeners.get(REMOTE_PLAYBACK_EVENTS.jumpForward)?.({
			interval: 500,
		});
		expect(readPosition()).toBe(100);

		await listeners.get(REMOTE_PLAYBACK_EVENTS.pause)?.();
		expect(snapshots.at(-1)).toEqual({
			state: "paused",
			isPlaying: false,
			position: 100,
			duration: 100,
			buffered: 45,
			playbackRate: 1,
		});
		expect(snapshots).toHaveLength(6);
	});

	test("cycles speed and opens comments through explicit custom actions", async () => {
		const { listeners, player, readRate } = createPlayer();
		const comments: string[] = [];
		const refreshedRates: number[] = [];
		const snapshots: unknown[] = [];

		registerPlaybackServiceHandlers({
			player,
			publishSnapshot: (snapshot) => snapshots.push(snapshot),
			refreshNotificationOptions: async (playbackRate) => {
				refreshedRates.push(playbackRate);
			},
			openComments: async (blogId) => {
				comments.push(blogId);
			},
		});

		await listeners.get(REMOTE_PLAYBACK_EVENTS.customAction)?.({
			id: "cycle-playback-rate",
		});
		expect(readRate()).toBe(1.25);
		expect(refreshedRates).toEqual([1.25]);
		expect(snapshots.at(-1)).toMatchObject({ playbackRate: 1.25 });

		await listeners.get(REMOTE_PLAYBACK_EVENTS.customAction)?.({
			id: "open-comments",
		});
		expect(comments).toEqual(["blog-1"]);
		expect(snapshots).toHaveLength(2);
	});
});
