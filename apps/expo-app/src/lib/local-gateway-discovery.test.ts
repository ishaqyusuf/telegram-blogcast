import { describe, expect, test } from "bun:test";

import {
	buildLocalGatewayDiscoveryUrl,
	fetchActiveLocalGateway,
	normalizeDiscoveredGatewayUrl,
	resolveReachableLocalGateway,
} from "./local-gateway-discovery";

describe("preview local gateway discovery", () => {
	test("joins the production origin without duplicating the API prefix", () => {
		expect(
			buildLocalGatewayDiscoveryUrl("https://alghurobaa.vercel.app"),
		).toBe(
			"https://alghurobaa.vercel.app/api/local-services/discovery",
		);
		expect(
			buildLocalGatewayDiscoveryUrl("https://alghurobaa.vercel.app/api/"),
		).toBe(
			"https://alghurobaa.vercel.app/api/local-services/discovery",
		);
		expect(
			buildLocalGatewayDiscoveryUrl(
				"https://alghurobaa.vercel.app/api/api/",
			),
		).not.toContain("/api/api/");
	});

	test("accepts only free ngrok HTTPS origins", () => {
		expect(
			normalizeDiscoveredGatewayUrl("https://demo.ngrok-free.app"),
		).toBe("https://demo.ngrok-free.app");
		expect(
			normalizeDiscoveredGatewayUrl("https://demo.ngrok-free.app/path"),
		).toBeNull();
		expect(
			normalizeDiscoveredGatewayUrl("https://malicious.example.com"),
		).toBeNull();
	});

	test("returns a current lease and ignores expired or missing leases", async () => {
		const now = new Date("2026-07-30T12:00:00.000Z");
		const fetchImpl = (async () =>
			Response.json({
				url: "https://demo.ngrok-free.app",
				expiresAt: "2026-07-30T12:03:00.000Z",
			})) as typeof fetch;

		await expect(
			fetchActiveLocalGateway({
				productionBaseUrl: "https://alghurobaa.vercel.app",
				fetchImpl,
				now,
			}),
		).resolves.toBe("https://demo.ngrok-free.app");

		await expect(
			fetchActiveLocalGateway({
				productionBaseUrl: "https://alghurobaa.vercel.app",
				fetchImpl: (async () =>
					Response.json({
						url: "https://demo.ngrok-free.app",
						expiresAt: "2026-07-30T11:59:59.000Z",
					})) as typeof fetch,
				now,
			}),
		).resolves.toBeNull();
	});

	test("fails silently when production discovery is unavailable", async () => {
		await expect(
			fetchActiveLocalGateway({
				productionBaseUrl: "https://alghurobaa.vercel.app",
				fetchImpl: (async () => {
					throw new Error("offline");
				}) as typeof fetch,
			}),
		).resolves.toBeNull();
	});

	test("bounds a stalled production discovery request", async () => {
		await expect(
			fetchActiveLocalGateway({
				productionBaseUrl: "https://alghurobaa.vercel.app",
				fetchImpl: (async (_url, init) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener(
							"abort",
							() => reject(new Error("aborted")),
							{ once: true },
						);
					})) as typeof fetch,
				timeoutMs: 1,
			}),
		).resolves.toBeNull();
	});

	test("returns only a discovered gateway that passes its local health check", async () => {
		const fetchImpl = (async () =>
			Response.json({
				url: "https://demo.ngrok-free.app",
				expiresAt: "2026-07-30T12:03:00.000Z",
			})) as typeof fetch;

		await expect(
			resolveReachableLocalGateway({
				productionBaseUrl: "https://alghurobaa.vercel.app",
				fetchImpl,
				now: new Date("2026-07-30T12:00:00.000Z"),
				checkHealth: async () => true,
			}),
		).resolves.toBe("https://demo.ngrok-free.app");
		await expect(
			resolveReachableLocalGateway({
				productionBaseUrl: "https://alghurobaa.vercel.app",
				fetchImpl,
				now: new Date("2026-07-30T12:00:00.000Z"),
				checkHealth: async () => false,
			}),
		).resolves.toBeNull();
	});
});
