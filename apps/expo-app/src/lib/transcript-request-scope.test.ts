import { describe, expect, test } from "bun:test";

import {
	runScopedTranscriptRequest,
	type CurrentTranscriptRequestScope,
} from "./transcript-request-scope";

describe("scoped transcript requests", () => {
	test("ignores a deferred media A response after navigation to media B", async () => {
		let resolveMediaA!: (value: string) => void;
		const mediaAResponse = new Promise<string>((resolve) => {
			resolveMediaA = resolve;
		});
		let currentScope: CurrentTranscriptRequestScope = {
			mediaId: 1,
			epoch: 0,
		};
		const applied: string[] = [];
		const errors: unknown[] = [];
		const request = runScopedTranscriptRequest(
			{ mediaId: 1, epoch: 0 },
			() => currentScope,
			() => mediaAResponse,
			(value) => applied.push(value),
			(error) => errors.push(error),
		);

		currentScope = { mediaId: 2, epoch: 1 };
		resolveMediaA("media A transcript");

		expect(await request).toEqual({ status: "cancelled" });
		expect(applied).toEqual([]);
		expect(errors).toEqual([]);
	});

	test("applies current success and reports current errors", async () => {
		let currentScope: CurrentTranscriptRequestScope = {
			mediaId: 1,
			epoch: 0,
		};
		const applied: string[] = [];
		const errors: unknown[] = [];

		const success = await runScopedTranscriptRequest(
			{ mediaId: 1, epoch: 0 },
			() => currentScope,
			async () => "current transcript",
			(value) => applied.push(value),
			(error) => errors.push(error),
		);
		const failure = new Error("offline");
		const error = await runScopedTranscriptRequest(
			{ mediaId: 1, epoch: 0 },
			() => currentScope,
			async () => {
				throw failure;
			},
			(value) => applied.push(value),
			(value) => errors.push(value),
		);

		expect(success).toEqual({ status: "applied" });
		expect(error).toEqual({ status: "error", error: failure });
		expect(applied).toEqual(["current transcript"]);
		expect(errors).toEqual([failure]);
	});
});
