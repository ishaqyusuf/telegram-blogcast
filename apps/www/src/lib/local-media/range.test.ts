import { describe, expect, test } from "bun:test";

import { parseSingleByteRange } from "./range";

describe("local media byte ranges", () => {
	test("parses bounded, open-ended, and suffix ranges", () => {
		expect(parseSingleByteRange("bytes=10-19", 100)).toEqual({
			start: 10,
			end: 19,
			length: 10,
		});
		expect(parseSingleByteRange("bytes=90-", 100)).toEqual({
			start: 90,
			end: 99,
			length: 10,
		});
		expect(parseSingleByteRange("bytes=-12", 100)).toEqual({
			start: 88,
			end: 99,
			length: 12,
		});
	});

	test("clamps the end and rejects malformed or unsatisfiable ranges", () => {
		expect(parseSingleByteRange("bytes=95-200", 100)).toEqual({
			start: 95,
			end: 99,
			length: 5,
		});
		expect(parseSingleByteRange("bytes=100-101", 100)).toBeNull();
		expect(parseSingleByteRange("bytes=20-10", 100)).toBeNull();
		expect(parseSingleByteRange("bytes=0-1,4-5", 100)).toBeNull();
		expect(parseSingleByteRange("items=0-1", 100)).toBeNull();
	});
});
