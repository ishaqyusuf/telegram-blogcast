import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

type Lease = {
	key: string;
	url: string;
	expiresAt: Date;
	updatedAt: Date;
};

let lease: Lease | null = null;

mock.module("@acme/db", () => ({
	db: {
		localGatewayLease: {
			findUnique: async () => lease,
			upsert: async ({
				create,
				update,
			}: {
				create: Lease;
				update: Pick<Lease, "url" | "expiresAt">;
			}) => {
				lease = lease
					? { ...lease, ...update, updatedAt: new Date() }
					: { ...create, updatedAt: new Date() };
				return lease;
			},
			deleteMany: async () => {
				lease = null;
			},
		},
	},
}));

const originalToken = process.env.LOCAL_SERVICES_DISCOVERY_TOKEN;
process.env.LOCAL_SERVICES_DISCOVERY_TOKEN = "test-discovery-token";

const { DELETE, GET, PUT } = await import("./route");

beforeEach(() => {
	lease = null;
});

afterAll(() => {
	if (originalToken === undefined) {
		process.env.LOCAL_SERVICES_DISCOVERY_TOKEN = undefined;
	} else {
		process.env.LOCAL_SERVICES_DISCOVERY_TOKEN = originalToken;
	}
});

function request(method: "PUT" | "DELETE", token?: string, body?: unknown) {
	return new Request(
		"https://alghurobaa.vercel.app/api/local-services/discovery",
		{
			method,
			headers: {
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		},
	);
}

describe("local-services discovery route", () => {
	test("GET is public, returns an empty lease, and disables caching", async () => {
		const response = await GET();

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toContain("no-store");
		await expect(response.json()).resolves.toEqual({
			url: null,
			expiresAt: null,
		});
	});

	test("PUT requires the publisher token and validates the ngrok origin", async () => {
		expect(
			(
				await PUT(
					request("PUT", undefined, {
						url: "https://demo.ngrok-free.app",
					}),
				)
			).status,
		).toBe(401);
		expect(
			(
				await PUT(
					request("PUT", "test-discovery-token", {
						url: "https://example.com",
					}),
				)
			).status,
		).toBe(400);

		const response = await PUT(
			request("PUT", "test-discovery-token", {
				url: "https://demo.ngrok-free.app",
			}),
		);
		expect(response.status).toBe(200);
		expect((await response.json()).url).toBe("https://demo.ngrok-free.app");
	});

	test("DELETE requires the publisher token and clears the lease", async () => {
		await PUT(
			request("PUT", "test-discovery-token", {
				url: "https://demo.ngrok-free.app",
			}),
		);
		expect((await DELETE(request("DELETE"))).status).toBe(401);
		expect(
			(await DELETE(request("DELETE", "test-discovery-token"))).status,
		).toBe(200);
		expect(lease).toBeNull();
	});
});
