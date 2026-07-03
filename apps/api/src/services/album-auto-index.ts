import { z } from "zod";

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_CHAT_PATH = "/chat/completions";
const DEFAULT_DEEPSEEK_ALBUM_INDEX_MODEL = "deepseek-v4-flash";
const DEFAULT_GEMINI_BASE_URL =
	"https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_ALBUM_INDEX_MODEL = "gemini-2.0-flash";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_ALBUM_INDEX_MODEL = "gpt-5";
const MAX_PROMPT_TEXT_LENGTH = 700;
const MAX_MEDIA_TEXT_DATA_LENGTH = 220;
const MAX_ALBUM_CONTEXT_MEDIA = 12;

export const albumIndexAiProviderSchema = z.enum([
	"deepseek",
	"gemini",
	"openai",
]);
export type AlbumIndexAiProvider = z.infer<typeof albumIndexAiProviderSchema>;

export type AlbumIndexTextData = {
	id: number;
	textData: string;
};

export type AlbumIndexChunkMetadata = {
	index: number;
	totalChunks: number;
	mediaOffset: number;
	mediaLimit: number;
	mediaIds: number[];
};

export type AlbumAutoIndexSnapshot = {
	channel: {
		id: number;
		title: string | null;
		username: string | null;
	};
	chunk?: AlbumIndexChunkMetadata;
	albums: Array<{
		id: number;
		name: string;
		albumType: string | null;
		description: string | null;
		suggestionKeywords: string | null;
		currentMedia: AlbumIndexTextData[];
	}>;
	media: AlbumIndexTextData[];
};

export type NormalizedAlbumIndex = {
	parsedResponse: unknown;
	albums: Array<{
		suggestionType: "existing_album" | "proposed_album";
		albumId: number | null;
		albumNameSnapshot: string | null;
		proposedAlbumName: string | null;
		proposedAlbumType: string | null;
		proposedDescription: string | null;
		proposedSuggestionKeywords: string | null;
		confidence: number | null;
		reason: string | null;
		media: Array<{
			mediaId: number;
			mediaTitleSnapshot: string | null;
			confidence: number | null;
			reason: string | null;
		}>;
	}>;
	suggestionCount: number;
};

export type AlbumIndexAiResult = {
	provider: AlbumIndexAiProvider;
	model: string;
	text: string;
	rawResponse: unknown;
	parsedResponse: unknown;
	inputTokens: number | null;
	outputTokens: number | null;
};

const mediaSuggestionSchema = z.object({
	mediaId: z.coerce.number().int(),
	confidence: z.coerce.number().min(0).max(1).optional(),
	reason: z.string().trim().max(300).optional(),
});

const albumSuggestionSchema = z.object({
	albumId: z.coerce.number().int(),
	confidence: z.coerce.number().min(0).max(1).optional(),
	reason: z.string().trim().max(500).optional(),
	media: z.array(mediaSuggestionSchema).optional(),
	mediaIds: z.array(z.coerce.number().int()).optional(),
});

const proposedAlbumSuggestionSchema = z.object({
	name: z.string().trim().min(1).max(200),
	albumType: z.string().trim().max(80).optional(),
	description: z.string().trim().max(500).optional(),
	suggestionKeywords: z.string().trim().max(500).optional(),
	confidence: z.coerce.number().min(0).max(1).optional(),
	reason: z.string().trim().max(500).optional(),
	media: z.array(mediaSuggestionSchema).optional(),
	mediaIds: z.array(z.coerce.number().int()).optional(),
});

const albumIndexResponseSchema = z.object({
	albums: z.array(albumSuggestionSchema).optional(),
	proposedAlbums: z.array(proposedAlbumSuggestionSchema).optional(),
});

type ParsedMediaSuggestion = z.infer<typeof mediaSuggestionSchema>;

function stripInvalidUnicode(value: string) {
	let result = "";
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const nextCode = value.charCodeAt(index + 1);
			if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
				result += value.charAt(index) + value.charAt(index + 1);
				index += 1;
			}
			continue;
		}
		if (code >= 0xdc00 && code <= 0xdfff) continue;
		result += value.charAt(index);
	}
	return result;
}

