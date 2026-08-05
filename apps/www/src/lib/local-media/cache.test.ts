import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalMediaCache } from "./cache";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

async function makeCache(
	download: Parameters<typeof createLocalMediaCache>[0]["download"],
	options?: { maxBytes?: number },
) {
	const cacheDir = await mkdtemp(join(tmpdir(), "al-ghurobaa-media-test-"));
	temporaryDirectories.push(cacheDir);
	return createLocalMediaCache({
		cacheDir,
		resolveSource: async (mediaId) =>
			mediaId === 42 || mediaId === 43
				? {
						mediaId,
						peer: "t.me/example_channel",
						messageId: 123,
						fileName: "lesson.mp3",
						mimeType: "audio/mpeg",
					}
				: null,
		download,
		maxBytes: options?.maxBytes,
	});
}

describe("local media cache", () => {
	test("reports whether a media item can be fetched", async () => {
		const cache = await makeCache(async () => undefined);

		await expect(cache.getStatus(42)).resolves.toMatchObject({
			state: "fetchable",
		});
		await expect(cache.getStatus(99)).resolves.toEqual({
			state: "unavailable",
			progress: 0,
		});
	});

	test("deduplicates preparation and exposes the completed file", async () => {
		let downloads = 0;
		const cache = await makeCache(async ({ destination, onProgress }) => {
			downloads += 1;
			onProgress(0.5);
			await writeFile(destination, "0123456789");
		});

		const first = cache.prepare(42);
		const second = cache.prepare(42);
		expect(downloads).toBe(0);
		expect((await cache.getStatus(42)).state).toBe("preparing");

		await expect(Promise.all([first, second])).resolves.toEqual([
			expect.objectContaining({ state: "ready", size: 10 }),
			expect.objectContaining({ state: "ready", size: 10 }),
		]);
		expect(downloads).toBe(1);
		await expect(cache.getReadyFile(42)).resolves.toMatchObject({
			fileName: "lesson.mp3",
			mimeType: "audio/mpeg",
			size: 10,
		});
	});

	test("evicts the least-recent completed files when the disk quota is exceeded", async () => {
		const cache = await makeCache(
			async ({ source, destination }) => {
				await writeFile(destination, String(source.mediaId).repeat(4));
			},
			{ maxBytes: 10 },
		);

		await cache.prepare(42);
		await new Promise((resolve) => setTimeout(resolve, 5));
		await cache.prepare(43);

		await expect(cache.getReadyFile(42)).resolves.toBeNull();
		await expect(cache.getReadyFile(43)).resolves.toMatchObject({ size: 8 });
	});
});
