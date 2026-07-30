import { describe, expect, test } from "bun:test";

import {
	getLocalApiQueryKey,
	shouldApplyLocalApiResult,
} from "./local-api-query";

describe("local API query keys", () => {
	test("scopes local workflow data by active gateway URL", () => {
		expect(
			getLocalApiQueryKey("https://demo.ngrok-free.app", "facebookImport.checkBridge", {
				baseUrl: "http://192.168.18.3:8790",
			}),
		).toEqual([
			"local-api",
			"https://demo.ngrok-free.app",
			"facebookImport.checkBridge",
			{ baseUrl: "http://192.168.18.3:8790" },
		]);
	});

	test("rejects a response from a gateway that is no longer active", () => {
		expect(
			shouldApplyLocalApiResult(
				"https://old.ngrok-free.app",
				"https://new.ngrok-free.app",
			),
		).toBe(false);
		expect(
			shouldApplyLocalApiResult(
				"https://new.ngrok-free.app",
				"https://new.ngrok-free.app",
			),
		).toBe(true);
	});
});
