import { describe, expect, test } from "bun:test";

import { getChannelUpdateTerminalEvents } from "./channel-update-terminal";

const runningChannel = {
	channelId: 42,
	title: "قناة د. أحمد سعيد",
	username: "ahmad_saeed",
	status: "running" as const,
	beforeCount: 10,
	latestKnownCount: 12,
	fetchedCount: 0,
	finalStoredCount: null,
	error: null,
	skipReason: null,
};

const runningJob = {
	id: "recent-update-1",
	status: "running" as const,
	selectedCount: 1,
	totalNewChats: 0,
	channels: [runningChannel],
};

describe("channel update terminal", () => {
	test("reports selected-channel progress and the completed batch", () => {
		const started = getChannelUpdateTerminalEvents(null, runningJob);
		expect(started.map((event) => event.kind)).toEqual(["cmd", "info"]);
		expect(started[1]?.text).toContain("قناة د. أحمد سعيد");

		const completedJob = {
			...runningJob,
			status: "completed" as const,
			totalNewChats: 2,
			channels: [
				{
					...runningChannel,
					status: "completed" as const,
					fetchedCount: 2,
					finalStoredCount: 12,
				},
			],
		};
		const completed = getChannelUpdateTerminalEvents(runningJob, completedJob);

		expect(completed.map((event) => event.kind)).toEqual([
			"success",
			"success",
		]);
		expect(completed[0]?.text).toContain("2 new");
		expect(completed[1]?.text).toContain("update complete");
	});

	test("reports a failed batch as an error instead of a successful completion", () => {
		const failedJob = {
			...runningJob,
			status: "completed" as const,
			channels: [
				{
					...runningChannel,
					status: "failed" as const,
					error: "connection lost",
				},
			],
		};
		const events = getChannelUpdateTerminalEvents(runningJob, failedJob);

		expect(events.map((event) => event.kind)).toEqual(["error", "error"]);
		expect(events[1]?.text).toContain("1 failed");
	});
});
