import { describe, expect, test } from "bun:test";

import {
	buildRemoteLocalServiceUrls,
	buildLocalServiceUrls,
	getPreferredLocalServiceIp,
	normalizeLocalServiceIpInput,
} from "./local-service-urls";

describe("local service URLs", () => {
	test("normalizes bare hosts and full URLs to one IP", () => {
		expect(normalizeLocalServiceIpInput("192.168.1.44:3006")).toBe(
			"192.168.1.44",
		);
		expect(normalizeLocalServiceIpInput("http://10.0.0.5:8787/health")).toBe(
			"10.0.0.5",
		);
	});

	test("routes preview API traffic through ngrok and keeps worker URLs local to the gateway", () => {
		expect(
			buildRemoteLocalServiceUrls("https://demo.ngrok-free.app"),
		).toEqual({
			host: "demo.ngrok-free.app",
			apiBaseUrl: "https://demo.ngrok-free.app",
			apiTrpcUrl: "https://demo.ngrok-free.app/api/trpc",
			transcriberBaseUrl: "http://127.0.0.1:8787",
			facebookMediaBridgeBaseUrl: "http://127.0.0.1:8790",
		});
	});

	test("builds service URLs from a shared IP and per-service ports", () => {
		expect(buildLocalServiceUrls("192.168.1.44")).toEqual({
			host: "192.168.1.44",
			apiBaseUrl: "http://192.168.1.44:3501",
			apiTrpcUrl: "http://192.168.1.44:3501/api/trpc",
			transcriberBaseUrl: "http://192.168.1.44:8787",
			facebookMediaBridgeBaseUrl: "http://192.168.1.44:8790",
		});
	});

	test("prefers manual IP over automatic candidates", () => {
		expect(
			getPreferredLocalServiceIp({
				manualIp: "192.168.1.44",
				lastUsedIp: "192.168.1.22",
				currentIp: "10.0.0.5",
			}),
		).toBe("192.168.1.44");
	});
});
