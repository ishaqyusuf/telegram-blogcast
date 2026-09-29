import { describe, expect, test } from "bun:test";
import {
	getAutomaticChannelIds,
	runChannelAutoUpdate,
} from "./channel-auto-update";

const channels = [
	{ channelId: 1, canUpdate: true, delta: 3 },
	{ channelId: 2, canUpdate: true, delta: 0 },
	{ channelId: 3, canUpdate: false, delta: 8 },
	{ channelId: 4, canUpdate: true, delta: null },
	{ channelId: 5, canUpdate: true, delta: 9 },
];

function harness() {
	const started: number[][] = [];
	let authReads = 0;
	let summaryReads = 0;
	const options = {
		selectedIds: [1, 2, 3, 4, 999],
		isCurrent: () => true,
		getAuthStatus: async () => {
			authReads++;
			return { authorized: true };
		},
		getSummary: async () => {
			summaryReads++;
			return { channels };
		},
		startJob: async ({ channelIds }: { channelIds: number[] }) => {
			started.push(channelIds);
		},
	};
	return { options, started, reads: () => ({ authReads, summaryReads }) };
}

describe("automatic channel updates", () => {
	test("only marked, eligible channels with new or unknown messages are updated", () => {
		expect(getAutomaticChannelIds(channels, [1, 1, 2, 3, 4, 999])).toEqual([
			1, 4,
		]);
	});

	test("starts one job with the selected subset", async () => {
		const { options, started } = harness();
		await runChannelAutoUpdate(options);
		expect(started).toEqual([[1, 4]]);
	});

	test("does no network work with no marked channels", async () => {
		const { options, started, reads } = harness();
		await runChannelAutoUpdate({ ...options, selectedIds: [] });
		expect(reads()).toEqual({ authReads: 0, summaryReads: 0 });
		expect(started).toEqual([]);
	});

	test("does no network work when disabled, disconnected or backgrounded", async () => {
		const { options, reads } = harness();
		await runChannelAutoUpdate({ ...options, isCurrent: () => false });
		expect(reads()).toEqual({ authReads: 0, summaryReads: 0 });
	});

	test("unauthorized service does not read channels or start a job", async () => {
		const { options, started, reads } = harness();
		await runChannelAutoUpdate({
			...options,
			getAuthStatus: async () => ({ authorized: false }),
		});
		expect(reads().summaryReads).toBe(0);
		expect(started).toEqual([]);
	});

	test("cancellation during auth prevents summary lookup", async () => {
		const { options, started, reads } = harness();
		let current = true;
		await runChannelAutoUpdate({
			...options,
			isCurrent: () => current,
			getAuthStatus: async () => {
				current = false;
				return { authorized: true };
			},
		});
		expect(reads().summaryReads).toBe(0);
		expect(started).toEqual([]);
	});

	test("preference or gateway changes during summary prevent stale submissions", async () => {
		const { options, started } = harness();
		let current = true;
		await runChannelAutoUpdate({
			...options,
			isCurrent: () => current,
			getSummary: async () => {
				current = false;
				return { channels };
			},
		});
		expect(started).toEqual([]);
	});

	test("up-to-date, missing and ineligible channels never create empty jobs", async () => {
		const { options, started } = harness();
		await runChannelAutoUpdate({ ...options, selectedIds: [2, 3, 999] });
		expect(started).toEqual([]);
	});

	test("a failed check can be retried without losing selections", async () => {
		const { options, started } = harness();
		await expect(
			runChannelAutoUpdate({
				...options,
				getSummary: async () => {
					throw new Error("offline");
				},
			}),
		).rejects.toThrow("offline");
		expect(started).toEqual([]);
		await runChannelAutoUpdate(options);
		expect(started).toEqual([[1, 4]]);
	});
});
