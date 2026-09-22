import { expect, test } from "bun:test";
import {
	countFeedUpdates,
	mergeLatestFeedPage,
	uniqueFeedItems,
} from "./feed-updates";
test("background detection leaves the visible snapshot untouched and groups albums", () => {
	const current = [{ id: 3 }];
	const latest = [
		{ id: 6, audio: { albumId: 1 } },
		{ id: 5, audio: { albumId: 1 } },
		{ id: 4 },
		{ id: 3 },
	];
	expect(countFeedUpdates(current, latest)).toBe(2);
	expect(current).toEqual([{ id: 3 }]);
	expect(countFeedUpdates(latest, latest)).toBe(0);
});
test("overlapping older pages retain first occurrence and do not duplicate rows", () => {
	expect(uniqueFeedItems([{ id: 3 }, { id: 2 }, { id: 2 }, { id: 1 }])).toEqual(
		[{ id: 3 }, { id: 2 }, { id: 1 }],
	);
});
test("applying updates keeps loaded older pages and their pagination cursor", () => {
	const current = {
		pages: [
			{ data: [{ id: 3 }, { id: 2 }], meta: { cursor: 2 } },
			{ data: [{ id: 1 }], meta: { cursor: 1 } },
		],
		pageParams: [null, 2],
	};
	const result = mergeLatestFeedPage(current, {
		data: [{ id: 4 }, { id: 3 }],
		meta: { cursor: 3 },
	});
	expect(result.pages).toEqual([
		{ data: [{ id: 4 }, { id: 3 }, { id: 2 }], meta: { cursor: 2 } },
		{ data: [{ id: 1 }], meta: { cursor: 1 } },
	]);
	expect(result.pageParams).toEqual([null, 2]);
});
