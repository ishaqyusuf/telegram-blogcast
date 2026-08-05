import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLocalMediaTicket } from "@/lib/local-media/ticket";

const secret = "test-local-media-signing-secret-with-enough-entropy";
const originalSecret = process.env.LOCAL_MEDIA_SIGNING_SECRET;
process.env.LOCAL_MEDIA_SIGNING_SECRET = secret;

let readyFile: {
	path: string;
	size: number;
	fileName: string;
	mimeType: string;
} | null = null;

mock.module("@/lib/local-media/runtime", () => ({
	isLocalMediaGatewayEnabled: () => true,
	localMediaCache: {
		getReadyFile: async () => readyFile,
	},
}));

const { GET } = await import("./route");
const temporaryDirectories: string[] = [];

afterEach(async () => {
	readyFile = null;
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

afterAll(() => {
	process.env.LOCAL_MEDIA_SIGNING_SECRET = originalSecret;
});

function ticket(mediaId = 42) {
	return createLocalMediaTicket({ mediaId, secret });
}

describe("local media stream route", () => {
	test("requires a valid ticket bound to the requested media", async () => {
		const response = await GET(
			new Request(
				`https://gateway.example/api/telegram/local-media/42/stream?ticket=${ticket(43)}`,
			),
			{ params: Promise.resolve({ mediaId: "42" }) },
		);

		expect(response.status).toBe(401);
	});

	test("serves the requested byte range from a ready cached file", async () => {
		const directory = await mkdtemp(join(tmpdir(), "local-media-route-test-"));
		temporaryDirectories.push(directory);
		const path = join(directory, "media.data");
		await writeFile(path, "0123456789");
		readyFile = {
			path,
			size: 10,
			fileName: "lesson.mp3",
			mimeType: "audio/mpeg",
		};

		const response = await GET(
			new Request(
				`https://gateway.example/api/telegram/local-media/42/stream?ticket=${ticket()}`,
				{ headers: { Range: "bytes=2-5" } },
			),
			{ params: Promise.resolve({ mediaId: "42" }) },
		);

		expect(response.status).toBe(206);
		expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
		expect(response.headers.get("accept-ranges")).toBe("bytes");
		expect(await response.text()).toBe("2345");
	});
});
