import { Parser } from "htmlparser2";

// Pure KetabOnline contract adapter. Network transport lives in @acme/jobs so these
// conversions stay deterministic and testable with synthetic fixtures.

export const KETABONLINE_PROVIDER = "ketabonline" as const;
export const KETABONLINE_API_BASE = "https://backend.ketabonline.com/api/v2";
export const KETABONLINE_CONTENT_HOST = "s2.ketabonline.com";

export const KETABONLINE_LIMITS = {
	maxBookId: 2_000_000_000,
	maxSearchQueryLength: 120,
	maxSearchLimit: 20,
	maxPages: 50_000,
	maxParts: 500,
	maxPageHtmlChars: 400_000,
	maxIndexNodes: 50_000,
	maxIndexDepth: 64,
	// The unscoped index endpoint silently stops at 1000 root rows; treat that as truncation.
	indexRootTruncation: 1000,
} as const;

export type KetabOnlineErrorCode =
	| "invalid_id"
	| "not_found"
	| "unavailable"
	| "upstream"
	| "rate_limited"
	| "invalid_response"
	| "invalid_archive"
	| "too_large"
	| "mismatch"
	| "incomplete_index";

export class KetabOnlineError extends Error {
	readonly code: KetabOnlineErrorCode;
	readonly retryable: boolean;
	constructor(code: KetabOnlineErrorCode, message: string, retryable = false) {
		super(message);
		this.name = "KetabOnlineError";
		this.code = code;
		this.retryable = retryable;
	}
}

export type KetabOnlinePart = {
	sourcePartId: number;
	name: string;
	/** 1-based position in the metadata part list; used as the local volume number. */
	ordinal: number;
	firstPageId: number | null;
	pages: number | null;
};

export type KetabOnlineBookSummary = {
	id: number;
	title: string;
	authors: string[];
	categories: string[];
	pagesCount: number;
	partsCount: number;
	indexCount: number;
	source: string | null;
	colors: string[];
};

export type KetabOnlineBookMetadata = KetabOnlineBookSummary & {
	description: string | null;
	publisher: string | null;
	parts: KetabOnlinePart[];
	contentUrl: string | null;
	contentSize: number | null;
	updatedAt: string | null;
};

export type KetabOnlineSourcePage = {
	sourcePageId: number;
	printedPageNo: number | null;
	partName: string;
	volumeNumber: number;
	html: string;
	unsupportedFields: string[];
};

export type KetabOnlineParagraph = {
	pid: number;
	text: string;
	footnoteIds: string | null;
	sourceMarks: { kind: "c5"; start: number; end: number }[];
};

export type KetabOnlineFootnote = {
	marker: string;
	type: "footnote";
	content: string;
	linkedParagraphs: string | null;
};

export type KetabOnlineIndexNode = {
	sourceNodeId: number;
	parentSourceNodeId: number | null;
	title: string;
	sourcePageId: number;
	toSourcePageId: number | null;
	printedPageNo: number | null;
	partName: string;
	volumeNumber: number;
	depth: number;
	sortOrder: number;
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const positiveId = (value: unknown, max: number = Number.MAX_SAFE_INTEGER) =>
	typeof value === "number" &&
	Number.isSafeInteger(value) &&
	value > 0 &&
	value <= max
		? value
		: null;

const optionalCount = (value: unknown) =>
	typeof value === "number" && Number.isSafeInteger(value) && value >= 0
		? value
		: null;

const cleanText = (value: unknown, max = 2_000) => {
	if (typeof value !== "string") return null;
	const text = value
		.replace(/<[^>]*>/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return text ? text.slice(0, max) : null;
};

const invalid = (message: string) =>
	new KetabOnlineError("invalid_response", message, true);

/** Accepts a bare positive ID or a ketabonline.com book link; never an arbitrary download URL. */
export function parseKetabOnlineBookId(input: string | number): number | null {
	if (typeof input === "number")
		return positiveId(input, KETABONLINE_LIMITS.maxBookId);
	const value = input.trim();
	if (/^\d{1,10}$/.test(value))
		return positiveId(Number(value), KETABONLINE_LIMITS.maxBookId);
	try {
		const url = new URL(value);
		if (
			url.protocol !== "https:" ||
			!/^(?:www\.)?ketabonline\.com$/.test(url.hostname) ||
			url.username ||
			url.password
		)
			return null;
		const match = url.pathname.match(/^\/(?:[a-z]{2}\/)?books?\/(\d{1,10})(?:\/|$)/);
		return match
			? positiveId(Number(match[1]), KETABONLINE_LIMITS.maxBookId)
			: null;
	} catch {
		return null;
	}
}

/** Unwraps `{status, code, data}` and rejects application-level failures behind HTTP 200. */
export function readKetabOnlineEnvelope(json: unknown): unknown {
	if (!isRecord(json)) throw invalid("KetabOnline returned an unexpected response.");
	if (json.status !== true || json.code !== 200) {
		if (json.code === 404)
			throw new KetabOnlineError("not_found", "This book is not available on KetabOnline.");
		throw invalid("KetabOnline reported an error for this request.");
	}
	return json.data;
}

function readNames(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (isRecord(item) ? cleanText(item.name, 300) : null))
		.filter((name): name is string => Boolean(name))
		.slice(0, 20);
}

function readColors(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value
		.filter((color): color is string => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))
		.slice(0, 4);
}

