import { describe, expect, test } from "bun:test";

import { takeLocalMediaRateLimit } from "./rate-limit";

describe("local media rate limiting", () => {
	test("bounds a client inside a window and resets afterwards", () => {
		const key = `test-${Math.random()}`;
		expect(
			takeLocalMediaRateLimit({ key, limit: 2, windowMs: 100, now: 0 }),
		).toBe(true);
		expect(
			takeLocalMediaRateLimit({ key, limit: 2, windowMs: 100, now: 1 }),
		).toBe(true);
		expect(
			takeLocalMediaRateLimit({ key, limit: 2, windowMs: 100, now: 2 }),
		).toBe(false);
		expect(
			takeLocalMediaRateLimit({ key, limit: 2, windowMs: 100, now: 100 }),
		).toBe(true);
	});
});
