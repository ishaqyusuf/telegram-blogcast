import { describe, expect, test } from "bun:test";

import {
	LOCAL_GATEWAY_LEASE_KEY,
	LOCAL_GATEWAY_LEASE_TTL_MS,
	type LocalGatewayLeaseRecord,
	type LocalGatewayLeaseStore,
	getActiveLocalGatewayLease,
	hasValidDiscoveryToken,
	normalizeNgrokGatewayUrl,
	removeLocalGatewayLease,
	renewLocalGatewayLease,
} from "./local-gateway-discovery";

function createStore(initial?: LocalGatewayLeaseRecord) {
	let record = initial ?? null;
	const store: LocalGatewayLeaseStore = {
		find: async () => record,
		upsert: async (input) => {
			record = {
				...input,
				updatedAt: new Date("2026-07-30T12:00:00.000Z"),
			};
			return record;
		},
		remove: async () => {
			record = null;
		},
	};
	return { store, read: () => record };
}

describe("local gateway discovery lease", () => {
	test("accepts only origin-only free ngrok HTTPS URLs", () => {
		expect(normalizeNgrokGatewayUrl("https://demo.ngrok-free.app")).toBe(
			"https://demo.ngrok-free.app",
		);
		expect(normalizeNgrokGatewayUrl("http://demo.ngrok-free.app")).toBeNull();
		expect(
			normalizeNgrokGatewayUrl("https://demo.ngrok-free.app/api/trpc"),
		).toBeNull();
		expect(normalizeNgrokGatewayUrl("https://example.com")).toBeNull();
	});

	test("compares the publisher bearer token", () => {
		expect(hasValidDiscoveryToken("Bearer secret-value", "secret-value")).toBe(
			true,
		);
		expect(hasValidDiscoveryToken("Bearer wrong-value", "secret-value")).toBe(
			false,
		);
		expect(hasValidDiscoveryToken(null, "secret-value")).toBe(false);
		expect(hasValidDiscoveryToken("Bearer secret-value", undefined)).toBe(
			false,
		);
	});

	test("renews one singleton lease for three minutes", async () => {
		const { store, read } = createStore();
		const now = new Date("2026-07-30T12:00:00.000Z");

		await expect(
			renewLocalGatewayLease(store, "https://demo.ngrok-free.app", now),
		).resolves.toEqual({
			url: "https://demo.ngrok-free.app",
			expiresAt: new Date(
				now.getTime() + LOCAL_GATEWAY_LEASE_TTL_MS,
			).toISOString(),
		});
		expect(read()?.key).toBe(LOCAL_GATEWAY_LEASE_KEY);
	});

	test("returns no URL for missing or expired leases", async () => {
		const expired = new Date("2026-07-30T11:59:59.000Z");
		const { store } = createStore({
			key: LOCAL_GATEWAY_LEASE_KEY,
			url: "https://demo.ngrok-free.app",
			expiresAt: expired,
			updatedAt: expired,
		});

		await expect(
			getActiveLocalGatewayLease(store, new Date("2026-07-30T12:00:00.000Z")),
		).resolves.toEqual({ url: null, expiresAt: null });
	});

	test("removes the singleton lease", async () => {
		const now = new Date("2026-07-30T12:00:00.000Z");
		const { store, read } = createStore({
			key: LOCAL_GATEWAY_LEASE_KEY,
			url: "https://demo.ngrok-free.app",
			expiresAt: new Date(now.getTime() + LOCAL_GATEWAY_LEASE_TTL_MS),
			updatedAt: now,
		});

		await removeLocalGatewayLease(store);
		expect(read()).toBeNull();
	});
});
