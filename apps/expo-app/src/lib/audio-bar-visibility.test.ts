import { expect, test } from "bun:test";
import { shouldShowAudioBar } from "./audio-bar-visibility";
const base = {
	pathname: "/",
	hasAudio: true,
	activeBlogId: 4,
	hidden: false,
	sheetOpen: false,
	scrollHidden: false,
	detailVisible: true,
};
test("search suppresses the player through scroll and keyboard states", () => {
	for (const pathname of ["/search", "/blog-search", "/search/results"])
		expect(shouldShowAudioBar({ ...base, pathname })).toBe(false);
});
test("same audio stays hidden even when detail floating controls request visibility", () => {
	expect(shouldShowAudioBar({ ...base, pathname: "/blog-view-2/4" })).toBe(
		false,
	);
	expect(
		shouldShowAudioBar({
			...base,
			pathname: "/blog-view-2/44",
			activeMediaId: 2,
			viewedMediaId: 2,
		}),
	).toBe(false);
});
test("different track and back navigation preserve existing suppression rules", () => {
	expect(shouldShowAudioBar({ ...base, pathname: "/blog-view-2/5" })).toBe(
		true,
	);
	expect(shouldShowAudioBar(base)).toBe(true);
	expect(shouldShowAudioBar({ ...base, sheetOpen: true })).toBe(false);
	expect(shouldShowAudioBar({ ...base, scrollHidden: true })).toBe(false);
	expect(shouldShowAudioBar({ ...base, hasAudio: false })).toBe(false);
});