function sanitizeSnapshotText(value: string | null | undefined) {
	if (!value) return null;
	const trimmed = stripInvalidUnicode(value).replace(/\s+/g, " ").trim();
	return trimmed || null;
}

function sanitizeJsonValue(value: unknown): unknown {
	if (value === null) return null;
	if (typeof value === "string") return stripInvalidUnicode(value);
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "boolean") return value;
	if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item));
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, item]) => item !== undefined)
				.map(([key, item]) => [key, sanitizeJsonValue(item)]),
		);
	}
	return null;
}

function truncateText(value: string | null | undefined, maxLength: number) {
	const trimmed = sanitizeSnapshotText(value);
	if (!trimmed) return null;
	const characters = Array.from(trimmed);
	if (characters.length <= maxLength) return trimmed;
	return `${characters.slice(0, maxLength).join("")}...`;
}

function truncateForPrompt(value: string | null | undefined) {
	return truncateText(value, MAX_PROMPT_TEXT_LENGTH);
}

function getTextDataKey(value: string) {
	return value
		.normalize("NFKC")
		.toLowerCase()
		.replace(/\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function normalizeUniqueTextData(values: Array<string | null | undefined>) {
	const seen = new Set<string>();
	const parts: string[] = [];

	for (const value of values) {
		const normalized = sanitizeSnapshotText(value);
		if (!normalized) continue;

		const key = getTextDataKey(normalized);
		if (!key || seen.has(key)) continue;

		seen.add(key);
		parts.push(normalized);
	}

	return truncateText(parts.join(" | "), MAX_MEDIA_TEXT_DATA_LENGTH) ?? "";
}

function buildMediaTextData(media: {
	title: string | null;
	file: { fileName: string | null } | null;
	blog: { content: string | null } | null;
}) {
	const title = sanitizeSnapshotText(media.title);
	const fileName = sanitizeSnapshotText(media.file?.fileName);

	return normalizeUniqueTextData([
		title,
		fileName,
		!title && !fileName ? media.blog?.content : null,
	]);
}

function extractJsonPayload(text: string) {
	const trimmed = text.trim();
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fenced?.[1]) return fenced[1].trim();

	const objectStart = trimmed.indexOf("{");
	const objectEnd = trimmed.lastIndexOf("}");
	if (objectStart !== -1 && objectEnd > objectStart) {
		return trimmed.slice(objectStart, objectEnd + 1);
	}

	const arrayStart = trimmed.indexOf("[");
	const arrayEnd = trimmed.lastIndexOf("]");
	if (arrayStart !== -1 && arrayEnd > arrayStart) {
		return trimmed.slice(arrayStart, arrayEnd + 1);
	}

	return trimmed;
}

function parseAiJson(text: string) {
	return JSON.parse(extractJsonPayload(text)) as unknown;
}

function clampConfidence(value: number | undefined) {
	if (typeof value !== "number" || Number.isNaN(value)) return null;
	return Math.min(1, Math.max(0, value));
}

function confidenceScore(...values: Array<number | null | undefined>) {
	for (const value of values) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
	}
	return 0;
}

function normalizeSuggestionName(value: string | null | undefined) {
	return (
		sanitizeSnapshotText(value)
			?.normalize("NFKC")
			.toLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim() ?? ""
	);
}

function buildPrompt(snapshot: AlbumAutoIndexSnapshot) {
	const chunkInstructions = snapshot.chunk
		? `This is media chunk ${snapshot.chunk.index + 1} of ${snapshot.chunk.totalChunks}. Only classify candidate media from this chunk.`
		: "Only classify candidate media from input.media.";

	return `You are indexing audio media into existing albums for an Islamic audio app.

Return only valid JSON. Do not include markdown or commentary.

Use only IDs present in the input. Do not invent album IDs or media IDs.
${chunkInstructions}
Candidate media rows are compact: each has id and textData. textData is built from title and filename, or from caption content only when title and filename are missing.
albums.currentMedia is context only: use it as examples of what already belongs, but do not return those IDs unless the same ID also appears in input.media.
Each mediaId may appear at most once in the response. If a candidate fits more than one album, choose the best album.
For each album, return candidate media that should belong in that album.
If a coherent series/group has no suitable existing album, return it under proposedAlbums instead of forcing it into a weak album.
Proposed albums are review-only. Give each proposed album a concise name, albumType, and short reason.
Omit albums with no confident candidate media.
Prefer exact title/series continuity, channel context, and album keywords.
Keep reasons short.

Required JSON shape:
{
  "albums": [
    {
      "albumId": 123,
      "confidence": 0.92,
      "reason": "short reason",
      "media": [
        { "mediaId": 456, "confidence": 0.95, "reason": "short reason" }
      ]
    }
  ],
  "proposedAlbums": [
    {
      "name": "short album name",
      "albumType": "series",
      "confidence": 0.9,
      "reason": "short reason",
      "media": [
        { "mediaId": 789, "confidence": 0.94, "reason": "short reason" }
      ]
    }
  ]
}

Input:
${JSON.stringify(snapshot)}`;
}

