import { describe, expect, test } from "bun:test";

import {
	TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES,
	TELEGRAM_BOT_UPLOAD_LIMIT_BYTES,
	getFacebookExternalMedia,
} from "./facebook-media";

describe("Facebook external media", () => {
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
});
