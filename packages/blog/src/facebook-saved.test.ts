import { describe, expect, test } from "bun:test";
import {
	createFacebookSavedCollector,
	getFacebookSavedIdentity,
	getFacebookSavedNewItems,
	mergeFacebookSavedExports,
	processFacebookSavedSnapshot,
} from "./facebook-saved.mjs";

describe("Facebook saved identity", () => {
	test("treats reel and watch URLs for the same video as one post", () => {
		expect(
			getFacebookSavedIdentity("https://www.facebook.com/reel/123456789/"),
		).toBe("video:123456789");
		expect(
			getFacebookSavedIdentity(
				"https://www.facebook.com/watch/?ref=saved&v=123456789",
			),
		).toBe("video:123456789");
	});

	test("normalizes permalink query ordering and saved tracking", () => {
		expect(
			getFacebookSavedIdentity(
				"https://www.facebook.com/permalink.php?story_fbid=post-42&id=owner-7&ref=saved",
			),
		).toBe("post:owner-7:post-42");
	});
});

describe("Facebook saved incremental collection", () => {
	test("allows enough no-growth passes for Facebook's delayed pagination", () => {
		const collector = createFacebookSavedCollector();

		expect(collector.stopAfterNoGrowthPasses).toBe(8);
	});

	test("merges duplicate DOM cards and keeps the richest fields", () => {
		const collector = createFacebookSavedCollector([]);
		const result = processFacebookSavedSnapshot(collector, {
			height: 2000,
			rows: [
				{
					url: "https://www.facebook.com/reel/77/",
					caption: "",
					collection: "Benefits",
				},
				{
					url: "https://www.facebook.com/watch/?v=77&ref=saved",
					caption: "A complete useful caption",
					avatar: "https://example.com/avatar.jpg",
				},
			],
		});

		expect(result.newCount).toBe(1);
		expect(getFacebookSavedNewItems(collector)).toEqual([
			{
				title: "A complete useful caption",
				link: "",
				url: "https://www.facebook.com/reel/77/",
				collection: "Benefits",
				avatar: "https://example.com/avatar.jpg",
				caption: "A complete useful caption",
			},
		]);
	});

	test("stops only after the configured consecutive known boundary", () => {
		const collector = createFacebookSavedCollector([
			"video:1",
			"video:2",
			"video:3",
			"video:4",
			"video:5",
		]);

		const first = processFacebookSavedSnapshot(
			collector,
			{
				height: 2000,
				rows: [
					{ url: "https://www.facebook.com/reel/9/" },
					{ url: "https://www.facebook.com/reel/1/" },
					{ url: "https://www.facebook.com/reel/2/" },
				],
			},
			{ boundaryThreshold: 3 },
		);
		expect(first.done).toBe(false);
		expect(first.consecutiveKnownCount).toBe(2);

		const second = processFacebookSavedSnapshot(
			collector,
			{
				height: 2600,
				rows: [
					{ url: "https://www.facebook.com/reel/8/" },
					{ url: "https://www.facebook.com/reel/3/" },
					{ url: "https://www.facebook.com/watch/?v=4" },
					{ url: "https://www.facebook.com/watch/?v=5" },
				],
			},
			{ boundaryThreshold: 3 },
		);
		expect(second.done).toBe(true);
		expect(second.complete).toBe(true);
		expect(second.stopReason).toBe("known_boundary");
		expect(second.newCount).toBe(2);
	});

	test("fails closed when an existing export reaches the end with no overlap", () => {
		const collector = createFacebookSavedCollector(["video:100"]);
		let result: ReturnType<typeof processFacebookSavedSnapshot> | undefined;

		for (let pass = 0; pass < 6; pass += 1) {
			result = processFacebookSavedSnapshot(
				collector,
				{
					height: 2000,
					scrollY: 1000,
					viewportHeight: 1000,
					rows: [{ url: "https://www.facebook.com/reel/200/" }],
				},
				{ stopAfterNoGrowthPasses: 5 },
			);
		}

		expect(result?.done).toBe(true);
		expect(result?.complete).toBe(false);
		expect(result?.stopReason).toBe("no_known_overlap");
	});

	test("does not treat a stalled viewport as the natural end", () => {
		const collector = createFacebookSavedCollector([], {
			stopAfterNoGrowthPasses: 2,
		});
		let result: ReturnType<typeof processFacebookSavedSnapshot> | undefined;

		for (let pass = 0; pass < 4; pass += 1) {
			result = processFacebookSavedSnapshot(collector, {
				height: 4000,
				scrollY: 1000,
				viewportHeight: 1000,
				rows: [{ url: "https://www.facebook.com/reel/200/" }],
			});
		}

		expect(result?.atEnd).toBe(false);
		expect(result?.done).toBe(false);
	});
});

describe("Facebook saved export merge", () => {
	test("prepends new items and preserves existing blog IDs", () => {
		const result = mergeFacebookSavedExports(
			{
				exportedAt: "2026-06-29T08:13:46.226Z",
				items: [
					{
						url: "https://www.facebook.com/reel/1/",
						title: "Existing",
						blogId: 41,
					},
				],
			},
			[
				{
					url: "https://www.facebook.com/watch/?v=2",
					title: "New",
				},
				{
					url: "https://www.facebook.com/watch/?v=1",
					title: "Duplicate representation",
				},
			],
		);

		expect(result.newItems).toHaveLength(1);
		expect(result.payload.items.map((item) => item.title)).toEqual([
			"New",
			"Existing",
		]);
		expect(result.payload.items[1]?.blogId).toBe(41);
	});
});
