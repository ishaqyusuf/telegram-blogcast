import { expect, test } from "bun:test";
import { reconcileSearchMembership } from "./search-membership";

test("adding audio removes it from cached unalbumed results without removing unrelated pages", () => {
	const posts = [
		{ id: 1, medias: [{ id: 10, mimeType: "audio/mpeg", albumId: null }] },
		{ id: 2, medias: [{ id: 20, mimeType: "audio/mpeg", albumId: null }] },
	];
	const result = reconcileSearchMembership(
		posts,
		new Set([10]),
		{ id: 7, name: "Album" },
		"not",
	);
	expect(result.map((post) => post.id)).toEqual([2]);
	expect(posts[0].medias[0].albumId).toBeNull();
});
test("a remaining matched audio becomes the displayed media after a move", () => {
	const result = reconcileSearchMembership(
		[
			{
				id: 1,
				medias: [
					{ id: 10, mimeType: "audio/mpeg", albumId: 7 },
					{ id: 11, mimeType: "audio/mpeg", albumId: 8 },
					{ id: 12, mimeType: "image/jpeg", albumId: 8 },
				],
			},
		],
		new Set([10]),
		null,
		"in",
	);
	expect(result[0].medias?.map((media) => media.id)).toEqual([11]);
});
test("removing membership retains the post in unfiltered results", () => {
	const result = reconcileSearchMembership(
		[{ id: 1, medias: [{ id: 10, mimeType: "audio/mpeg", albumId: 7 }] }],
		new Set([10]),
		null,
	);
	expect(result[0].medias?.[0].albumId).toBeNull();
	expect(result[0].id).toBe(1);
});
