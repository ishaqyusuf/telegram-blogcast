/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { getFeedTranscriptText } from "./feed-transcript-preview";

const segments = [
	{ startSec: 0, endSec: 2, text: "First" },
	{ startSec: 2, endSec: 4, text: "Second" },
];
describe("feed transcript subscription value", () => {
	it("stays null for unrelated rows across playback ticks and track changes", () => {
		for (const id of [2, 3]) for (const position of [0, 1000, 2000, 3000]) {
			expect(getFeedTranscriptText(1, segments, { blog: { id }, isPlaying: true, position })).toBeNull();
		}
	});
	it("changes only at the playing row's segment boundary", () => {
		const state = { blog: { id: 1 }, isPlaying: true, position: 0 };
		expect(getFeedTranscriptText(1, segments, state)).toBe("First");
		expect(getFeedTranscriptText(1, segments, { ...state, position: 1999 })).toBe("First");
		expect(getFeedTranscriptText(1, segments, { ...state, position: 2000 })).toBe("Second");
		expect(getFeedTranscriptText(1, segments, { ...state, isPlaying: false })).toBeNull();
		expect(getFeedTranscriptText(1, [], state)).toBeNull();
	});
});
