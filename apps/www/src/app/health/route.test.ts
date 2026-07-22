import { describe, expect, test } from "bun:test";

import { GET } from "./route";

describe("local API health route", () => {
	test("reports the local Next gateway as ready", async () => {
		const response = GET();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			service: "al-ghurobaa-local-api",
		});
	});
});
