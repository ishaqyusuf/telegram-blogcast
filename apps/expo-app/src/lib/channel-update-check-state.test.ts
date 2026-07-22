import { describe, expect, test } from "bun:test";

import {
	completeChannelUpdateCheck,
	createChannelUpdateCheckState,
	startChannelUpdateCheck,
} from "./channel-update-check-state";

describe("Telegram update check state", () => {
	test("allows retry after failure and suppresses duplicates after success", () => {
		const initial = createChannelUpdateCheckState();
		const first = startChannelUpdateCheck(initial, "192.168.18.3", "online");
		expect(first.shouldStart).toBe(true);

		const failed = completeChannelUpdateCheck(
			first.state,
			"192.168.18.3",
			false,
		);
		const retry = startChannelUpdateCheck(
			failed,
			"192.168.18.3",
			"online",
		);
		expect(retry.shouldStart).toBe(true);

		const completed = completeChannelUpdateCheck(
			retry.state,
			"192.168.18.3",
			true,
		);
		expect(
			startChannelUpdateCheck(completed, "192.168.18.3", "online")
				.shouldStart,
		).toBe(false);
		expect(
			startChannelUpdateCheck(completed, "192.168.18.4", "offline")
				.shouldStart,
		).toBe(false);
		expect(
			startChannelUpdateCheck(completed, "192.168.18.4", "online")
				.shouldStart,
		).toBe(true);
	});
});
