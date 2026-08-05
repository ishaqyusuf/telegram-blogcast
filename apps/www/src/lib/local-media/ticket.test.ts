import { describe, expect, test } from "bun:test";

import { createLocalMediaTicket, verifyLocalMediaTicket } from "./ticket";

const secret = "test-local-media-secret-with-enough-entropy";
const now = new Date("2026-08-05T12:00:00.000Z");

describe("local media playback tickets", () => {
	test("authorizes only the media id embedded in an unexpired ticket", () => {
		const ticket = createLocalMediaTicket({
			mediaId: 42,
			secret,
			now,
			ttlMs: 60_000,
		});

		expect(
			verifyLocalMediaTicket(ticket, {
				mediaId: 42,
				secret,
				now: new Date("2026-08-05T12:00:30.000Z"),
			}),
		).toBe(true);
		expect(
			verifyLocalMediaTicket(ticket, {
				mediaId: 43,
				secret,
				now: new Date("2026-08-05T12:00:30.000Z"),
			}),
		).toBe(false);
	});

	test("rejects expired and tampered tickets", () => {
		const ticket = createLocalMediaTicket({
			mediaId: 42,
			secret,
			now,
			ttlMs: 1_000,
		});

		expect(
			verifyLocalMediaTicket(ticket, {
				mediaId: 42,
				secret,
				now: new Date("2026-08-05T12:00:01.001Z"),
			}),
		).toBe(false);
		expect(
			verifyLocalMediaTicket(`${ticket.slice(0, -1)}x`, {
				mediaId: 42,
				secret,
				now,
			}),
		).toBe(false);
	});
});
