import { describe, expect, test } from "bun:test";

import { createTransportAwareLocalFetch } from "./local-api-transport";

describe("local API transport failover", () => {
	test("requests gateway discovery after a network failure", async () => {
		let failures = 0;
		const transportFetch = createTransportAwareLocalFetch(
			() => {
				failures += 1;
			},
			(async () => {
				throw new Error("old tunnel is gone");
			}) as typeof fetch,
		);

		await expect(transportFetch("https://old.ngrok-free.app")).rejects.toThrow(
			"old tunnel is gone",
		);
		expect(failures).toBe(1);
	});

	test("requests gateway discovery for tunnel gateway errors", async () => {
		let failures = 0;
		const transportFetch = createTransportAwareLocalFetch(
			() => {
				failures += 1;
			},
			(async () => new Response("offline", { status: 502 })) as typeof fetch,
		);

		await expect(
			transportFetch("https://old.ngrok-free.app"),
		).resolves.toHaveProperty("status", 502);
		expect(failures).toBe(1);
	});

	test("does not refresh discovery for application responses", async () => {
		let failures = 0;
		const transportFetch = createTransportAwareLocalFetch(
			() => {
				failures += 1;
			},
			(async () => Response.json({ ok: true })) as typeof fetch,
		);

		await expect(
			transportFetch("https://current.ngrok-free.app"),
		).resolves.toHaveProperty("status", 200);
		expect(failures).toBe(0);
	});
});
