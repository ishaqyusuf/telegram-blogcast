import { describe, expect, test } from "bun:test";

import {
	getTranscriptionQueueLoadKey,
	isTranscriptionQueueInitialLoadComplete,
	shouldPollTranscriptionQueue,
} from "./transcription-queue-state";

describe("transcription queue state", () => {
	test("keeps an empty initial result distinct from an unloaded queue", () => {
		const key = getTranscriptionQueueLoadKey({
			activeGatewayUrl: "http://gateway-a",
			mediaId: 42,
			localServicesEnabled: true,
			connectionStatus: "online",
			autoLoad: true,
		});

		expect(isTranscriptionQueueInitialLoadComplete(null, key)).toBe(false);
		expect(isTranscriptionQueueInitialLoadComplete(key, key)).toBe(true);
		expect(
			isTranscriptionQueueInitialLoadComplete(
				key,
				getTranscriptionQueueLoadKey({
					activeGatewayUrl: "http://gateway-a",
					mediaId: 43,
					localServicesEnabled: true,
					connectionStatus: "online",
					autoLoad: true,
				}),
			),
		).toBe(false);
	});

	test("polls an idle queue only when explicitly opted in", () => {
		const base = {
			autoLoad: true,
			localServicesEnabled: true,
			connectionStatus: "online",
			initialLoadComplete: true,
			hasActiveJobs: false,
		};

		expect(
			shouldPollTranscriptionQueue({ ...base, pollWhenIdle: false }),
		).toBe(false);
		expect(
			shouldPollTranscriptionQueue({ ...base, pollWhenIdle: true }),
		).toBe(true);
		expect(
			shouldPollTranscriptionQueue({
				...base,
				pollWhenIdle: false,
				hasActiveJobs: true,
			}),
		).toBe(true);
		expect(
			shouldPollTranscriptionQueue({
				...base,
				pollWhenIdle: true,
				initialLoadComplete: false,
			}),
		).toBe(false);
	});
});