export function buildAlbumAutoIndexSnapshot(input: {
	channel: AlbumAutoIndexSnapshot["channel"];
	albums: Array<{
		id: number;
		name: string;
		albumType: string | null;
		description: string | null;
		suggestionKeywords: string | null;
		medias: Array<{ id: number; title: string | null }>;
	}>;
	media: Array<{
		id: number;
		title: string | null;
		file: { fileName: string | null } | null;
		blog: { content: string | null } | null;
	}>;
	chunk?: AlbumIndexChunkMetadata;
}): AlbumAutoIndexSnapshot {
	return {
		channel: {
			id: input.channel.id,
			title: sanitizeSnapshotText(input.channel.title),
			username: sanitizeSnapshotText(input.channel.username),
		},
		chunk: input.chunk,
		albums: input.albums.map((album) => ({
			id: album.id,
			name: sanitizeSnapshotText(album.name) ?? "",
			albumType: sanitizeSnapshotText(album.albumType),
			description: truncateForPrompt(album.description),
			suggestionKeywords: truncateForPrompt(album.suggestionKeywords),
			currentMedia: album.medias
				.slice(0, MAX_ALBUM_CONTEXT_MEDIA)
				.map((media) => ({
					id: media.id,
					textData: normalizeUniqueTextData([media.title]),
				})),
		})),
		media: input.media.map((media) => ({
			id: media.id,
			textData: buildMediaTextData(media),
		})),
	};
}

export function getDeepSeekAlbumIndexConfig() {
	return getAlbumIndexAiConfig("deepseek");
}

export function getAlbumIndexAiConfig(provider: AlbumIndexAiProvider) {
	if (provider === "gemini") {
		return {
			provider,
			baseUrl:
				process.env.GEMINI_BASE_URL?.replace(/\/+$/, "") ??
				DEFAULT_GEMINI_BASE_URL,
			chatPath: "",
			model:
				process.env.GEMINI_ALBUM_INDEX_MODEL ??
				DEFAULT_GEMINI_ALBUM_INDEX_MODEL,
		};
	}

	if (provider === "openai") {
		return {
			provider,
			baseUrl:
				process.env.OPENAI_BASE_URL?.replace(/\/+$/, "") ??
				DEFAULT_OPENAI_BASE_URL,
			chatPath: "/chat/completions",
			model:
				process.env.OPENAI_ALBUM_INDEX_MODEL ??
				DEFAULT_OPENAI_ALBUM_INDEX_MODEL,
		};
	}

	return {
		provider,
		baseUrl:
			process.env.DEEPSEEK_BASE_URL?.replace(/\/+$/, "") ??
			DEFAULT_DEEPSEEK_BASE_URL,
		chatPath: process.env.DEEPSEEK_CHAT_COMPLETIONS_PATH?.startsWith("/")
			? process.env.DEEPSEEK_CHAT_COMPLETIONS_PATH
			: DEFAULT_DEEPSEEK_CHAT_PATH,
		model:
			process.env.DEEPSEEK_ALBUM_INDEX_MODEL ??
			DEFAULT_DEEPSEEK_ALBUM_INDEX_MODEL,
	};
}

function getAlbumIndexMessages(snapshot: AlbumAutoIndexSnapshot) {
	return [
		{
			role: "system",
			content:
				"You return strict JSON for album indexing. You never invent IDs.",
		},
		{ role: "user", content: buildPrompt(snapshot) },
	];
}

