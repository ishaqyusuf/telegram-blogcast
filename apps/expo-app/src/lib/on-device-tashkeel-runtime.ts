import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import { InferenceSession, Tensor } from "onnxruntime-react-native";

import {
	type RawiVocabulary,
	decodeRawiTashkeel,
	prepareRawiInput,
	stripArabicVowels,
} from "@/lib/tashkeel-core";

const MODEL_VERSION = "rawi-v3-int8";
const CACHE_PREFIX = `tashkeel:${MODEL_VERSION}:`;
const MAX_SEQUENCE_LENGTH = 480;
const MODEL_ASSET = require("../../assets/models/rawi-v3/rawi_v3.int8.onnx");
const VOCABULARY =
	require("../../assets/models/rawi-v3/rawi_v3.vocab.json") as RawiVocabulary;
require("../../assets/models/rawi-v3/LICENSE.txt");
require("../../assets/models/rawi-v3/NOTICE.txt");

type CachedTashkeel = {
	source: string;
	output: string;
};

let sessionPromise: Promise<InferenceSession> | null = null;
const memoryCache = new Map<string, CachedTashkeel>();
const idxToDiac = Object.fromEntries(
	Object.entries(VOCABULARY.diac_to_idx).map(([diacritic, index]) => [
		index,
		diacritic,
	]),
) as Record<number, string>;
const classCount = Object.keys(VOCABULARY.diac_to_idx).length;

function hashText(text: string) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}

function cacheKey(text: string) {
	return `${CACHE_PREFIX}${hashText(text)}`;
}

async function readCache(source: string) {
	const key = cacheKey(source);
	const remembered = memoryCache.get(key);
	if (remembered?.source === source) return remembered.output;

	try {
		const raw = await AsyncStorage.getItem(key);
		if (!raw) return null;
		const cached = JSON.parse(raw) as CachedTashkeel;
		if (cached.source !== source || typeof cached.output !== "string")
			return null;
		memoryCache.set(key, cached);
		return cached.output;
	} catch {
		return null;
	}
}

async function writeCache(source: string, output: string) {
	const key = cacheKey(source);
	const cached = { source, output };
	memoryCache.set(key, cached);
	try {
		await AsyncStorage.setItem(key, JSON.stringify(cached));
	} catch {
		// The in-memory result still avoids repeating work in this app session.
	}
}

async function getSession() {
	if (!sessionPromise) {
		sessionPromise = (async () => {
			const asset = Asset.fromModule(MODEL_ASSET);
			await asset.downloadAsync();
			const modelPath = asset.localUri ?? asset.uri;
			if (!modelPath)
				throw new Error("The bundled tashkeel model is unavailable.");
			return InferenceSession.create(modelPath);
		})().catch((error) => {
			sessionPromise = null;
			throw error;
		});
	}
	return sessionPromise;
}

function splitForModel(text: string) {
	const characters = Array.from(text);
	if (characters.length <= MAX_SEQUENCE_LENGTH) return [text];

	const chunks: string[] = [];
	let start = 0;
	while (start < characters.length) {
		let end = Math.min(start + MAX_SEQUENCE_LENGTH, characters.length);
		if (end < characters.length) {
			for (
				let index = end;
				index > start + MAX_SEQUENCE_LENGTH / 2;
				index -= 1
			) {
				if (/\s/u.test(characters[index - 1] ?? "")) {
					end = index;
					break;
				}
			}
		}
		chunks.push(characters.slice(start, end).join(""));
		start = end;
	}
	return chunks;
}

async function runModel(text: string) {
	const prepared = prepareRawiInput(text);
	if (prepared.modelCharacters.length === 0) return "";

	const unknownId = VOCABULARY.char_to_idx["<UNK>"] ?? 1;
	const inputIds = prepared.modelCharacters.map(
		(character) => VOCABULARY.char_to_idx[character] ?? unknownId,
	);
	const input = new Tensor(
		"int64",
		BigInt64Array.from(inputIds, (value) => BigInt(value)),
		[1, inputIds.length],
	);
	const session = await getSession();
	const output = await session.run({ input });
	const presence = output.presence?.data;
	const values = output.value?.data;
	if (!presence || !values)
		throw new Error("The tashkeel model returned invalid output.");

	return decodeRawiTashkeel({
		prepared,
		presence: presence as ArrayLike<number>,
		values: values as ArrayLike<number>,
		idxToDiac,
		classCount,
	});
}

export async function diacritizeTextOnDevice(source: string) {
	const cleanSource = stripArabicVowels(source);
	if (!/[\u0621-\u063a\u0641-\u064a]/u.test(cleanSource)) return cleanSource;

	const cached = await readCache(cleanSource);
	if (cached != null) return cached;

	const chunks = splitForModel(cleanSource);
	const outputParts: string[] = [];
	for (const chunk of chunks) outputParts.push(await runModel(chunk));
	const output = outputParts.join("");
	await writeCache(cleanSource, output);
	return output;
}
