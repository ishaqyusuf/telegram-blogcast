import { describe, expect, test } from "bun:test";

import {
	PREVIEW_GATEWAY_REVALIDATION_MS,
	getOfflineLocalServiceRetryDelay,
} from "./local-service-retry-policy";

describe("local service retry policy", () => {
	test("keeps preview discovery responsive after a tunnel replacement", () => {
		expect(getOfflineLocalServiceRetryDelay("preview", 0)).toBe(
			PREVIEW_GATEWAY_REVALIDATION_MS,
		);
		expect(getOfflineLocalServiceRetryDelay("preview", 10)).toBe(
			PREVIEW_GATEWAY_REVALIDATION_MS,
		);
	});

	test("preserves development LAN backoff", () => {
		expect(getOfflineLocalServiceRetryDelay("development", 0)).toBe(30_000);
		expect(getOfflineLocalServiceRetryDelay("development", 1)).toBe(60_000);
		expect(getOfflineLocalServiceRetryDelay("development", 10)).toBe(120_000);
	});
});
