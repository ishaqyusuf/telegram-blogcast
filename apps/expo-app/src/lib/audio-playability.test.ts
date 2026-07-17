import { describe, expect, test } from "bun:test";

import {
	TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES,
	getAudioPlayability,
} from "./audio-playability";

describe("audio playability", () => {
	test("allows Telegram audio at the download limit", () => {
		expect(
			getAudioPlayability({
				source: "telegram",
				telegramFileId: "file-id",
				size: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES,
			}).canPlay,
		).toBe(true);
	});

	test("blocks Telegram audio above the download limit", () => {
		const result = getAudioPlayability({
			source: "telegram",
			telegramFileId: "file-id",
			size: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES + 1,
		});

		expect(result.canPlay).toBe(false);
		expect(result.reason).toContain("20 MB");
	});

	test("blocks Telegram-sourced oversized audio even without a file id", () => {
		expect(
			getAudioPlayability({
				source: "telegram",
				size: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES + 1,
			}).canPlay,
		).toBe(false);
	});

	test("allows oversized blob audio with a direct URL", () => {
		expect(
			getAudioPlayability({
				source: "vercel_blob",
				telegramFileId: "file-id",
				url: "https://blob.example/audio.mp3",
				size: TELEGRAM_BOT_DOWNLOAD_LIMIT_BYTES + 1,
			}).canPlay,
		).toBe(true);
	});

	test("allows unknown sizes to try playback", () => {
		expect(
			getAudioPlayability({
				source: "telegram",
				telegramFileId: "file-id",
				size: null,
			}).canPlay,
		).toBe(true);
	});
});
