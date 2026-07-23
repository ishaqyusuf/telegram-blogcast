import { describe, expect, test } from "bun:test";

import {
	applyTashkeelToWords,
	decodeRawiTashkeel,
	prepareRawiInput,
	stripArabicVowels,
} from "./tashkeel-core";

const CLASS_COUNT = 75;

function logitsFor(classes: number[]) {
	const logits = new Float32Array(classes.length * CLASS_COUNT).fill(-10);
	classes.forEach((value, index) => {
		logits[index * CLASS_COUNT + value] = 10;
	});
	return logits;
}

describe("on-device Arabic tashkeel", () => {
	test("strips existing vowels while preserving Arabic orthography", () => {
		const prepared = prepareRawiInput("إِنَّ العِلْمَ نُورٌ");

		expect(prepared.modelText.normalize("NFC")).toBe("إن العلم نور");
		expect(stripArabicVowels("إِنَّ العِلْمَ نُورٌ")).toBe("إن العلم نور");
	});

	test("decodes fatha, kasra, damma, shadda, sukun, and tanween", () => {
		const source = "بسم";
		const prepared = prepareRawiInput(source);
		const presence = new Float32Array([10, 10, 10]);
		const values = logitsFor([24, 61, 14]);
		const idxToDiac = {
			24: "َ",
			61: "ّْ",
			14: "ٌ",
		};

		expect(
			decodeRawiTashkeel({
				prepared,
				presence,
				values,
				idxToDiac,
				classCount: CLASS_COUNT,
			}),
		).toBe("بَسّْمٌ");
	});

	test("never adds Arabic marks to Latin text, numbers, or punctuation", () => {
		const prepared = prepareRawiInput("درس 101 (API)");
		const presence = new Float32Array(
			Array.from(prepared.modelCharacters, () => 10),
		);
		const values = logitsFor(Array.from(prepared.modelCharacters, () => 24));

		const output = decodeRawiTashkeel({
			prepared,
			presence,
			values,
			idxToDiac: { 24: "َ" },
			classCount: CLASS_COUNT,
		});

		expect(output.endsWith("101 (API)")).toBe(true);
		expect(stripArabicVowels(output)).toBe("درس 101 (API)");
	});

	test("projects contextual tashkeel onto timestamped words", () => {
		const words = [
			{ word: "طلب", startSec: 0, endSec: 0.5 },
			{ word: "العلم", startSec: 0.5, endSec: 1.2 },
		];

		expect(applyTashkeelToWords("طلب العلم", "طَلَبَ الْعِلْمَ", words)).toEqual([
			{ word: "طَلَبَ", startSec: 0, endSec: 0.5 },
			{ word: "الْعِلْمَ", startSec: 0.5, endSec: 1.2 },
		]);
	});
});
