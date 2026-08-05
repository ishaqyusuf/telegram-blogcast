import { describe, expect, test } from "bun:test";

import {
	buildLocalMediaStreamUrl,
	prepareLocalMediaPlayback,
} from "./local-media-playback";

describe("local large-media playback client", () => {
	test("prepares a fetchable item and returns its signed stream URL", async () => {
		const requests: { method: string; url: string }[] = [];
		const responses = [
			Response.json({ mediaId: 42, ticket: "signed-ticket" }),
			Response.json({ state: "fetchable", progress: 0 }),
			Response.json({ state: "preparing", progress: 0 }, { status: 202 }),
			Response.json({ state: "preparing", progress: 0.5 }),
			Response.json({
				state: "ready",
				progress: 1,
				size: 100,
				fileName: "lesson.mp3",
				mimeType: "audio/mpeg",
			}),
		];
		const progress: number[] = [];

		const result = await prepareLocalMediaPlayback({
			mediaId: 42,
			clientId: "0123456789abcdef",
			productionBaseUrl: "https://app.example",
			gatewayBaseUrl: "https://gateway.example",
			fetchImpl: async (input, init) => {
				requests.push({
					method: init?.method ?? "GET",
					url: String(input),
				});
				const response = responses.shift();
				if (!response) throw new Error("Missing mocked response");
				return response;
			},
			sleep: async () => undefined,
			onProgress: (value) => progress.push(value),
		});

		expect(result).toEqual({
			state: "ready",
			url: "https://gateway.example/api/telegram/local-media/42/stream?ticket=signed-ticket",
		});
		expect(requests.map((request) => request.method)).toEqual([
			"POST",
			"GET",
			"POST",
			"GET",
			"GET",
		]);
		expect(progress).toContain(0.5);
	});

	test("preserves an unavailable result instead of returning a broken URL", async () => {
		const responses = [
			Response.json({ mediaId: 42, ticket: "signed-ticket" }),
			Response.json({ state: "unavailable", progress: 0 }),
		];
		await expect(
			prepareLocalMediaPlayback({
				mediaId: 42,
				clientId: "0123456789abcdef",
				productionBaseUrl: "https://app.example",
				gatewayBaseUrl: "https://gateway.example",
				fetchImpl: async () => {
					const response = responses.shift();
					if (!response) throw new Error("Missing mocked response");
					return response;
				},
			}),
		).resolves.toEqual({ state: "unavailable", url: null });
	});

	test("encodes the media ticket in the stream URL", () => {
		expect(
			buildLocalMediaStreamUrl("https://gateway.example/", 7, "a+b/c="),
		).toBe(
			"https://gateway.example/api/telegram/local-media/7/stream?ticket=a%2Bb%2Fc%3D",
		);
	});
});
