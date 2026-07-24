import { afterEach, describe, expect, test } from "bun:test";

import {
	checkLocalApiBaseUrl,
	getLocalApiIpCandidates,
	resolveReachableLocalApi,
} from "./local-api-ip-cache";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("local API discovery", () => {
	test("tries the selected IP first and deduplicates automatic and historical candidates", () => {
		expect(
			getLocalApiIpCandidates({
				lastUsedIp: "192.168.1.20",
				currentIp: "192.168.1.60",
				history: ["192.168.1.40", "not-an-ip", "192.168.1.20", "192.168.1.50"],
			}),
		).toEqual([
			{ ip: "192.168.1.20", source: "last" },
			{ ip: "192.168.1.40", source: "history" },
			{ ip: "192.168.1.50", source: "history" },
			{ ip: "192.168.1.60", source: "current" },
		]);
	});

	test("finishes the selected-IP attempt before checking saved history", async () => {
		let selectedAttemptFinished = false;

		const result = await resolveReachableLocalApi({
			lastUsedIp: "192.168.1.20",
			currentIp: null,
			history: ["192.168.1.40", "192.168.1.50"],
			probe: async (baseUrl) => {
				if (baseUrl.endsWith("192.168.1.20:3501")) {
					selectedAttemptFinished = true;
					return false;
				}
				expect(selectedAttemptFinished).toBe(true);
				return baseUrl.endsWith("192.168.1.50:3501");
			},
		});

		expect(result).toEqual({
			ip: "192.168.1.50",
			source: "history",
			baseUrl: "http://192.168.1.50:3501",
		});
	});

	test("selects the earliest reachable saved IP even when another probe responds first", async () => {
		const result = await resolveReachableLocalApi({
			lastUsedIp: "192.168.1.20",
			currentIp: null,
			history: ["192.168.1.40", "192.168.1.50"],
			probe: async (baseUrl) => {
				if (baseUrl.endsWith("192.168.1.20:3501")) return false;
				if (baseUrl.endsWith("192.168.1.40:3501")) {
					await new Promise((resolve) => setTimeout(resolve, 5));
				}
				return true;
			},
		});

		expect(result?.ip).toBe("192.168.1.40");
	});

	test("accepts only the Al-Ghurobaa local gateway health response", async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					ok: true,
					service: "al-ghurobaa-local-api",
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			)) as typeof fetch;

		expect(await checkLocalApiBaseUrl("http://192.168.1.20:3501")).toBe(true);

		globalThis.fetch = (async () =>
			new Response("<html>Router login</html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			})) as typeof fetch;

		expect(await checkLocalApiBaseUrl("http://192.168.1.1:3501")).toBe(false);
	});
});