function readSummary(data: JsonRecord): KetabOnlineBookSummary {
	const id = positiveId(data.id, KETABONLINE_LIMITS.maxBookId);
	const title = cleanText(data.title, 500);
	if (!id || !title) throw invalid("KetabOnline returned a book without an ID or title.");
	return {
		id,
		title,
		authors: readNames(data.authors),
		categories: readNames(data.categories),
		pagesCount: optionalCount(data.pages_count) ?? 0,
		partsCount: optionalCount(data.parts_count) ?? 0,
		indexCount: optionalCount(data.index_count) ?? 0,
		source: cleanText(data.source, 300),
		colors: readColors(data.colors),
	};
}

export function normalizeKetabOnlineSearch(json: unknown) {
	const data = readKetabOnlineEnvelope(json);
	if (!Array.isArray(data)) throw invalid("KetabOnline search returned an unexpected list.");
	const meta = isRecord(json) && isRecord(json.meta) ? json.meta : {};
	const page = positiveId(meta.current_page) ?? 1;
	const lastPage = positiveId(meta.last_page) ?? page;
	const total = optionalCount(meta.total) ?? data.length;
	const items: KetabOnlineBookSummary[] = [];
	for (const row of data.slice(0, KETABONLINE_LIMITS.maxSearchLimit)) {
		// Skip malformed rows instead of failing the whole page of useful results.
		if (!isRecord(row)) continue;
		try {
			items.push(readSummary(row));
		} catch {}
	}
	return { items, page, lastPage, total, hasMore: page < lastPage };
}

export function normalizeKetabOnlineMetadata(
	json: unknown,
	expectedId: number,
): KetabOnlineBookMetadata {
	const data = readKetabOnlineEnvelope(json);
	if (!isRecord(data)) throw invalid("KetabOnline returned unexpected book details.");
	const summary = readSummary(data);
	if (summary.id !== expectedId)
		throw new KetabOnlineError("mismatch", "KetabOnline returned a different book.");
	const rawParts = Array.isArray(data.parts) ? data.parts : [];
	if (rawParts.length > KETABONLINE_LIMITS.maxParts)
		throw new KetabOnlineError("too_large", "This book has too many volumes to import.");
	const parts: KetabOnlinePart[] = [];
	const names = new Set<string>();
	for (const [index, part] of rawParts.entries()) {
		if (!isRecord(part)) throw invalid("A volume entry is malformed.");
		const sourcePartId = positiveId(part.id);
		const name =
			typeof part.name === "string" || typeof part.name === "number"
				? String(part.name).trim()
				: "";
		if (!sourcePartId || !name || name.length > 100 || names.has(name))
			throw invalid("A volume entry is missing or duplicated.");
		names.add(name);
		parts.push({
			sourcePartId,
			name,
			ordinal: index + 1,
			firstPageId: positiveId(part.page_id),
			pages: optionalCount(part.pages),
		});
	}
	const files = isRecord(data.files) ? data.files : {};
	const content = isRecord(files.data) ? files.data : {};
	const contentUrl =
		typeof content.url === "string" && content.url.trim() ? content.url.trim() : null;
	return {
		...summary,
		description: cleanText(data.description, 4_000),
		publisher: cleanText(data.publisher, 300),
		parts,
		contentUrl,
		contentSize: optionalCount(content.size),
		updatedAt: typeof data.updated_at === "string" ? data.updated_at.slice(0, 40) : null,
	};
}

