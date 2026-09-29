import { describe, expect, mock, test } from "bun:test";

const files = new Map<string, number>();
const scoped = "file:///scoped/audio";
const privateDir = "file:///private/audio";

mock.module("expo-file-system/legacy", () => ({
	getInfoAsync: async (uri: string) =>
		files.has(uri) ? { exists: true, size: files.get(uri) } : { exists: false },
	readDirectoryAsync: async (directory: string) =>
		[...files.keys()]
			.filter((uri) => uri.startsWith(`${directory}/`))
			.map((uri) => uri.slice(directory.length + 1)),
}));

mock.module("./media-cache", () => ({
	getMediaTargetUri: async ({ cacheKey, fileName }: { cacheKey: string | number; fileName: string }) =>
		`${scoped}/${cacheKey}-${fileName}`,
	getPrivateMediaTargetUri: async ({ cacheKey, fileName }: { cacheKey: string | number; fileName: string }) =>
		`${privateDir}/${cacheKey}-${fileName}`,
	getUsableCachedMediaUri: async (uri: string) =>
		(files.get(uri) ?? 0) > 0 ? uri : null,
}));

const { getDownloadedAudio } = await import("./downloaded-audio");

describe("downloaded audio lookup", () => {
	test("turns offline state on only for a complete file", async () => {
		files.clear();
		files.set(`${scoped}/media-42-audio.mp3`, 90);
		expect(await getDownloadedAudio({ mediaId: 42, fileName: "audio.mp3", size: 100 })).toBeNull();
		files.set(`${scoped}/media-42-audio.mp3`, 100);
		expect(await getDownloadedAudio({ mediaId: 42, fileName: "audio.mp3", size: 100 }))
			.toBe(`${scoped}/media-42-audio.mp3`);
	});

	test("finds a verified file from an older private directory or filename", async () => {
		files.clear();
		files.set(`${privateDir}/media-42-old-name.mp3`, 100);
		files.set(`${scoped}/media-42-new-name.mp3.part`, 100);
		expect(await getDownloadedAudio({ mediaId: 42, fileName: "new-name.mp3", size: 100 }))
			.toBe(`${privateDir}/media-42-old-name.mp3`);
	});
});