function parseOpenAiCompatibleResponse(
	data: {
		choices?: Array<{ message?: { content?: string } }>;
		usage?: { prompt_tokens?: number; completion_tokens?: number };
		model?: string;
	},
	fallbackModel: string,
	provider: AlbumIndexAiProvider,
): AlbumIndexAiResult {
	const text = data.choices?.[0]?.message?.content ?? "";
	const parsedResponse = sanitizeJsonValue(parseAiJson(text));

	return {
		provider,
		model: data.model ?? fallbackModel,
		text,
		rawResponse: sanitizeJsonValue(data),
		parsedResponse,
		inputTokens: data.usage?.prompt_tokens ?? null,
		outputTokens: data.usage?.completion_tokens ?? null,
	};
}

async function requestDeepSeekAlbumIndex(
	snapshot: AlbumAutoIndexSnapshot,
): Promise<AlbumIndexAiResult> {
	const apiKey = process.env.DEEPSEEK_API_KEY;
	if (!apiKey) {
		throw new Error("DEEPSEEK_API_KEY is not configured");
	}

	const config = getDeepSeekAlbumIndexConfig();
	const response = await fetch(`${config.baseUrl}${config.chatPath}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: config.model,
			temperature: 0.1,
			max_tokens: 8192,
			response_format: { type: "json_object" },
			messages: getAlbumIndexMessages(snapshot),
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`DeepSeek request failed (${response.status}): ${text}`);
	}

	const data = (await response.json()) as Parameters<
		typeof parseOpenAiCompatibleResponse
	>[0];
	return parseOpenAiCompatibleResponse(data, config.model, "deepseek");
}

async function requestOpenAiAlbumIndex(
	snapshot: AlbumAutoIndexSnapshot,
): Promise<AlbumIndexAiResult> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is not configured");
	}

	const config = getAlbumIndexAiConfig("openai");
	const tokenConfig = config.model.startsWith("gpt-5")
		? { max_completion_tokens: 8192 }
		: { max_tokens: 8192 };
	const response = await fetch(`${config.baseUrl}${config.chatPath}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: config.model,
			...tokenConfig,
			response_format: { type: "json_object" },
			messages: getAlbumIndexMessages(snapshot),
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`OpenAI request failed (${response.status}): ${text}`);
	}

	const data = (await response.json()) as Parameters<
		typeof parseOpenAiCompatibleResponse
	>[0];
	return parseOpenAiCompatibleResponse(data, config.model, "openai");
}

async function requestGeminiAlbumIndex(
	snapshot: AlbumAutoIndexSnapshot,
): Promise<AlbumIndexAiResult> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("GEMINI_API_KEY is not configured");
	}

	const config = getAlbumIndexAiConfig("gemini");
	const response = await fetch(
		`${config.baseUrl}/models/${config.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				contents: [{ parts: [{ text: buildPrompt(snapshot) }] }],
				generationConfig: {
					maxOutputTokens: 8192,
					responseMimeType: "application/json",
					temperature: 0.1,
				},
			}),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Gemini request failed (${response.status}): ${text}`);
	}

	const data = (await response.json()) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
		usageMetadata?: {
			promptTokenCount?: number;
			candidatesTokenCount?: number;
		};
	};
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
	const parsedResponse = sanitizeJsonValue(parseAiJson(text));

	return {
		provider: "gemini",
		model: config.model,
		text,
		rawResponse: sanitizeJsonValue(data),
		parsedResponse,
		inputTokens: data.usageMetadata?.promptTokenCount ?? null,
		outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
	};
}

export async function requestAlbumIndex(
	snapshot: AlbumAutoIndexSnapshot,
	options: { provider?: AlbumIndexAiProvider } = {},
): Promise<AlbumIndexAiResult> {
	const provider = options.provider ?? "deepseek";
	if (provider === "gemini") return requestGeminiAlbumIndex(snapshot);
	if (provider === "openai") return requestOpenAiAlbumIndex(snapshot);
	return requestDeepSeekAlbumIndex(snapshot);
}