/** Follow metadata download links only on the verified content host and path. */
export function validateKetabOnlineContentUrl(url: string, bookId: number) {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new KetabOnlineError("invalid_response", "The book download link is invalid.");
	}
	if (
		parsed.protocol !== "https:" ||
		parsed.hostname !== KETABONLINE_CONTENT_HOST ||
		parsed.port ||
		parsed.username ||
		parsed.password ||
		parsed.pathname !== `/books/${bookId}/${bookId}.data.zip`
	) {
		throw new KetabOnlineError(
			"invalid_response",
			"The book download link points outside the KetabOnline content host.",
		);
	}
	return parsed;
}

export function ketabOnlineArchiveEntryName(bookId: number) {
	return `${bookId}.data.json`;
}

const UNSUPPORTED_PAGE_FIELDS = [
	"quran",
	"hadeeth",
	"shrooh",
	"rowa",
	"reciters",
	"seal",
] as const;

/** Validates the expanded ZIP JSON and returns pages in stable reading order. */
export function normalizeKetabOnlineContent(
	json: unknown,
	metadata: Pick<KetabOnlineBookMetadata, "id" | "parts" | "pagesCount">,
): KetabOnlineSourcePage[] {
	if (!isRecord(json)) throw new KetabOnlineError("invalid_archive", "The book archive is malformed.");
	if (positiveId(json.id) !== metadata.id)
		throw new KetabOnlineError("mismatch", "The book archive belongs to a different book.");
	const rawPages = json.pages;
	if (!Array.isArray(rawPages) || rawPages.length === 0)
		throw new KetabOnlineError(
			"unavailable",
			"KetabOnline does not provide readable text for this book.",
		);
	if (rawPages.length > KETABONLINE_LIMITS.maxPages)
		throw new KetabOnlineError("too_large", "This book has too many pages to import.");
	const partsByName = new Map(metadata.parts.map((part) => [part.name, part]));
	const partsById = new Map(metadata.parts.map((part) => [part.sourcePartId, part]));
	const seen = new Set<number>();
	const pages: KetabOnlineSourcePage[] = [];
	for (const raw of rawPages) {
		if (!isRecord(raw)) throw new KetabOnlineError("invalid_archive", "A page entry is malformed.");
		const sourcePageId = positiveId(raw.id);
		if (!sourcePageId || seen.has(sourcePageId))
			throw new KetabOnlineError("invalid_archive", "A page ID is missing or duplicated.");
		seen.add(sourcePageId);
		const partRecord = isRecord(raw.part) ? raw.part : null;
		const partName =
			partRecord && (typeof partRecord.name === "string" || typeof partRecord.name === "number")
				? String(partRecord.name).trim()
				: "";
		const part =
			partsByName.get(partName) ??
			(partRecord ? partsById.get(positiveId(partRecord.id) ?? 0) : undefined);
		// Part IDs are opaque; only an exact metadata match proves the volume.
		if (!part || (partRecord && positiveId(partRecord.id) !== part.sourcePartId))
			throw new KetabOnlineError("mismatch", "A page belongs to an unknown volume.");
		const html = typeof raw.content === "string" ? raw.content : "";
		if (html.length > KETABONLINE_LIMITS.maxPageHtmlChars)
			throw new KetabOnlineError("too_large", "A page exceeds the supported size.");
		const printed = raw.page;
		pages.push({
			sourcePageId,
			printedPageNo:
				typeof printed === "number" && Number.isSafeInteger(printed) && printed >= 0
					? printed
					: null,
			partName: part.name,
			volumeNumber: part.ordinal,
			html,
			unsupportedFields: UNSUPPORTED_PAGE_FIELDS.filter((field) => {
				const value = raw[field];
				return value != null && value !== "" && !(Array.isArray(value) && value.length === 0);
			}),
		});
	}
	if (metadata.pagesCount > 0 && pages.length !== metadata.pagesCount)
		throw new KetabOnlineError(
			"mismatch",
			"The downloaded text does not match the catalogue page count. Retry later.",
			true,
		);
	// Printed numbers repeat across volumes, so order by volume then opaque source ID.
	return pages.sort(
		(a, b) => a.volumeNumber - b.volumeNumber || a.sourcePageId - b.sourcePageId,
	);
}

