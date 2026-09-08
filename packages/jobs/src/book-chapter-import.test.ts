import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateChapterCapture } from "./book-chapter-import";

describe("chapter capture validation", () => {
	it("keeps the full retained root tree as lean nodes with stable identities", async () => {
		const html = await readFile(
			resolve(
				__dirname,
				"../../document/src/book/fixtures/shamela-23833-betaka-index.html",
			),
			"utf8",
		);
		const nodes = validateChapterCapture(html, 23833);
		expect(nodes.length).toBe(2405);
		const keys = new Set(nodes.map((node) => node.sourceKey));
		expect(keys.size).toBe(nodes.length);
		expect(
			nodes.every(
				(node) => node.parentKey === null || keys.has(node.parentKey),
			),
		).toBe(true);
		expect(validateChapterCapture(html, 23833)).toEqual(nodes);
		expect(Object.keys(nodes[0]!).sort()).toEqual([
			"depth",
			"parentKey",
			"sortOrder",
			"sourceKey",
			"sourcePageNo",
			"title",
		]);
	});

	it("reads nested hidden lists", () => {
		const nodes = validateChapterCapture(
			'<div class="betaka-index"><ul><li><a href="/book/23833/1">Parent</a><ul style="display: none;"><li><a href="/book/23833/106">Child</a></li></ul></li></ul></div>',
			23833,
		);
		expect(nodes).toHaveLength(2);
		expect(nodes[1]!.parentKey).toBe(nodes[0]!.sourceKey);
		expect(nodes[1]!.sourcePageNo).toBe(106);
	});

	it("rejects missing indexes, unloaded branches, and foreign book links", () => {
		for (const href of [
			"/book/23833/nope",
			"javascript:alert(1)",
			"/book/23833/0",
		]) {
			expect(() =>
				validateChapterCapture(
					`<div class="betaka-index"><ul><li><a href="${href}">Invalid</a></li></ul></div>`,
					23833,
				),
			).toThrow();
		}
		expect(() =>
			validateChapterCapture("<html>Not an index</html>", 23833),
		).toThrow();
		expect(() =>
			validateChapterCapture(
				'<div class="s-nav"><ul><li><a class="exp_bu" data-id="1" href="javascript:;">+</a><a href="/book/23833/1">Parent</a></li></ul></div>',
				23833,
			),
		).toThrow();
		expect(() =>
			validateChapterCapture(
				'<div class="s-nav"><ul><li><a href="/book/999/1">Wrong book</a></li></ul></div>',
				23833,
			),
		).toThrow();
	});
});
