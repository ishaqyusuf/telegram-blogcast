import { beforeAll, describe, expect, mock, test } from "bun:test";
import type { MessageFetcher as MessageFetcherType } from "./message-fetcher.js";
const calls: { minId?: number; startId?: number; oldestFirst?: boolean }[] = [];
let source: number[] = [];
mock.module("./message-service", () => ({
	fetchMessages: async (
		_channel: string,
		input: {
			limit?: number;
			minId?: number;
			oldestFirst?: boolean;
			startId?: number;
		},
	) => {
		calls.push(input);
		let ids = source.filter(
			(id) => id > (input.minId ?? 0) && (!input.startId || id < input.startId),
		);
		ids.sort((a, b) => (input.oldestFirst ? a - b : b - a));
		ids = ids.slice(0, input.limit);
		return {
			messages: ids.map((id) => ({ id, text: "test", date: new Date() })),
			lastMessageId: ids.at(-1) ?? null,
		};
	},
}));
let MessageFetcher: typeof MessageFetcherType;

beforeAll(async () => {
	({ MessageFetcher } = await import("./message-fetcher.js"));
});

async function sync(known: number[], allFetched: boolean) {
	const fetcher = new MessageFetcher();
	const saved: number[] = [];
	let markedComplete = false;
	const done = new Promise<void>((resolve) => {
		fetcher.on("event", async (event) => {
			if (event.type === "messages") {
				await Promise.resolve();
				saved.push(...event.messages.map((message) => message.id));
			}
			if (event.type === "allFetched") markedComplete = true;
			if (event.type === "state" && event.state.status === "completed")
				resolve();
		});
	});
	fetcher.start({
		channelId: 1,
		channelUsername: "test",
		lastMessageId: known.length ? Math.min(...known) : null,
		allFetched,
		channelMessageIds: known,
		once: true,
	});
	await done;
	return { saved, markedComplete, state: fetcher.getState() };
}

describe("mobile one-shot channel sync", () => {
	test("imports all history of a new channel before reporting completion", async () => {
		source = Array.from({ length: 53 }, (_, i) => i + 1);
		calls.length = 0;
		const result = await sync([], false);
		expect(new Set(result.saved).size).toBe(53);
		expect(result.saved).toHaveLength(53);
		expect(result.markedComplete).toBe(true);
		expect(result.state.status).toBe("completed");
	});
	test("pages forward through more than one new batch and repeat sync adds nothing", async () => {
		source = Array.from({ length: 61 }, (_, i) => i + 1);
		calls.length = 0;
		const result = await sync([1, 2, 3], true);
		expect(result.saved).toEqual(source.slice(3));
		expect(calls[0]?.oldestFirst).toBe(true);
		const repeat = await sync(source, true);
		expect(repeat.saved).toEqual([]);
		expect(repeat.state.totalFetched).toBe(0);
	});
	test("empty channel completes without an endless backfill loop", async () => {
		source = [];
		calls.length = 0;
		const result = await sync([], false);
		expect(result.state.status).toBe("completed");
		expect(result.saved).toEqual([]);
	});
});
