import { describe, expect, test } from "bun:test";

import {
	channelContentFilterInputSchema,
	getContentFilterUpdateData,
	getEffectiveChannelContentType,
	isBlogAllowedByChannelContentFilter,
} from "./channel-content-filter";

describe("channel content filter policy", () => {
	test("disabled and missing configurations do not hide posts", () => {
		const video = { type: "video", telegramMessageId: 10, medias: [] };

		expect(isBlogAllowedByChannelContentFilter(undefined, video)).toBe(true);
		expect(
			isBlogAllowedByChannelContentFilter(
				{ enabled: false, types: ["audio"] },
				video,
			),
		).toBe(true);
	});

	test("enabled configurations allow only selected content types", () => {
		const filter = { enabled: true, types: ["audio", "pdf"] };

		expect(
			isBlogAllowedByChannelContentFilter(filter, {
				type: "audio",
				telegramMessageId: 11,
				medias: [],
			}),
		).toBe(true);
		expect(
			isBlogAllowedByChannelContentFilter(filter, {
				type: "image",
				telegramMessageId: 12,
				medias: [],
			}),
		).toBe(false);
	});

	test("an invalid empty enabled configuration fails open", () => {
		expect(
			isBlogAllowedByChannelContentFilter(
				{ enabled: true, types: [] },
				{ type: "text", telegramMessageId: 13, medias: [] },
			),
		).toBe(true);
	});

	test("legacy Telegram PDF and video rows use their media type", () => {
		expect(
			getEffectiveChannelContentType({
				type: "text",
				telegramMessageId: 14,
				medias: [{ mimeType: "application/pdf", file: null }],
			}),
		).toBe("pdf");
		expect(
			getEffectiveChannelContentType({
				type: "text",
				telegramMessageId: 15,
				medias: [
					{
						mimeType: "application/octet-stream",
						file: { mimeType: "video/mp4" },
					},
				],
			}),
		).toBe("video");
		expect(
			getEffectiveChannelContentType({
				type: "document",
				telegramMessageId: 16,
				medias: [{ mimeType: "application/msword" }],
			}),
		).toBe("text");
	});

	test("enabled updates require at least one valid type", () => {
		expect(
			channelContentFilterInputSchema.safeParse({
				channelId: 1,
				enabled: true,
				types: [],
			}).success,
		).toBe(false);
		expect(
			channelContentFilterInputSchema.safeParse({
				channelId: 1,
				enabled: true,
				types: ["audio", "pdf"],
			}).success,
		).toBe(true);
		expect(
			channelContentFilterInputSchema.safeParse({
				channelId: 1,
				enabled: true,
				types: ["document"],
			}).success,
		).toBe(false);
		expect(
			channelContentFilterInputSchema.safeParse({
				channelId: 1,
				enabled: false,
			}).success,
		).toBe(true);
	});

	test("disabling preserves saved selections while enabling orders them", () => {
		expect(
			getContentFilterUpdateData({ channelId: 1, enabled: false }),
		).toEqual({ contentFilterEnabled: false });
		expect(
			getContentFilterUpdateData({
				channelId: 1,
				enabled: true,
				types: ["pdf", "audio"],
			}),
		).toEqual({
			contentFilterEnabled: true,
			contentFilterTypes: ["audio", "pdf"],
		});
	});
});
