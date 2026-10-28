/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { getSwipeDismissStyle } from "./swipe-dismiss-style";

describe("swipe dismissal geometry", () => {
	it("keeps measured idle rows automatic when their content grows", () => {
		for (const height of [0, 120, 380]) {
			expect(getSwipeDismissStyle(0, height, 72)).toEqual({
				height: "auto", opacity: 1, overflow: "hidden", transform: [],
			});
		}
	});
	it("collapses only during dismissal, without scaling text", () => {
		expect(getSwipeDismissStyle(0.5, 200, 72)).toEqual({
			height: 100, opacity: 0.5, overflow: "hidden",
			transform: [{ translateX: -36 }],
		});
		expect(getSwipeDismissStyle(1, 200, 72).height).toBe(0);
	});
	it("restores natural geometry after cancellation and clamps overshoot", () => {
		expect(getSwipeDismissStyle(-0.1, 200, 72).height).toBe("auto");
		expect(getSwipeDismissStyle(1.2, 200, 72).height).toBe(0);
		expect(getSwipeDismissStyle(0.5, 0, 72).height).toBe("auto");
	});
});
