import { describe, expect, test } from "bun:test";
import {
	isBookServiceUnavailable,
	isSourceRateLimit,
	nextUncapturedSourcePage,
} from "./book-source-capture";

describe("source capture progress", () => {
	test("skips existing and newly captured pages without skipping a failed page", () => {
		expect(
			nextUncapturedSourcePage(1, 6, new Set([1, 2, 5]), new Set([3])),
		).toBe(4);
		expect(nextUncapturedSourcePage(5, 6, new Set([5, 6]), new Set())).toBe(7);
	});
	test("recognizes source rate limits", () => {
		expect(isSourceRateLimit("The source returned an error (429). ")).toBe(
			true,
		);
		expect(isSourceRateLimit("Too many requests")).toBe(true);
		expect(isSourceRateLimit("The source returned an error (404). ")).toBe(
			false,
		);
	});
	test("recognizes a database outage separately from a source rate limit", () => {
		const error =
			"Can't reach database server at aws-0-eu-central-1.pooler.supabase.com";
		expect(isBookServiceUnavailable(error)).toBe(true);
		expect(isSourceRateLimit(error)).toBe(false);
	});
});
