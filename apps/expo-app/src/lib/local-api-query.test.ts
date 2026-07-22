import { describe, expect, test } from "bun:test";

import {
	getLocalApiQueryKey,
	shouldApplyLocalApiResult,
} from "./local-api-query";

describe("local API query keys", () => {
	test("scopes local workflow data by selected IP", () => {
		expect(
			getLocalApiQueryKey("192.168.18.3", "facebookImport.checkBridge", {
				baseUrl: "http://192.168.18.3:8790",
			}),
		).toEqual([
			"local-api",
			"192.168.18.3",
			"facebookImport.checkBridge",
			{ baseUrl: "http://192.168.18.3:8790" },
		]);
	});

	test("rejects a response from an IP that is no longer active", () => {
		expect(shouldApplyLocalApiResult("192.168.18.3", "192.168.18.4")).toBe(
			false,
		);
		expect(shouldApplyLocalApiResult("192.168.18.4", "192.168.18.4")).toBe(
			true,
		);
	});
});
