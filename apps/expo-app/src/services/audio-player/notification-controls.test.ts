import { describe, expect, test } from "bun:test";

import {
	ANDROID_NOTIFICATION_ACTION_IDS,
	AUDIO_PLAYBACK_RATES,
	buildAndroidNotificationControlSpec,
	buildTrackPlayerNotificationOptions,
	getNextPlaybackRate,
	normalizePlaybackRate,
	synchronizePlaybackRate,
} from "./notification-controls";

describe("Android notification controls", () => {
	test("mirrors the expanded and compact mini-player actions", () => {
		const spec = buildAndroidNotificationControlSpec(1);

		expect(spec.expandedActionIds).toEqual([
			"cycle-playback-rate",
			"jump-backward-5",
			"play-pause",
			"jump-forward-5",
			"open-comments",
		]);
		expect(spec.compactActionIds).toEqual([
			"jump-backward-5",
			"play-pause",
			"jump-forward-5",
		]);
		expect(spec.customActions).toEqual([
			{
				id: ANDROID_NOTIFICATION_ACTION_IDS.cyclePlaybackRate,
				title: "Playback speed 1×",
				iconKey: "speed-1",
				compact: false,
				placement: "start",
			},
			{
				id: ANDROID_NOTIFICATION_ACTION_IDS.openComments,
				title: "Open comments",
				iconKey: "comments",
				compact: false,
				placement: "end",
			},
		]);
	});

	test("cycles the shared playback rates and selects the matching icon", () => {
		expect(AUDIO_PLAYBACK_RATES).toEqual([1, 1.25, 1.5, 1.75, 2]);
		expect(getNextPlaybackRate(1)).toBe(1.25);
		expect(getNextPlaybackRate(1.75)).toBe(2);
		expect(getNextPlaybackRate(2)).toBe(1);
		expect(normalizePlaybackRate(0.75)).toBe(1);
		expect(buildAndroidNotificationControlSpec(1.75).customActions[0]).toEqual({
			id: "cycle-playback-rate",
			title: "Playback speed 1.75×",
			iconKey: "speed-1-75",
			compact: false,
			placement: "start",
		});
	});

	test("adopts a headless native rate and refreshes its notification icon", async () => {
		const nativeRates: number[] = [];
		const notificationRates: number[] = [];

		const playbackRate = await synchronizePlaybackRate({
			nativeRate: 1.25,
			storedRate: 1,
			setNativeRate: async (rate) => {
				nativeRates.push(rate);
			},
			refreshNotificationOptions: async (rate) => {
				notificationRates.push(rate);
			},
		});

		expect(playbackRate).toBe(1.25);
		expect(nativeRates).toEqual([]);
		expect(notificationRates).toEqual([1.25]);
	});

	test("builds Track Player options without overloading previous and next", () => {
		const options = buildTrackPlayerNotificationOptions({
			capability: {
				jumpBackward: 10,
				jumpForward: 11,
				pause: 12,
				play: 13,
				seekTo: 14,
			},
			icons: {
				comments: "notification_comments",
				jumpBackward: "notification_jump_backward_5",
				jumpForward: "notification_jump_forward_5",
				"speed-1": "notification_speed_1",
				"speed-1-25": "notification_speed_1_25",
				"speed-1-5": "notification_speed_1_5",
				"speed-1-75": "notification_speed_1_75",
				"speed-2": "notification_speed_2",
			},
			playbackRate: 1.25,
		});

		expect(options.capabilities).toEqual([13, 12, 14, 10, 11]);
		expect(options.notificationCapabilities).toEqual([10, 13, 11]);
		expect(options.compactCapabilities).toEqual([10, 13, 11]);
		expect(options.rewindIcon).toBe("notification_jump_backward_5");
		expect(options.forwardIcon).toBe("notification_jump_forward_5");
		expect(options.androidCustomActions).toEqual([
			{
				id: "cycle-playback-rate",
				title: "Playback speed 1.25×",
				icon: "notification_speed_1_25",
				isCompact: false,
				placement: "start",
			},
			{
				id: "open-comments",
				title: "Open comments",
				icon: "notification_comments",
				isCompact: false,
				placement: "end",
			},
		]);
	});
});
