import { describe, expect, test } from "bun:test";

import { resolveLocalMediaSource } from "./source";

describe("local media Telegram source resolution", () => {
	test("uses the stored channel username and Telegram message id", () => {
		expect(
			resolveLocalMediaSource({
				id: 7,
				file: {
					fileName: "lesson.mp3",
					mimeType: "audio/mpeg",
					fileSize: 25_000_000,
				},
				blog: {
					telegramMessageId: 321,
					meta: null,
					channel: { username: "example_channel" },
				},
			}),
		).toEqual({
			mediaId: 7,
			peer: "t.me/example_channel",
			messageId: 321,
			fileName: "lesson.mp3",
			mimeType: "audio/mpeg",
			size: 25_000_000,
		});
	});

	test("uses the archived Telegram message recorded by a Facebook import", () => {
		expect(
			resolveLocalMediaSource({
				id: 8,
				file: { fileName: "saved-video.mp4", mimeType: "video/mp4" },
				blog: {
					telegramMessageId: null,
					channel: null,
					meta: {
						facebook: {
							mediaDownload: { chatId: -1001234567890, messageId: 77 },
						},
					},
				},
			}),
		).toEqual({
			mediaId: 8,
			peer: -1001234567890,
			messageId: 77,
			fileName: "saved-video.mp4",
			mimeType: "video/mp4",
			size: null,
		});
	});

	test("reports media without a recoverable Telegram message as unavailable", () => {
		expect(
			resolveLocalMediaSource({
				id: 9,
				file: { fileName: null, mimeType: null },
				blog: {
					telegramMessageId: null,
					channel: null,
					meta: { facebook: { mediaDownload: { messageId: null } } },
				},
			}),
		).toBeNull();
	});
});
