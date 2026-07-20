import { describe, expect, test } from "bun:test";

import {
	filterRecentLocalServiceIps,
	getInitialLocalServicesSessionStatus,
	isValidIpv4Address,
	normalizeIpv4Input,
	transitionLocalServicesSession,
} from "./local-services-session";

describe("local services launch session", () => {
	test("prompts preview and production builds but enables development directly", () => {
		expect(getInitialLocalServicesSessionStatus("preview")).toBe("prompting");
		expect(getInitialLocalServicesSessionStatus("production")).toBe(
			"prompting",
		);
		expect(getInitialLocalServicesSessionStatus("development")).toBe(
			"enabled",
		);
		expect(getInitialLocalServicesSessionStatus("dev")).toBe("enabled");
	});

	test("normalizes numeric IP input and validates IPv4 octets", () => {
		expect(normalizeIpv4Input(" 192,168.001.44abc ")).toBe(
			"192.168.001.44",
		);
		expect(isValidIpv4Address("192.168.1.44")).toBe(true);
		expect(isValidIpv4Address("10.0.0.5")).toBe(true);
		expect(isValidIpv4Address("192.168.1")).toBe(false);
		expect(isValidIpv4Address("192.168.1.256")).toBe(false);
		expect(isValidIpv4Address("192.168..44")).toBe(false);
	});

	test("dedupes recent IPs, keeps most-recent order, and filters while typing", () => {
		const recent = filterRecentLocalServiceIps({
			activeIp: "192.168.1.44",
			history: [
				"10.0.0.5",
				"192.168.1.44",
				"192.168.1.20",
				"not-an-ip",
			],
			query: "192.168.1",
		});

		expect(recent).toEqual(["192.168.1.44", "192.168.1.20"]);
	});

	test("does not enable services until the launch sheet finishes dismissing", () => {
		expect(
			transitionLocalServicesSession("prompting", "begin-resolution"),
		).toBe("initializing");
		expect(
			transitionLocalServicesSession("initializing", "finish-enabled"),
		).toBe("enabled");
		expect(
			transitionLocalServicesSession("initializing", "finish-disabled"),
		).toBe("disabled");
		expect(transitionLocalServicesSession("disabled", "request-setup")).toBe(
			"prompting",
		);
	});
});
