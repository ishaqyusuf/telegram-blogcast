export type RawiVocabulary = {
	char_to_idx: Record<string, number>;
	diac_to_idx: Record<string, number>;
};

type PreparedCharacter = {
	base: string;
	preservedMarks: string;
};

export type PreparedRawiInput = {
	modelText: string;
	modelCharacters: string[];
	characters: PreparedCharacter[];
};

type TimedWord = {
	word: string;
	startSec: number;
	endSec: number;
};

const ARABIC_VOWELS = new Set([
	"\u064b", // fathatan
	"\u064c", // dammatan
	"\u064d", // kasratan
	"\u064e", // fatha
	"\u064f", // damma
	"\u0650", // kasra
	"\u0651", // shadda
	"\u0652", // sukun
	"\u0670", // superscript alef
]);

function isCombiningMark(character: string) {
	return /\p{M}/u.test(character);
}

function isArabicLetter(character: string) {
	const codePoint = character.codePointAt(0) ?? 0;
	return (
		(codePoint >= 0x0621 && codePoint <= 0x063a) ||
		(codePoint >= 0x0641 && codePoint <= 0x064a) ||
		(codePoint >= 0x066e && codePoint <= 0x06d3) ||
		(codePoint >= 0x06fa && codePoint <= 0x06fc) ||
		(codePoint >= 0x0750 && codePoint <= 0x077f) ||
		(codePoint >= 0x0870 && codePoint <= 0x0887) ||
		(codePoint >= 0x08a0 && codePoint <= 0x08c9)
	);
}

function splitCharacters(text: string): PreparedCharacter[] {
	const characters: PreparedCharacter[] = [];

	for (const character of Array.from(text.normalize("NFD"))) {
		if (isCombiningMark(character)) {
			const current = characters.at(-1);
			if (current && !ARABIC_VOWELS.has(character)) {
				current.preservedMarks += character;
			}
			continue;
		}
		characters.push({ base: character, preservedMarks: "" });
	}

	return characters;
}

export function stripArabicVowels(text: string) {
	return splitCharacters(text)
		.map(({ base, preservedMarks }) => `${base}${preservedMarks}`)
		.join("")
		.normalize("NFC");
}

export function prepareRawiInput(text: string): PreparedRawiInput {
	const characters = splitCharacters(text);
	return {
		modelText: characters
			.map(({ base, preservedMarks }) => `${base}${preservedMarks}`)
			.join(""),
		modelCharacters: characters.map(({ base }) => base),
		characters,
	};
}

function sigmoid(value: number) {
	return 1 / (1 + Math.exp(-value));
}

function pickClass(
	values: ArrayLike<number>,
	position: number,
	classCount: number,
) {
	const offset = position * classCount;
	let selected = 0;
	let selectedValue = Number.NEGATIVE_INFINITY;

	for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
		const value = Number(
			values[offset + classIndex] ?? Number.NEGATIVE_INFINITY,
		);
		if (value > selectedValue) {
			selected = classIndex;
			selectedValue = value;
		}
	}

	return selected;
}

function keepSupportedVowels(value: string) {
	return Array.from(value.normalize("NFD"))
		.filter((character) => ARABIC_VOWELS.has(character))
		.join("");
}

export function decodeRawiTashkeel({
	prepared,
	presence,
	values,
	idxToDiac,
	classCount,
	threshold = 0.5,
}: {
	prepared: PreparedRawiInput;
	presence: ArrayLike<number>;
	values: ArrayLike<number>;
	idxToDiac: Record<number, string>;
	classCount: number;
	threshold?: number;
}) {
	const output = prepared.characters.map((character, position) => {
		const selectedClass = pickClass(values, position, classCount);
		const predicted =
			isArabicLetter(character.base) &&
			sigmoid(Number(presence[position] ?? Number.NEGATIVE_INFINITY)) >
				threshold
				? keepSupportedVowels(idxToDiac[selectedClass] ?? "")
				: "";

		return `${character.base}${character.preservedMarks}${predicted}`;
	});

	return output.join("").normalize("NFC");
}

type DisplayUnit = {
	base: string;
	display: string;
};

function splitDisplayUnits(text: string): DisplayUnit[] {
	const units: DisplayUnit[] = [];

	for (const character of Array.from(text.normalize("NFD"))) {
		if (isCombiningMark(character)) {
			const current = units.at(-1);
			if (current) current.display += character;
			continue;
		}
		units.push({ base: character, display: character });
	}

	return units;
}

function baseCharacters(text: string) {
	return splitDisplayUnits(text).map((unit) => unit.base);
}

function findSubsequence(
	haystack: string[],
	needle: string[],
	startIndex: number,
) {
	if (needle.length === 0) return -1;
	const lastStart = haystack.length - needle.length;

	for (let index = Math.max(0, startIndex); index <= lastStart; index += 1) {
		let matches = true;
		for (let offset = 0; offset < needle.length; offset += 1) {
			if (haystack[index + offset] !== needle[offset]) {
				matches = false;
				break;
			}
		}
		if (matches) return index;
	}

	return -1;
}

export function applyTashkeelToWords<T extends TimedWord>(
	_sourceText: string,
	tashkeelText: string,
	words: T[],
): T[] {
	const displayUnits = splitDisplayUnits(tashkeelText);
	const segmentBase = displayUnits.map((unit) => unit.base);
	let cursor = 0;

	return words.map((word) => {
		const wordBase = baseCharacters(word.word.trim());
		const start = findSubsequence(segmentBase, wordBase, cursor);
		if (start < 0) return word;

		const end = start + wordBase.length;
		cursor = end;
		const vocalizedWord = displayUnits
			.slice(start, end)
			.map((unit) => unit.display)
			.join("")
			.normalize("NFC");

		return vocalizedWord ? { ...word, word: vocalizedWord } : word;
	});
}
