import { afterAll, describe, expect, mock, test } from "bun:test";

mock.module("@acme/db", () => ({
	db: {
		media: {
			findUnique: async ({ where }: { where: { id: number } }) =>
				where.id === 42 ? { id: 42, blog: { deletedAt: null } } : null,
		},
	},
}));

const originalSecret = process.env.LOCAL_MEDIA_SIGNING_SECRET;
process.env.LOCAL_MEDIA_SIGNING_SECRET =
	"test-local-media-signing-secret-with-enough-entropy";

const { POST } = await import("./route");

afterAll(() => {
	process.env.LOCAL_MEDIA_SIGNING_SECRET = originalSecret;
});

describe("local media ticket route", () => {
	test("requires a stable client id before issuing a ticket", async () => {
		const response = await POST(
			new Request("https://example.com/api/telegram/local-media/ticket", {
				method: "POST",
				body: JSON.stringify({ mediaId: 42 }),
			}),
		);

		expect(response.status).toBe(400);
	});

	test("issues a ticket for an existing, non-deleted media item", async () => {
		const response = await POST(
			new Request("https://example.com/api/telegram/local-media/ticket", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-local-media-client-id": "0123456789abcdef",
				},
				body: JSON.stringify({ mediaId: 42 }),
			}),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(await response.json()).toMatchObject({
			mediaId: 42,
			ticket: expect.any(String),
		});
	});

	test("does not issue tickets for missing media", async () => {
		const response = await POST(
			new Request("https://example.com/api/telegram/local-media/ticket", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-local-media-client-id": "fedcba9876543210",
				},
				body: JSON.stringify({ mediaId: 99 }),
			}),
		);

		expect(response.status).toBe(404);
	});
});
