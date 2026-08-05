import { describe, expect, test } from "bun:test";

import { GET } from "./route";

describe("local API health route", () => {
	test("reports the local Next gateway as ready", async () => {
		const environment = process.env as Record<string, string | undefined>;
		const originalSecret = environment.LOCAL_MEDIA_SIGNING_SECRET;
		const originalVercel = environment.VERCEL;
		const originalVercelEnv = environment.VERCEL_ENV;
		environment.LOCAL_MEDIA_SIGNING_SECRET = "configured-for-test";
		environment.VERCEL = "";
		environment.VERCEL_ENV = "";
		const response = GET();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			service: "al-ghurobaa-local-api",
			capabilities: { largeMedia: true },
		});
		environment.LOCAL_MEDIA_SIGNING_SECRET = originalSecret ?? "";
		environment.VERCEL = originalVercel ?? "";
		environment.VERCEL_ENV = originalVercelEnv ?? "";
	});

	test("does not advertise the local media gateway from Vercel", async () => {
		const environment = process.env as Record<string, string | undefined>;
		const originalSecret = environment.LOCAL_MEDIA_SIGNING_SECRET;
		const originalVercel = environment.VERCEL;
		environment.LOCAL_MEDIA_SIGNING_SECRET = "configured-for-test";
		environment.VERCEL = "1";

		const response = GET();
		expect((await response.json()).capabilities.largeMedia).toBe(false);

		environment.LOCAL_MEDIA_SIGNING_SECRET = originalSecret ?? "";
		environment.VERCEL = originalVercel ?? "";
	});
});
