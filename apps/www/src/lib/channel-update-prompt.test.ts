import { describe, expect, test } from "bun:test";

import {
	buildChannelUpdatePromptModel,
	isChannelUpdateSurface,
	isLocalChannelUpdateHost,
} from "./channel-update-prompt";

const channels = [
	{
		channelId: 1,
		title: "Already current",
		username: "current",
		storedCount: 20,
		latestKnownCount: 20,
		latestKnownMessageId: 120,
		newestStoredMessageId: 120,
		lastFetchedAt: "2026-07-20T10:00:00.000Z",
		delta: 0,
		canUpdate: true,
	},
	{
		channelId: 2,
		title: "Recently changed",
		username: "changed",
		storedCount: 10,
		latestKnownCount: 13,
		latestKnownMessageId: 213,
		newestStoredMessageId: 210,
		lastFetchedAt: "2026-07-21T10:00:00.000Z",
		delta: 3,
		canUpdate: true,
	},
	{
		channelId: 3,
		title: "Legacy download",
		username: "legacy",
		storedCount: 7,
		latestKnownCount: 9,
		latestKnownMessageId: 309,
		newestStoredMessageId: null,
		lastFetchedAt: null,
		delta: 2,
		canUpdate: false,
	},
];

describe("channel update prompt", () => {
	test("puts usable updates first, preselects them, and keeps other downloads available", () => {
		const model = buildChannelUpdatePromptModel(channels);

		expect(model.updated.map((channel) => channel.channelId)).toEqual([2]);
		expect(model.other.map((channel) => channel.channelId)).toEqual([1, 3]);
		expect(model.selectedIds).toEqual([2]);
		expect(model.other[1]?.canUpdate).toBe(false);
	});

	test("runs only on the Blog and Telegram dashboard surfaces", () => {
		expect(isChannelUpdateSurface("/blog")).toBe(true);
		expect(isChannelUpdateSurface("/dashboard")).toBe(true);
		expect(isChannelUpdateSurface("/dashboard/example-channel")).toBe(true);
		expect(isChannelUpdateSurface("/blog/42")).toBe(false);
		expect(isChannelUpdateSurface("/albums")).toBe(false);
	});

	test("limits automatic Telegram work to local admin hosts", () => {
		expect(isLocalChannelUpdateHost("podcast.localhost")).toBe(true);
		expect(isLocalChannelUpdateHost("192.168.1.20")).toBe(true);
		expect(isLocalChannelUpdateHost("[::1]")).toBe(true);
		expect(isLocalChannelUpdateHost("alghurobaa.com")).toBe(false);
	});
});