export function normalizeAlbumIndexResponse(
	parsedResponse: unknown,
	snapshot: AlbumAutoIndexSnapshot,
): NormalizedAlbumIndex {
	const parsed = albumIndexResponseSchema.parse(parsedResponse);
	const albumById = new Map(snapshot.albums.map((album) => [album.id, album]));
	const mediaById = new Map(snapshot.media.map((media) => [media.id, media]));
	const invalidMessages: string[] = [];
	const normalizeMediaEntries = (
		entries: ParsedMediaSuggestion[],
		context: string,
	) => {
		const seenMediaIds = new Set<number>();
		return entries.flatMap((entry) => {
			const mediaSnapshot = mediaById.get(entry.mediaId);
			if (!mediaSnapshot) {
				invalidMessages.push(`Unknown mediaId ${entry.mediaId} for ${context}`);
				return [];
			}
			if (seenMediaIds.has(entry.mediaId)) return [];
			seenMediaIds.add(entry.mediaId);

			return {
				mediaId: entry.mediaId,
				mediaTitleSnapshot: mediaSnapshot.textData,
				confidence: clampConfidence(entry.confidence),
				reason: sanitizeSnapshotText(entry.reason),
			};
		});
	};

	const existingAlbums = (parsed.albums ?? []).flatMap((album) => {
		const albumSnapshot = albumById.get(album.albumId);
		if (!albumSnapshot) {
			invalidMessages.push(`Unknown albumId: ${album.albumId}`);
			return [];
		}

		const mediaEntries: ParsedMediaSuggestion[] =
			album.media ?? album.mediaIds?.map((mediaId) => ({ mediaId })) ?? [];
		const media = normalizeMediaEntries(
			mediaEntries,
			`albumId ${album.albumId}`,
		);

		if (media.length === 0) return [];

		return {
			suggestionType: "existing_album" as const,
			albumId: album.albumId,
			albumNameSnapshot: albumSnapshot.name,
			proposedAlbumName: null,
			proposedAlbumType: null,
			proposedDescription: null,
			proposedSuggestionKeywords: null,
			confidence: clampConfidence(album.confidence),
			reason: sanitizeSnapshotText(album.reason),
			media,
		};
	});

	const proposedAlbums = (parsed.proposedAlbums ?? []).flatMap((album) => {
		const proposedAlbumName = sanitizeSnapshotText(album.name);
		if (!proposedAlbumName) return [];

		const mediaEntries: ParsedMediaSuggestion[] =
			album.media ?? album.mediaIds?.map((mediaId) => ({ mediaId })) ?? [];
		const media = normalizeMediaEntries(
			mediaEntries,
			`proposed album ${proposedAlbumName}`,
		);

		if (media.length === 0) return [];

		return {
			suggestionType: "proposed_album" as const,
			albumId: null,
			albumNameSnapshot: proposedAlbumName,
			proposedAlbumName,
			proposedAlbumType: sanitizeSnapshotText(album.albumType) ?? "series",
			proposedDescription: sanitizeSnapshotText(album.description),
			proposedSuggestionKeywords: sanitizeSnapshotText(
				album.suggestionKeywords,
			),
			confidence: clampConfidence(album.confidence),
			reason: sanitizeSnapshotText(album.reason),
			media,
		};
	});

	const albums = [...existingAlbums, ...proposedAlbums];

	if (invalidMessages.length > 0) {
		throw new Error(invalidMessages.join("; "));
	}

	return {
		parsedResponse: parsed,
		albums,
		suggestionCount: albums.reduce(
			(count, album) => count + album.media.length,
			0,
		),
	};
}

