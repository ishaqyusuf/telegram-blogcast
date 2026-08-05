import { describe, expect, test } from "bun:test";

import { parseLocalMediaStatus, parseLocalMediaTicket } from "./local-media";

describe("local media gateway contract", () => {
	test("parses valid status and ticket responses", () => {
		expect(
			parseLocalMediaStatus({ state: "preparing", progress: 0.5 }),
		).toEqual({
			state: "preparing",
			progress: 0.5,
		});
		expect(parseLocalMediaTicket({ mediaId: 42, ticket: "signed" })).toEqual({
			mediaId: 42,
			ticket: "signed",
		});
	});

	test("rejects malformed responses instead of polling indefinitely", () => {
		expect(() => parseLocalMediaStatus({ status: "ready" })).toThrow();
		expect(() =>
			parseLocalMediaStatus({ state: "ready", progress: 1 }),
		).toThrow();
		expect(() => parseLocalMediaTicket({ mediaId: 42 })).toThrow();
	});
});
