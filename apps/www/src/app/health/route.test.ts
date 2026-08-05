import { describe, expect, test } from "bun:test";

import { GET } from "./route";

describe("local API health route", () => {
	test("reports the local Next gateway as ready", async () => {
		const originalSecret = process.env.LOCAL_MEDIA_SIGNING_SECRET;
		const originalVercel = process.env.VERCEL;
		const originalVercelEnv = process.env.VERCEL_ENV;
		process.env.LOCAL_MEDIA_SIGNING_SECRET = "configured-for-test";
		process.env.VERCEL = "";
		process.env.VERCEL_ENV = "";
		const response = GET();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			service: "al-ghurobaa-local-api",
			capabilities: { largeMedia: true },
		});
		process.env.LOCAL_MEDIA_SIGNING_SECRET = originalSecret ?? "";
		process.env.VERCEL = originalVercel ?? "";
		process.env.VERCEL_ENV = originalVercelEnv ?? "";
	});

	test("does not advertise the local media gateway from Vercel", async () => {
		const originalSecret = process.env.LOCAL_MEDIA_SIGNING_SECRET;
		const originalVercel = process.env.VERCEL;
		process.env.LOCAL_MEDIA_SIGNING_SECRET = "configured-for-test";
		process.env.VERCEL = "1";

		const response = GET();
		expect((await response.json()).capabilities.largeMedia).toBe(false);

		process.env.LOCAL_MEDIA_SIGNING_SECRET = originalSecret ?? "";
		process.env.VERCEL = originalVercel ?? "";
	});
});
