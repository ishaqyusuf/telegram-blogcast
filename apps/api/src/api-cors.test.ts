import { afterEach, expect, test } from "bun:test";
import { Hono } from "hono";
import { apiCors } from "./api-cors";

const original = process.env.NODE_ENV;
afterEach(() => {
	process.env.NODE_ENV = original;
});

test("hosted tRPC preflight accepts the web client and import capability header", async () => {
	process.env.NODE_ENV = "production";
	const app = new Hono().use("/api/trpc/*", apiCors());
	const response = await app.request("/api/trpc/bookChapter.capture", {
		method: "OPTIONS",
		headers: {
			origin: "https://alghurobaa.vercel.app",
			"access-control-request-method": "POST",
		},
	});
	expect(response.status).toBe(204);
	expect(response.headers.get("access-control-allow-origin")).toBe(
		"https://alghurobaa.vercel.app",
	);
	expect(response.headers.get("access-control-allow-headers")).toContain(
		"x-book-import-token",
	);
});

test("hosted API does not permit an unrelated browser origin", async () => {
	process.env.NODE_ENV = "production";
	const app = new Hono()
		.use("/api/trpc/*", apiCors())
		.get("/api/trpc/read", (c) => c.json({ ok: true }));
	const response = await app.request("/api/trpc/read", {
		headers: { origin: "https://unrelated.example" },
	});
	expect(response.headers.get("access-control-allow-origin")).toBeNull();
});
