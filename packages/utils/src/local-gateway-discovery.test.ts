import { describe, expect, test } from "bun:test";

import { isLocalGatewayRequestHost } from "./local-gateway-discovery";

describe("isLocalGatewayRequestHost", () => {
	test("accepts local network and ngrok gateway hosts", () => {
		expect(isLocalGatewayRequestHost("podcast.localhost")).toBe(true);
		expect(isLocalGatewayRequestHost("192.168.1.20:3501")).toBe(true);
		expect(isLocalGatewayRequestHost("[::1]:3501")).toBe(true);
		expect(isLocalGatewayRequestHost("::1")).toBe(true);
		expect(
			isLocalGatewayRequestHost("c9c8-105-127-8-228.ngrok-free.app"),
		).toBe(true);
	});

	test("rejects public hosts that only resemble the ngrok gateway domain", () => {
		expect(isLocalGatewayRequestHost("ngrok-free.app")).toBe(false);
		expect(isLocalGatewayRequestHost("evilngrok-free.app")).toBe(false);
		expect(
			isLocalGatewayRequestHost("gateway.ngrok-free.app.example.com"),
		).toBe(false);
		expect(isLocalGatewayRequestHost("alghurobaa.vercel.app")).toBe(false);
	});
});