export function mergeAlbumIndexResponses(
	results: NormalizedAlbumIndex[],
): NormalizedAlbumIndex {
	type NormalizedAlbumSuggestion = NormalizedAlbumIndex["albums"][number];
	type NormalizedMediaSuggestion = NormalizedAlbumSuggestion["media"][number];
	const getSuggestionKey = (album: NormalizedAlbumSuggestion) =>
		album.suggestionType === "existing_album" && album.albumId != null
			? `existing:${album.albumId}`
			: `proposed:${normalizeSuggestionName(album.proposedAlbumName ?? album.albumNameSnapshot)}`;
	const suggestionMetaByKey = new Map<
		string,
		{
			suggestionType: NormalizedAlbumSuggestion["suggestionType"];
			albumId: number | null;
			albumNameSnapshot: string | null;
			proposedAlbumName: string | null;
			proposedAlbumType: string | null;
			proposedDescription: string | null;
			proposedSuggestionKeywords: string | null;
			confidence: number | null;
			reason: string | null;
			score: number;
			order: number;
		}
	>();
	const bestMediaById = new Map<
		number,
		{
			suggestionKey: string;
			media: NormalizedMediaSuggestion;
			score: number;
			order: number;
		}
	>();
	let order = 0;

	for (const result of results) {
		for (const album of result.albums) {
			const suggestionKey = getSuggestionKey(album);
			if (suggestionKey === "proposed:") continue;
			const albumScore = confidenceScore(album.confidence);
			const existingMeta = suggestionMetaByKey.get(suggestionKey);
			if (!existingMeta || albumScore > existingMeta.score) {
				suggestionMetaByKey.set(suggestionKey, {
					suggestionType: album.suggestionType,
					albumId: album.albumId,
					albumNameSnapshot: album.albumNameSnapshot,
					proposedAlbumName: album.proposedAlbumName,
					proposedAlbumType: album.proposedAlbumType,
					proposedDescription: album.proposedDescription,
					proposedSuggestionKeywords: album.proposedSuggestionKeywords,
					confidence: album.confidence,
					reason: album.reason,
					score: albumScore,
					order: existingMeta?.order ?? order,
				});
			}

			for (const media of album.media) {
				const score = confidenceScore(media.confidence, album.confidence);
				const existingMedia = bestMediaById.get(media.mediaId);
				if (!existingMedia || score > existingMedia.score) {
					bestMediaById.set(media.mediaId, {
						suggestionKey,
						media,
						score,
						order,
					});
				}
				order += 1;
			}
		}
	}

	const groupedByAlbum = new Map<
		string,
		{
			suggestionType: NormalizedAlbumSuggestion["suggestionType"];
			albumId: number | null;
			albumNameSnapshot: string | null;
			proposedAlbumName: string | null;
			proposedAlbumType: string | null;
			proposedDescription: string | null;
			proposedSuggestionKeywords: string | null;
			confidence: number | null;
			reason: string | null;
			order: number;
			media: NormalizedMediaSuggestion[];
		}
	>();

	for (const candidate of Array.from(bestMediaById.values()).sort(
		(a, b) => a.order - b.order,
	)) {
		const meta = suggestionMetaByKey.get(candidate.suggestionKey);
		if (!meta) continue;
		const group = groupedByAlbum.get(candidate.suggestionKey) ?? {
			suggestionType: meta.suggestionType,
			albumId: meta.albumId,
			albumNameSnapshot: meta?.albumNameSnapshot ?? null,
			proposedAlbumName: meta.proposedAlbumName,
			proposedAlbumType: meta.proposedAlbumType,
			proposedDescription: meta.proposedDescription,
			proposedSuggestionKeywords: meta.proposedSuggestionKeywords,
			confidence: meta?.confidence ?? null,
			reason: meta?.reason ?? null,
			order: meta?.order ?? candidate.order,
			media: [],
		};
		group.media.push(candidate.media);
		groupedByAlbum.set(candidate.suggestionKey, group);
	}

	const albums = Array.from(groupedByAlbum.values())
		.sort((a, b) => a.order - b.order)
		.map(({ order: _order, ...album }) => album);
	const parsedResponse = {
		albums: albums
			.filter(
				(album) =>
					album.suggestionType === "existing_album" && album.albumId != null,
			)
			.map((album) => ({
				albumId: album.albumId,
				confidence: album.confidence,
				reason: album.reason,
				media: album.media.map((media) => ({
					mediaId: media.mediaId,
					confidence: media.confidence,
					reason: media.reason,
				})),
			})),
		proposedAlbums: albums
			.filter((album) => album.suggestionType === "proposed_album")
			.map((album) => ({
				name: album.proposedAlbumName ?? album.albumNameSnapshot,
				albumType: album.proposedAlbumType,
				description: album.proposedDescription,
				suggestionKeywords: album.proposedSuggestionKeywords,
				confidence: album.confidence,
				reason: album.reason,
				media: album.media.map((media) => ({
					mediaId: media.mediaId,
					confidence: media.confidence,
					reason: media.reason,
				})),
			})),
	};

	return {
		parsedResponse,
		albums,
		suggestionCount: albums.reduce(
			(count, album) => count + album.media.length,
			0,
		),
	};
}
