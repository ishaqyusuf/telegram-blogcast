import { describe, expect, test } from "bun:test";

import {
	TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES,
	TELEGRAM_BOT_UPLOAD_LIMIT_BYTES,
	getFacebookExternalMedia,
	getLargeMediaExternalMedia,
	isExplicitFacebookVideoUrl,
} from "./facebook-media";

describe("Facebook external media", () => {
	test("recognizes explicit Facebook video routes", () => {
		expect(
			isExplicitFacebookVideoUrl("https://www.facebook.com/reel/123/"),
		).toBe(true);
		expect(
			isExplicitFacebookVideoUrl(
				"https://www.facebook.com/watch/?v=123&ref=saved",
			),
		).toBe(true);
		expect(
			isExplicitFacebookVideoUrl(
				"https://www.facebook.com/example/videos/123/",
			),
		).toBe(true);
	});

	test("does not treat a generic Facebook post as an explicit video", () => {
		expect(
			isExplicitFacebookVideoUrl(
				"https://www.facebook.com/permalink.php?story_fbid=123&id=456",
			),
		).toBe(false);
	});

	test("keeps media at the Bot API download limit in app", () => {
		expect(
			getFacebookExternalMedia({
				source: "facebook",
				sourceUrl: "https://facebook.example/post",
				fileSize: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES,
			}),
		).toBeNull();
	});

	test("routes an uploaded oversized file to its Telegram message", () => {
		expect(
			getFacebookExternalMedia({
				source: "facebook",
				sourceUrl: "https://facebook.example/post",
				fileSize: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES + 1,
				meta: {
					facebook: {
						mediaDownload: { chatId: -1001234567890, messageId: 42 },
					},
				},
			}),
		).toMatchObject({
			destination: "telegram",
			externalUrl: "https://t.me/c/1234567890/42",
			reason: "telegram_download_limit",
		});
	});

	test("routes media above the hosted upload limit to Facebook", () => {
		expect(
			getFacebookExternalMedia({
				source: "facebook",
				sourceUrl: "https://facebook.example/post",
				fileSize: TELEGRAM_BOT_UPLOAD_LIMIT_BYTES + 1,
				meta: {
					facebook: { mediaDownload: { status: "external" } },
				},
			}),
		).toMatchObject({
			destination: "facebook",
			externalUrl: "https://facebook.example/post",
			reason: "telegram_upload_limit",
		});
	});

	test("keeps a Telegram message fallback for oversized channel media", () => {
		expect(
			getLargeMediaExternalMedia({
				source: "telegram",
				fileSize: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES + 1,
				channelUsername: "example_channel",
				telegramMessageId: 88,
				mediaType: "audio",
			}),
		).toMatchObject({
			destination: "telegram",
			externalUrl: "https://t.me/example_channel/88",
		});
	});
});
