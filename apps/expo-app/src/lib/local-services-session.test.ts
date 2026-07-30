import { describe, expect, test } from "bun:test";

import {
	filterRecentLocalServiceIps,
	getInitialLocalServicesSessionStatus,
	getLocalServicesIpMode,
	isValidIpv4Address,
	normalizeIpv4Input,
} from "./local-services-session";

describe("local services launch session", () => {
	test("silently initializes every build variant", () => {
		expect(getInitialLocalServicesSessionStatus("preview")).toBe(
			"initializing",
		);
		expect(getInitialLocalServicesSessionStatus("production")).toBe(
			"initializing",
		);
		expect(getInitialLocalServicesSessionStatus("development")).toBe(
			"initializing",
		);
		expect(getInitialLocalServicesSessionStatus("dev")).toBe("initializing");
	});

	test("only development can add the Expo runtime host automatically", () => {
		expect(getLocalServicesIpMode("development")).toBe("automatic");
		expect(getLocalServicesIpMode("dev")).toBe("automatic");
		expect(getLocalServicesIpMode("preview")).toBe("remote");
		expect(getLocalServicesIpMode("production")).toBe("manual");
	});

	test("normalizes numeric IP input and validates IPv4 octets", () => {
		expect(normalizeIpv4Input(" 192,168.001.44abc ")).toBe("192.168.001.44");
		expect(isValidIpv4Address("192.168.1.44")).toBe(true);
		expect(isValidIpv4Address("10.0.0.5")).toBe(true);
		expect(isValidIpv4Address("192.168.1")).toBe(false);
		expect(isValidIpv4Address("192.168.1.256")).toBe(false);
		expect(isValidIpv4Address("192.168..44")).toBe(false);
	});

	test("dedupes recent IPs, keeps most-recent order, and filters while typing", () => {
		const recent = filterRecentLocalServiceIps({
			activeIp: "192.168.1.44",
			history: ["10.0.0.5", "192.168.1.44", "192.168.1.20", "not-an-ip"],
			query: "192.168.1",
		});

		expect(recent).toEqual(["192.168.1.44", "192.168.1.20"]);
	});
});