const MARKED_CLASSES = new Set(["g-aya", "g-holy-word", "g-hadeeth", "g-basmla"]);
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "wbr"]);
const DROPPED_TAGS = new Set(["script", "style", "noscript", "template", "iframe", "object"]);

type Block = {
	sourceId: string | null;
	chars: { ch: string; marked: boolean }[];
	refs: string[];
	targetMarker: string | null;
};

const stripMarker = (value: string) =>
	value.replace(/[()[\]\s]/g, "").slice(0, 20);

function collectBlocks(html: string) {
	const blocks: Block[] = [];
	const stack: { name: string; marked: boolean; kind: "block" | "link" | "target" | "other" | "drop" }[] = [];
	let current: Block | null = null;
	let linkText: string | null = null;
	let targetText: string | null = null;
	const marked = () => stack.some((entry) => entry.marked);
	const dropping = () => stack.some((entry) => entry.kind === "drop");
	const parser = new Parser(
		{
			onopentag(name, attribs) {
				if (VOID_TAGS.has(name)) {
					if (name === "br" && current) current.chars.push({ ch: " ", marked: false });
					return;
				}
				const classes = (attribs.class ?? "").split(/\s+/).filter(Boolean);
				let kind: (typeof stack)[number]["kind"] = "other";
				if (DROPPED_TAGS.has(name)) kind = "drop";
				else if (!current && (name === "p" || classes.includes("g-table"))) {
					kind = "block";
					current = { sourceId: attribs.id ?? null, chars: [], refs: [], targetMarker: null };
				} else if (name === "a" && classes.includes("g-footnote-link")) {
					kind = "link";
					linkText = "";
				} else if (classes.includes("g-footnote-target")) {
					kind = "target";
					targetText = "";
				}
				stack.push({ name, kind, marked: classes.some((item) => MARKED_CLASSES.has(item)) });
			},
			ontext(text) {
				if (!current || dropping()) return;
				const isMarked = marked();
				// The footnote target marker is metadata of the note, not part of its body.
				if (targetText !== null) {
					targetText += text;
					return;
				}
				if (linkText !== null) linkText += text;
				for (const ch of text) current.chars.push({ ch, marked: isMarked });
			},
			onclosetag(name) {
				if (VOID_TAGS.has(name)) return;
				const index = stack.map((entry) => entry.name).lastIndexOf(name);
				if (index < 0) return;
				for (const entry of stack.splice(index).reverse()) {
					if (entry.kind === "link" && current && linkText !== null) {
						const marker = stripMarker(linkText);
						if (marker && !current.refs.includes(marker)) current.refs.push(marker);
						linkText = null;
					} else if (entry.kind === "target" && current && targetText !== null) {
						current.targetMarker ??= stripMarker(targetText) || null;
						targetText = null;
					} else if (entry.kind === "block" && current) {
						blocks.push(current);
						current = null;
					}
				}
			},
		},
		{ decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
	);
	parser.write(html);
	parser.end();
	if (current) blocks.push(current);
	return blocks;
}

/** Collapses whitespace while keeping highlight offsets aligned with the final text. */
function finishText(chars: Block["chars"]) {
	let text = "";
	const markedAt: boolean[] = [];
	let pendingSpace = false;
	let pendingSpaceMarked = false;
	for (const { ch, marked } of chars) {
		if (/\s/.test(ch)) {
			if (!pendingSpace) pendingSpaceMarked = marked;
			else pendingSpaceMarked &&= marked;
			pendingSpace = text.length > 0;
			continue;
		}
		if (pendingSpace) {
			text += " ";
			// A space inside one marked phrase stays inside its highlight.
			markedAt.push(pendingSpaceMarked && marked && markedAt.at(-1) === true);
			pendingSpace = false;
		}
		text += ch;
		markedAt.push(marked);
	}
	const marks: { kind: "c5"; start: number; end: number }[] = [];
	let start = -1;
	for (let index = 0; index <= text.length; index++) {
		const on = index < text.length && markedAt[index] === true;
		if (on && start < 0) start = index;
		if (!on && start >= 0) {
			marks.push({ kind: "c5", start, end: index });
			start = -1;
		}
	}
	return { text, marks };
}

/**
 * Converts KetabOnline formatted HTML into the reader's paragraph/footnote rows.
 * Only text is retained, so scripts, handlers and links never reach the reader.
 */
export function convertKetabOnlinePageHtml(html: string) {
	const separator = html.search(/<[a-z]+\b[^>]*\bg-page-separator\b/i);
	const bodyHtml = separator >= 0 ? html.slice(0, separator) : html;
	const footerHtml = separator >= 0 ? html.slice(separator) : "";

	const paragraphs: KetabOnlineParagraph[] = [];
	const sourceParagraphIds: string[] = [];
	const bodyBlocks = collectBlocks(bodyHtml)
		.map((block) => ({ block, ...finishText(block.chars) }))
		.filter((entry) => entry.text);
	const sourcePids = bodyBlocks.map(({ block }) => {
		const match = block.sourceId?.match(/^p-(\d{1,6})$/);
		return match ? Number(match[1]) : null;
	});
	// Keep source paragraph numbers when they are a clean increasing sequence.
	const useSourcePids = sourcePids.every(
		(pid, index) => pid !== null && pid > 0 && (index === 0 || pid > (sourcePids[index - 1] ?? 0)),
	);
	for (const [index, entry] of bodyBlocks.entries()) {
		paragraphs.push({
			pid: useSourcePids ? (sourcePids[index] as number) : index + 1,
			text: entry.text,
			footnoteIds: entry.block.refs.length ? entry.block.refs.join(",") : null,
			sourceMarks: entry.marks,
		});
		if (entry.block.sourceId) sourceParagraphIds.push(entry.block.sourceId);
	}

	const footnotes: KetabOnlineFootnote[] = [];
	for (const block of collectBlocks(footerHtml)) {
		const { text } = finishText(block.chars);
		const content = text.replace(/^["“”\s]+/, "").trim();
		if (!block.targetMarker) {
			// A note body continued in a following source paragraph.
			const previous = footnotes.at(-1);
			if (previous && content) previous.content = `${previous.content}\n${content}`;
			else if (content)
				footnotes.push({ marker: String(footnotes.length + 1), type: "footnote", content, linkedParagraphs: null });
			continue;
		}
		const linked = paragraphs
			.filter((paragraph) => paragraph.footnoteIds?.split(",").includes(block.targetMarker!))
			.map((paragraph) => paragraph.pid);
		footnotes.push({
			marker: block.targetMarker,
			type: "footnote",
			content,
			linkedParagraphs: linked.length ? linked.join(",") : null,
		});
	}
	return { paragraphs, footnotes, sourceParagraphIds };
}

type RawIndexNode = {
	id: number;
	parent: number;
	title: string;
	pageId: number;
	toPageId: number | null;
	printed: number | null;
	partName: string;
	children: RawIndexNode[];
};

function readIndexNode(value: unknown, bookId: number, depth: number): RawIndexNode {
	if (!isRecord(value)) throw invalid("A chapter entry is malformed.");
	if (depth > KETABONLINE_LIMITS.maxIndexDepth)
		throw new KetabOnlineError("too_large", "The chapter tree is nested too deeply.");
	const id = positiveId(value.id);
	const pageId = positiveId(value.page_id);
	const title = cleanText(value.title, 1_000);
	if (!id || !pageId || !title) throw invalid("A chapter entry is missing its title or page.");
	if (value.book_id !== undefined && positiveId(value.book_id) !== bookId)
		throw new KetabOnlineError("mismatch", "A chapter belongs to a different book.");
	const parent = optionalCount(value.parent);
	if (parent === null) throw invalid("A chapter parent reference is malformed.");
	const children = value.children == null ? [] : value.children;
	if (!Array.isArray(children)) throw invalid("A chapter's children are malformed.");
	return {
		id,
		parent,
		title,
		pageId,
		toPageId: positiveId(value.to_page_id),
		printed: optionalCount(value.page),
		partName:
			typeof value.part_name === "string" || typeof value.part_name === "number"
				? String(value.part_name).trim()
				: "",
		children: children.map((child) => readIndexNode(child, bookId, depth + 1)),
	};
}

export type KetabOnlineIndexPart = { partName: string; nodes: RawIndexNode[] };

/** Validates one `index?is_recursive=1&part=<name>` response. */
export function normalizeKetabOnlineIndexPart(
	json: unknown,
	input: { bookId: number; partName: string },
): KetabOnlineIndexPart {
	const data = readKetabOnlineEnvelope(json);
	if (!Array.isArray(data)) throw invalid("KetabOnline returned an unexpected chapter list.");
	if (data.length >= KETABONLINE_LIMITS.indexRootTruncation)
		throw new KetabOnlineError(
			"incomplete_index",
			"A volume's chapter list may be truncated by KetabOnline.",
			true,
		);
	return {
		partName: input.partName,
		nodes: data.map((node) => readIndexNode(node, input.bookId, 0)),
	};
}

/**
 * Flattens every volume's recursive index into one validated tree. Throws instead of
 * returning a partial tree so callers never publish a truncated chapter list as complete.
 */
export function flattenKetabOnlineIndex(input: {
	parts: KetabOnlineIndexPart[];
	volumes: Pick<KetabOnlinePart, "name" | "ordinal">[];
	pageIds: ReadonlySet<number>;
	expectedCount: number;
}): KetabOnlineIndexNode[] {
	const volumeByName = new Map(input.volumes.map((part) => [part.name, part.ordinal]));
	const flat: KetabOnlineIndexNode[] = [];
	const seen = new Map<number, string>();
	let sortOrder = 0;
	const walk = (
		nodes: RawIndexNode[],
		parentId: number | null,
		depth: number,
		partName: string,
	) => {
		for (const node of nodes) {
			if (flat.length >= KETABONLINE_LIMITS.maxIndexNodes)
				throw new KetabOnlineError("too_large", "The chapter tree exceeds the supported size.");
			if ((parentId ?? 0) !== node.parent)
				throw new KetabOnlineError("incomplete_index", "A chapter's parent link is inconsistent.");
			const nodePart = node.partName || partName;
			const volumeNumber = volumeByName.get(nodePart);
			if (nodePart !== partName || volumeNumber === undefined)
				throw new KetabOnlineError("mismatch", "A chapter belongs to a different volume.");
			if (!input.pageIds.has(node.pageId))
				throw new KetabOnlineError("incomplete_index", "A chapter points to a page that is not in the book.", true);
			const signature = JSON.stringify([node.parent, node.title, node.pageId]);
			const previous = seen.get(node.id);
			if (previous !== undefined) {
				if (previous !== signature)
					throw new KetabOnlineError("incomplete_index", "The chapter list has conflicting duplicate entries.");
				continue;
			}
			seen.set(node.id, signature);
			flat.push({
				sourceNodeId: node.id,
				parentSourceNodeId: parentId,
				title: node.title,
				sourcePageId: node.pageId,
				toSourcePageId: node.toPageId,
				printedPageNo: node.printed,
				partName: nodePart,
				volumeNumber,
				depth,
				sortOrder: sortOrder++,
			});
			walk(node.children, node.id, depth + 1, partName);
		}
	};
	for (const part of input.parts) walk(part.nodes, null, 0, part.partName);
	if (flat.length !== input.expectedCount)
		throw new KetabOnlineError(
			"incomplete_index",
			`The chapter list has ${flat.length} of ${input.expectedCount} expected entries.`,
			true,
		);
	return flat;
}
