import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";
import {
  createBookDocumentFromParagraphs,
  createDocumentFromHtml,
  getDocumentPlainText,
  parseShamelaOpenPage,
  serializeDocumentToHtml,
} from "@acme/document";

const SHAMELA_EXTRACT_PROMPT = `You are a structured data extractor for Islamic books from Shamela (the largest Islamic digital library).

Given an HTML page from Shamela, extract the book page content and return it as a JSON object with this exact shape:

{
  "shamelaPageNo": <number — the page ID from the URL path's last segment, e.g. /book/123/1112 => 1112>,
  "printedPageNo": <number | null — the printed book page number if shown>,
  "chapterTitle": <string | null — the chapter/باب title if present>,
  "chapterUrl": <string | null — the chapter URL if present>,
  "topicTitle": <string | null — the topic/فصل title if present>,
  "topicUrl": <string | null — the topic URL if present>,
  "paragraphs": [
    {
      "pid": <number — sequential 1-based index>,
      "text": <string — clean Arabic text of the paragraph, no HTML>,
      "footnoteIds": <string | null — comma-separated footnote marker numbers referenced in this paragraph, e.g. "1,3,5">
    }
  ],
  "footnotes": [
    {
      "marker": <string — the footnote marker, e.g. "1", "2", "أ">,
      "type": <string | null — "footnote" | "endnote" | null>,
      "content": <string — clean Arabic text of the footnote>,
      "linkedParagraphs": <string | null — comma-separated pid values that reference this footnote>
    }
  ]
}

Rules:
- Extract ALL paragraph text. Preserve Arabic diacritics (tashkeel).
- Footnote markers in paragraph text appear as superscript numbers/letters — record them in footnoteIds.
- If a paragraph has no footnotes, set footnoteIds to null.
- Clean the text: remove HTML tags, normalize whitespace, but keep Arabic characters intact.
- If a field is not found on the page, set it to null.
- Return ONLY the JSON object, no markdown, no explanation.`;

const SHAMELA_BOOK_META_PROMPT = `You are a metadata extractor for the Shamela Islamic library website (shamela.ws).

Given an HTML page of a book's index or first page from Shamela, extract the book metadata and return it as a JSON object with this exact shape:

{
  "nameAr": <string — the full Arabic title of the book>,
  "nameEn": <string | null — the English title if present, otherwise null>,
  "authorName": <string | null — the author's name in Arabic>,
  "authorNameEn": <string | null — the author's name in English if present>,
  "authorUrl": <string | null — the URL to the author's page on Shamela>,
  "category": <string | null — the book's category/classification (e.g. فقه، حديث، تفسير)>,
  "categoryUrl": <string | null — the URL to the category page>,
  "shelfName": <string | null — the series or collection name if the book belongs to one>,
  "coverColor": <string | null — a hex color that fits the book's theme (pick a rich dark color like #4c1d95, #7c2d12, #14532d, #1e3a5f)>,
  "description": <string | null — a short description or introduction about the book if found on the page>
}

Rules:
- Extract from whatever is visible on the page: page title, breadcrumbs, metadata sections, etc.
- For authorUrl and categoryUrl: reconstruct the full absolute URL using https://shamela.ws as base if only a relative path is given.
- If a field is not found, set it to null.
- Return ONLY the JSON object, no markdown, no explanation.`;

const SHAMELA_TOC_EXTRACT_PROMPT = `You are a table-of-contents extractor for the Shamela Islamic library website (shamela.ws).

Given the HTML of a book's index page from Shamela, extract the full table of contents and return it as a JSON object with this exact shape:

{
  "volumes": [
    { "number": <number — volume number, 1-based>, "title": <string | null — volume title in Arabic> }
  ],
  "chapters": [
    {
      "shamelaPageNo": <number — the numeric page ID at the end of the chapter URL, e.g. for /book/123/4567 it is 4567>,
      "shamelaUrl": <string — the full absolute URL of the chapter, e.g. https://shamela.ws/book/123/4567>,
      "chapterTitle": <string | null — the chapter title in Arabic>,
      "topicTitle": <string | null — sub-topic title if present>,
      "volumeNumber": <number — which volume this chapter belongs to, 1 if single-volume>
    }
  ]
}

Rules:
- Extract EVERY chapter link in the table of contents, even if there are hundreds.
- For the shamelaUrl: if only a relative path like /book/123/4567 is given, prepend https://shamela.ws.
- If the book has no volumes, set volumes to [] and use volumeNumber: 1 for all chapters.
- If there are no chapters found, return { "volumes": [], "chapters": [] }.
- Return ONLY the JSON object, no markdown, no explanation.`;

function extractHashTags(text: string): string[] {
  const matches = text.match(/#([\p{L}\p{N}_][^\s#]*)/gu) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).trim()))];
}

async function attachTags(
  db: any,
  blogId: number,
  description: string,
): Promise<void> {
  const tagNames = extractHashTags(description);
  for (const title of tagNames) {
    const tag = await db.tags.upsert({
      where: { title },
      create: { title },
      update: {},
    });
    const existing = await db.blogTags.findFirst({
      where: { blogId, tagId: tag.id, deletedAt: null },
    });
    if (!existing) {
      await db.blogTags.create({ data: { blogId, tagId: tag.id } });
    }
  }
}

type AiProvider = "anthropic" | "openai" | "gemini";
type ImportAiModel = "gpt-5" | "gpt-4o" | "gemini";

interface AiResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

interface AiSourceContext {
  sourceUrl: string;
  requestedSourceUrl?: string;
}

function getProviderForImportModel(model: ImportAiModel): AiProvider {
  return model === "gemini" ? "gemini" : "openai";
}

type ParsedBookMeta = {
  nameAr: string;
  nameEn?: string | null;
  authorName?: string | null;
  authorNameEn?: string | null;
  authorUrl?: string | null;
  category?: string | null;
  categoryUrl?: string | null;
  shelfName?: string | null;
  coverColor?: string | null;
  description?: string | null;
};

type ParsedPageData = {
  shamelaPageNo: number;
  printedPageNo?: number | null;
  chapterTitle?: string | null;
  chapterUrl?: string | null;
  topicTitle?: string | null;
  topicUrl?: string | null;
  paragraphs?: {
    pid?: number;
    text?: string;
    footnoteIds?: string | null;
  }[];
  footnotes?: {
    marker?: string;
    type?: string | null;
    content?: string;
    linkedParagraphs?: string | null;
  }[];
};

type ParsedTocData = {
  volumes: { number: number; title: string | null }[];
  chapters: {
    shamelaPageNo: number;
    shamelaUrl: string;
    chapterTitle: string | null;
    topicTitle: string | null;
    volumeNumber: number;
  }[];
};

class AiProviderError extends Error {
  provider: AiProvider;
  status: number;
  retryAfterSeconds?: number;
  bodyPreview?: string;

  constructor(params: {
    provider: AiProvider;
    status: number;
    message: string;
    retryAfterSeconds?: number;
    bodyPreview?: string;
  }) {
    super(params.message);
    this.name = "AiProviderError";
    this.provider = params.provider;
    this.status = params.status;
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.bodyPreview = params.bodyPreview;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;

  const dateMs = new Date(value).getTime();
  if (Number.isNaN(dateMs)) return undefined;

  return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
}

function buildAiError(
  provider: AiProvider,
  status: number,
  bodyText: string,
  retryAfterSeconds?: number,
): AiProviderError {
  const bodyPreview = bodyText.trim().replace(/\s+/g, " ").slice(0, 240);
  const messageParts = [`${provider} API error: ${status}`];

  if (retryAfterSeconds && retryAfterSeconds > 0) {
    messageParts.push(`retry after ${retryAfterSeconds}s`);
  }

  if (bodyPreview) {
    messageParts.push(bodyPreview);
  }

  return new AiProviderError({
    provider,
    status,
    retryAfterSeconds,
    bodyPreview,
    message: messageParts.join(" - "),
  });
}

function isRetryableAiStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function getAiRetryDelayMs(error: AiProviderError, attempt: number): number {
  if (error.retryAfterSeconds && error.retryAfterSeconds > 0) {
    return error.retryAfterSeconds * 1000;
  }

  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

async function withAiRetries<T>(operation: () => Promise<T>): Promise<T> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw error;

      const shouldRetry =
        attempt < maxAttempts && isRetryableAiStatus(error.status);

      if (!shouldRetry) throw error;

      await sleep(getAiRetryDelayMs(error, attempt));
    }
  }

  throw new Error("AI request exhausted retries without a final error");
}

function rethrowAsTrpcError(error: unknown): never {
  if (error instanceof TRPCError) {
    throw error;
  }

  if (error instanceof AiProviderError) {
    if (error.status === 429) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `${error.provider} is rate-limited right now. Please try again shortly or switch AI providers.`,
      });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  throw error;
}

/**
 * Call an AI provider with either a raw URL (Anthropic fetches it natively)
 * or pre-fetched HTML for OpenAI/Gemini.
 */
async function callAI(
  provider: AiProvider,
  prompt: string,
  maxTokens: number,
  source?: string | AiSourceContext, // if provided, Anthropic uses URL natively; others also get fetched HTML
  options?: {
    openaiModel?: "gpt-5" | "gpt-4o";
  },
): Promise<AiResult> {
  try {
    return await withAiRetries(async () => {
      const sourceContext =
        typeof source === "string" ? { sourceUrl: source } : source;
      const sourceUrl = sourceContext?.sourceUrl;
      const requestedSourceUrl =
        sourceContext?.requestedSourceUrl?.trim() || sourceUrl;

      if (provider === "anthropic") {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

        const userContent: any[] = sourceUrl
          ? [
              // Let Claude fetch the URL directly — avoids server-side Shamela blocks
              { type: "document", source: { type: "url", url: sourceUrl } },
              requestedSourceUrl && requestedSourceUrl !== sourceUrl
                ? {
                    type: "text",
                    text: `The user originally provided this URL directly: ${requestedSourceUrl}`,
                  }
                : null,
              { type: "text", text: prompt },
            ].filter(Boolean)
          : [{ type: "text", text: prompt }];

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "url-context-1",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: maxTokens,
            messages: [{ role: "user", content: userContent }],
          }),
        });
        if (!res.ok) {
          throw buildAiError(
            provider,
            res.status,
            await res.text(),
            parseRetryAfterSeconds(res.headers.get("retry-after")),
          );
        }

        const data: any = await res.json();
        return {
          text: data.content?.[0]?.text ?? "",
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
          model: "claude-sonnet-4-6",
        };
      }

      // For OpenAI / Gemini: pass the URL directly and instruct the model to fetch it itself.
      const fullPrompt = sourceUrl
        ? `${prompt}

Fetch the user-provided Shamela link yourself before answering.
Use it as the primary source.
If the effective extraction URL differs, you may inspect that URL too.
Return only the requested JSON.

<REQUESTED_SOURCE_URL>${requestedSourceUrl}</REQUESTED_SOURCE_URL>
<SOURCE_URL>${sourceUrl}</SOURCE_URL>`
        : prompt;

      if (provider === "openai") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
        const openaiModel = options?.openaiModel ?? "gpt-5";
        const tokenConfig =
          openaiModel === "gpt-5"
            ? { max_completion_tokens: maxTokens }
            : { max_tokens: maxTokens };
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: openaiModel,
            ...tokenConfig,
            messages: [{ role: "user", content: fullPrompt }],
          }),
        });
        if (!res.ok) {
          throw buildAiError(
            provider,
            res.status,
            await res.text(),
            parseRetryAfterSeconds(res.headers.get("retry-after")),
          );
        }

        const data: any = await res.json();
        return {
          text: data.choices?.[0]?.message?.content ?? "",
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          model: openaiModel,
        };
      }

      if (provider === "gemini") {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: { maxOutputTokens: maxTokens },
            }),
          },
        );
        if (!res.ok) {
          console.log("Gemini API error details:", {
            status: res.status,
            headers: Object.fromEntries(res.headers.entries()),
            texts: await res.text(),
          });
          throw buildAiError(
            provider,
            res.status,
            await res.text(),
            parseRetryAfterSeconds(res.headers.get("retry-after")),
          );
        }

        const data: any = await res.json();
        const meta = data.usageMetadata ?? {};
        return {
          text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
          inputTokens: meta.promptTokenCount ?? 0,
          outputTokens: meta.candidatesTokenCount ?? 0,
          model: "gemini-2.0-flash",
        };
      }

      throw new Error(`Unknown AI provider: ${provider}`);
    });
  } catch (error) {
    rethrowAsTrpcError(error);
  }
}

async function recordTokenUsage(
  db: any,
  result: AiResult,
  provider: AiProvider,
  operation: string,
  bookId?: number,
  pageId?: number,
) {
  try {
    await db.aiTokenUsage.create({
      data: {
        provider,
        model: result.model,
        operation,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        bookId: bookId ?? null,
        pageId: pageId ?? null,
      },
    });
  } catch {
    // Non-fatal — never block the main flow
  }
}

async function syncToc(
  db: any,
  bookId: number,
  bookUrl: string,
  provider: AiProvider,
  aiModel?: ImportAiModel,
): Promise<number> {
  let result: AiResult;
  try {
    result = await callAI(provider, SHAMELA_TOC_EXTRACT_PROMPT, 8192, bookUrl, {
      openaiModel: aiModel === "gemini" ? undefined : aiModel,
    });
    await recordTokenUsage(db, result, provider, "toc_extract", bookId);
  } catch {
    return 0;
  }
  let toc: {
    volumes: { number: number; title: string | null }[];
    chapters: {
      shamelaPageNo: number;
      shamelaUrl: string;
      chapterTitle: string | null;
      topicTitle: string | null;
      volumeNumber: number;
    }[];
  };
  try {
    toc = parseAiJson<typeof toc>(result.text);
  } catch {
    return 0;
  }

  if (!toc.chapters || toc.chapters.length === 0) return 0;

  // ── Upsert volumes ─────────────────────────────────────────────────────────
  const volumeIdMap = new Map<number, number>();
  for (const vol of toc.volumes ?? []) {
    const volume = await db.bookVolume.upsert({
      where: { bookId_number: { bookId, number: vol.number } },
      create: { bookId, number: vol.number, title: vol.title ?? undefined },
      update: { title: vol.title ?? undefined },
    });
    volumeIdMap.set(vol.number, volume.id);
  }

  // ── Bulk-insert chapter stubs (skip existing) ──────────────────────────────
  const results = await db.bookPage.createMany({
    skipDuplicates: true,
    data: toc.chapters.map((ch) => ({
      bookId,
      shamelaPageNo: ch.shamelaPageNo,
      shamelaUrl: ch.shamelaUrl,
      chapterTitle: ch.chapterTitle ?? null,
      topicTitle: ch.topicTitle ?? null,
      volumeId: volumeIdMap.get(ch.volumeNumber) ?? null,
      status: "pending",
    })),
  });

  return results.count;
}

function getDefaultBookUserId(): number {
  return 1;
}

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStoredContentMeta(rawJson: unknown) {
  if (!isRecord(rawJson)) {
    return {
      contentDocument: null,
      contentHtml: null,
      contentPlainText: null,
      contentVersion: 0,
      contentUpdatedAt: null as string | null,
    };
  }

  return {
    contentDocument: rawJson.contentDocument ?? null,
    contentHtml:
      typeof rawJson.contentHtml === "string" ? rawJson.contentHtml : null,
    contentPlainText:
      typeof rawJson.contentPlainText === "string" ? rawJson.contentPlainText : null,
    contentVersion:
      typeof rawJson.contentVersion === "number" ? rawJson.contentVersion : 0,
    contentUpdatedAt:
      typeof rawJson.contentUpdatedAt === "string" ? rawJson.contentUpdatedAt : null,
  };
}

function buildPageDocument(page: {
  rawJson?: unknown;
  paragraphs: { id: number; text: string }[];
}) {
  const stored = getStoredContentMeta(page.rawJson);
  const fallbackDocument = createBookDocumentFromParagraphs(
    page.paragraphs.map((paragraph) => ({
      id: paragraph.id,
      text: paragraph.text,
    })),
  );
  const document = stored.contentDocument ?? fallbackDocument;
  const contentHtml = stored.contentHtml ?? serializeDocumentToHtml(document as Parameters<typeof serializeDocumentToHtml>[0]);
  const plainText =
    stored.contentPlainText ??
    getDocumentPlainText(document as Parameters<typeof getDocumentPlainText>[0]);

  return {
    document,
    contentHtml,
    plainText,
    contentVersion: stored.contentVersion,
    contentUpdatedAt: stored.contentUpdatedAt,
  };
}

function normalizeSourceUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim());
  url.search = "";
  url.hash = "";
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

function buildShamelaPageUrl(baseUrl: string, shamelaPageNo: number): string {
  const normalizedUrl = normalizeSourceUrl(baseUrl);
  const match = normalizedUrl.match(/^(https?:\/\/[^/]+\/book\/\d+)(?:\/\d+)?$/);
  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Shamela book URL for page navigation.",
    });
  }

  return `${match[1]}/${shamelaPageNo}`;
}

function getShamelaPageNoFromUrl(rawUrl: string): number | null {
  try {
    const normalizedUrl = normalizeSourceUrl(rawUrl);
    const match = normalizedUrl.match(/\/book\/\d+\/(\d+)$/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function slugTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function getRepoRoot() {
  return process.cwd();
}

async function dumpShamelaRawArtifact(input: {
  requestedUrl: string;
  finalUrl: string;
  title?: string | null;
  html: string;
  shamelaPageNo?: number | null;
  rawPageId: number;
}) {
  const rootDir = path.join(getRepoRoot(), "shamela-raw", "pages");
  await mkdir(rootDir, { recursive: true });

  const pageSegment = input.shamelaPageNo ? `page-${input.shamelaPageNo}` : "page-unknown";
  const fileBase = `${pageSegment}-raw-${input.rawPageId}-${slugTimestamp()}`;
  const htmlPath = path.join(rootDir, `${fileBase}.html`);
  const jsonPath = path.join(rootDir, `${fileBase}.json`);

  await writeFile(htmlPath, input.html, "utf8");
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        requestedUrl: input.requestedUrl,
        finalUrl: input.finalUrl,
        title: input.title ?? null,
        shamelaPageNo: input.shamelaPageNo ?? null,
        rawPageId: input.rawPageId,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    htmlPath,
    jsonPath,
  };
}

async function resolveBookLinkGraphStatus(
  db: any,
  input: {
    explicitBookId?: number | null;
    shamelaBookId: number | null;
    currentTopicHref: string | null;
    volumeNumber: number | null;
  },
) {
  const book = input.explicitBookId
    ? await db.book.findFirst({
        where: { id: input.explicitBookId, deletedAt: null },
        select: { id: true },
      })
    : input.shamelaBookId
      ? await db.book.findFirst({
          where: { shamelaId: input.shamelaBookId, deletedAt: null },
          select: { id: true },
        })
      : null;

  const matchedBookId = book?.id ?? null;
  const volume = matchedBookId && input.volumeNumber != null
    ? await db.bookVolume.findFirst({
        where: {
          bookId: matchedBookId,
          number: input.volumeNumber,
          deletedAt: null,
        },
        select: { id: true },
      })
    : null;

  const topicPage = matchedBookId && input.currentTopicHref
    ? await db.bookPage.findFirst({
        where: {
          bookId: matchedBookId,
          shamelaUrl: input.currentTopicHref,
          deletedAt: null,
        },
        select: { id: true },
      })
    : null;

  const currentTopicExists = Boolean(topicPage);
  const knownTopicGraph = Boolean(matchedBookId && currentTopicExists);

  return {
    bookExists: Boolean(matchedBookId),
    volumeExists: Boolean(volume),
    currentTopicExists,
    knownTopicGraph,
    shouldRefetchTopics: false,
    matchedBookId,
    matchedVolumeId: volume?.id ?? null,
    matchedTopicPageId: topicPage?.id ?? null,
  };
}

function getBookImportHistoryKey(entry: {
  normalizedUrl?: string | null;
  sourceUrl: string;
}): string {
  if (entry.normalizedUrl?.trim()) {
    return entry.normalizedUrl.trim();
  }

  try {
    return normalizeSourceUrl(entry.sourceUrl);
  } catch {
    return entry.sourceUrl.trim();
  }
}

function toErrorLogPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { error };
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return trimmed;
  }

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

function parseAiJson<T>(text: string): T {
  return JSON.parse(extractJsonPayload(text)) as T;
}

function buildAiParseFailureMessage(stage: string, text: string): string {
  return [
    `Failed to parse AI response for ${stage}.`,
    "AI response JSON:",
    text,
  ].join("\n\n");
}

function getShamelaBookInfo(rawUrl: string): {
  normalizedUrl: string;
  shamelaId: number;
  bookIndexUrl: string;
  linkedPageUrl: string | null;
} {
  const normalizedUrl = normalizeSourceUrl(rawUrl);
  const parsedUrl = new URL(rawUrl.trim());
  const match = normalizedUrl.match(/\/book\/(\d+)/);
  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Shamela URL — expected a /book/... path",
    });
  }

  const shamelaId = Number(match[1]);
  const bookIndexUrl = `${new URL(normalizedUrl).origin}/book/${shamelaId}`;
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  const linkedPageUrl =
    pathSegments[0] === "book" &&
    pathSegments[1] === String(shamelaId) &&
    pathSegments[2]
      ? normalizeSourceUrl(`${parsedUrl.origin}/${pathSegments.slice(0, 3).join("/")}`)
      : null;

  return { normalizedUrl, shamelaId, bookIndexUrl, linkedPageUrl };
}

function parseBookMeta(text: string): ParsedBookMeta {
  try {
    return parseAiJson<ParsedBookMeta>(text);
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: buildAiParseFailureMessage("book metadata", text),
    });
  }
}

function sanitizePageData(parsed: ParsedPageData): ParsedPageData {
  return {
    shamelaPageNo: Number(parsed.shamelaPageNo),
    printedPageNo:
      typeof parsed.printedPageNo === "number" ? parsed.printedPageNo : null,
    chapterTitle: safeString(parsed.chapterTitle),
    chapterUrl: safeString(parsed.chapterUrl),
    topicTitle: safeString(parsed.topicTitle),
    topicUrl: safeString(parsed.topicUrl),
    paragraphs: (parsed.paragraphs ?? [])
      .map((paragraph, index) => ({
        pid:
          typeof paragraph?.pid === "number" && Number.isFinite(paragraph.pid)
            ? paragraph.pid
            : index + 1,
        text: safeString(paragraph?.text) ?? "",
        footnoteIds: safeString(paragraph?.footnoteIds),
      }))
      .filter((paragraph) => paragraph.text.length > 0),
    footnotes: (parsed.footnotes ?? [])
      .map((footnote) => ({
        marker: safeString(footnote?.marker) ?? "",
        type: safeString(footnote?.type),
        content: safeString(footnote?.content) ?? "",
        linkedParagraphs: safeString(footnote?.linkedParagraphs),
      }))
      .filter((footnote) => footnote.marker.length > 0 && footnote.content.length > 0),
  };
}

function parsePageData(text: string): ParsedPageData {
  try {
    return sanitizePageData(parseAiJson<ParsedPageData>(text));
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: buildAiParseFailureMessage("book page", text),
    });
  }
}

function parseTocData(text: string): ParsedTocData {
  try {
    return parseAiJson<ParsedTocData>(text);
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: buildAiParseFailureMessage("table of contents", text),
    });
  }
}

async function createBookImportHistory(
  db: any,
  input: { bookId?: number | null; sourceUrl: string; normalizedUrl?: string | null; provider?: string | null; importMode?: string },
) {
  return db.bookImportHistory.create({
    data: {
      bookId: input.bookId ?? null,
      sourceUrl: input.sourceUrl,
      normalizedUrl: input.normalizedUrl ?? null,
      provider: input.provider ?? null,
      importMode: input.importMode ?? "link",
      status: "pending",
      startedAt: new Date(),
    },
  });
}

async function completeBookImportHistory(
  db: any,
  historyId: number,
  input: {
    status: "success" | "failed";
    bookId?: number | null;
    createdBookId?: number | null;
    chaptersImported?: number;
    metadataJson?: any;
    errorMessage?: string | null;
  },
) {
  return db.bookImportHistory.update({
    where: { id: historyId },
    data: {
      bookId: input.bookId ?? undefined,
      createdBookId: input.createdBookId ?? undefined,
      chaptersImported: input.chaptersImported ?? 0,
      metadataJson: input.metadataJson ?? undefined,
      errorMessage: input.errorMessage ?? null,
      status: input.status,
      finishedAt: new Date(),
    },
  });
}

async function createBookPageImportHistory(
  db: any,
  input: {
    bookId: number;
    pageId?: number | null;
    sourceUrl?: string | null;
    provider?: string | null;
    importMethod: string;
    rawInput?: string | null;
  },
) {
  return db.bookPageImportHistory.create({
    data: {
      bookId: input.bookId,
      pageId: input.pageId ?? null,
      sourceUrl: input.sourceUrl ?? null,
      provider: input.provider ?? null,
      importMethod: input.importMethod,
      rawInput: input.rawInput ?? null,
      status: "pending",
      startedAt: new Date(),
    },
  });
}

async function completeBookPageImportHistory(
  db: any,
  historyId: number,
  input: {
    status: "success" | "failed";
    pageId?: number | null;
    shamelaPageNo?: number | null;
    printedPageNo?: number | null;
    paragraphCount?: number;
    footnoteCount?: number;
    chapterTitle?: string | null;
    topicTitle?: string | null;
    diffSummaryJson?: any;
    errorMessage?: string | null;
  },
) {
  return db.bookPageImportHistory.update({
    where: { id: historyId },
    data: {
      pageId: input.pageId ?? undefined,
      shamelaPageNo: input.shamelaPageNo ?? undefined,
      printedPageNo: input.printedPageNo ?? undefined,
      paragraphCount: input.paragraphCount ?? 0,
      footnoteCount: input.footnoteCount ?? 0,
      chapterTitle: input.chapterTitle ?? undefined,
      topicTitle: input.topicTitle ?? undefined,
      diffSummaryJson: input.diffSummaryJson ?? undefined,
      errorMessage: input.errorMessage ?? null,
      status: input.status,
      finishedAt: new Date(),
    },
  });
}

async function upsertShelfAndAuthor(
  db: any,
  meta: ParsedBookMeta,
): Promise<{ shelfId?: number; authorId?: number }> {
  let shelfId: number | undefined;
  if (meta.shelfName) {
    const shelf = await db.bookShelf.upsert({
      where: { name: meta.shelfName } as any,
      create: { name: meta.shelfName, nameAr: meta.shelfName },
      update: {},
    });
    shelfId = shelf.id;
  }

  let authorId: number | undefined;
  if (meta.authorName) {
    const author = await db.bookAuthor.upsert({
      where: { name: meta.authorName },
      create: {
        name: meta.authorName,
        nameAr: meta.authorName,
        url: meta.authorUrl ?? undefined,
      },
      update: { url: meta.authorUrl ?? undefined },
    });
    authorId = author.id;
  }

  return { shelfId, authorId };
}

async function rebindPageAnnotations(
  db: any,
  pageId: number,
  previousParagraphs: { id: number; pid: number; text: string }[],
  nextParagraphs: { id: number; pid: number; text: string }[],
) {
  const nextByPid = new Map(nextParagraphs.map((paragraph) => [paragraph.pid, paragraph]));
  const nextByText = new Map(nextParagraphs.map((paragraph) => [paragraph.text.trim(), paragraph]));
  const previousById = new Map(previousParagraphs.map((paragraph) => [paragraph.id, paragraph]));

  const rebindParagraph = (paragraphId: number | null | undefined, paragraphPid: number | null | undefined, quoteText: string | null | undefined) => {
    if (paragraphPid != null && nextByPid.has(paragraphPid)) {
      return nextByPid.get(paragraphPid) ?? null;
    }

    if (paragraphId != null) {
      const previous = previousById.get(paragraphId);
      if (previous && nextByPid.has(previous.pid)) {
        return nextByPid.get(previous.pid) ?? null;
      }
      if (previous && nextByText.has(previous.text.trim())) {
        return nextByText.get(previous.text.trim()) ?? null;
      }
    }

    if (quoteText && nextByText.has(quoteText.trim())) {
      return nextByText.get(quoteText.trim()) ?? null;
    }

    return null;
  };

  const highlights = await db.bookPageHighlight.findMany({ where: { pageId } });
  for (const highlight of highlights) {
    const targetParagraph = rebindParagraph(
      highlight.paragraphId,
      highlight.paragraphPid,
      highlight.quoteText,
    );
    await db.bookPageHighlight.update({
      where: { id: highlight.id },
      data: {
        paragraphId: targetParagraph?.id ?? null,
        paragraphPid: targetParagraph?.pid ?? highlight.paragraphPid ?? null,
        quoteText: targetParagraph?.text ?? highlight.quoteText ?? null,
        pageShamelaPageNo: highlight.pageShamelaPageNo ?? undefined,
      },
    });
  }

  const comments = await db.bookPageComment.findMany({
    where: { pageId, deletedAt: null },
  });
  for (const comment of comments) {
    const targetParagraph = rebindParagraph(
      comment.paragraphId,
      comment.paragraphPid,
      comment.quoteText,
    );
    await db.bookPageComment.update({
      where: { id: comment.id },
      data: {
        paragraphId: targetParagraph?.id ?? null,
        paragraphPid: targetParagraph?.pid ?? comment.paragraphPid ?? null,
        quoteText: targetParagraph?.text ?? comment.quoteText ?? null,
        pageShamelaPageNo: comment.pageShamelaPageNo ?? undefined,
      },
    });
  }
}

async function saveParsedPageData(
  db: any,
  input: {
    bookId: number;
    pageData: ParsedPageData;
    sourceUrl?: string | null;
    volumeId?: number | null;
    importMethod: string;
    provider?: string | null;
    rawInput?: string | null;
  },
) {
  const resolvedShamelaPageNo =
    input.sourceUrl != null
      ? getShamelaPageNoFromUrl(input.sourceUrl) ?? input.pageData.shamelaPageNo
      : input.pageData.shamelaPageNo;
  const pageData = {
    ...input.pageData,
    shamelaPageNo: resolvedShamelaPageNo,
  };
  const existingPage = await db.bookPage.findFirst({
    where: {
      bookId: input.bookId,
      shamelaPageNo: resolvedShamelaPageNo,
    },
    include: {
      paragraphs: {
        select: { id: true, pid: true, text: true },
        orderBy: { pid: "asc" },
      },
    },
  });

  const history = await createBookPageImportHistory(db, {
    bookId: input.bookId,
    pageId: existingPage?.id ?? null,
    sourceUrl: input.sourceUrl ?? null,
    provider: input.provider ?? null,
    importMethod: input.importMethod,
    rawInput: input.rawInput ?? null,
  });

  try {
    const page = await db.bookPage.upsert({
      where: {
        bookId_shamelaPageNo: {
          bookId: input.bookId,
          shamelaPageNo: resolvedShamelaPageNo,
        },
      },
      create: {
        bookId: input.bookId,
        volumeId: input.volumeId ?? null,
        shamelaPageNo: resolvedShamelaPageNo,
        shamelaUrl: input.sourceUrl ?? "",
        printedPageNo: pageData.printedPageNo ?? null,
        chapterTitle: pageData.chapterTitle ?? null,
        chapterUrl: pageData.chapterUrl ?? null,
        topicTitle: pageData.topicTitle ?? null,
        topicUrl: pageData.topicUrl ?? null,
        rawJson: pageData,
        status: "fetched",
      },
      update: {
        volumeId: input.volumeId ?? undefined,
        shamelaUrl: input.sourceUrl ?? existingPage?.shamelaUrl ?? "",
        printedPageNo: pageData.printedPageNo ?? null,
        chapterTitle: pageData.chapterTitle ?? null,
        chapterUrl: pageData.chapterUrl ?? null,
        topicTitle: pageData.topicTitle ?? null,
        topicUrl: pageData.topicUrl ?? null,
        rawJson: pageData,
        status: "fetched",
        deletedAt: null,
      },
      include: {
        paragraphs: {
          select: { id: true, pid: true, text: true },
          orderBy: { pid: "asc" },
        },
      },
    });

    const previousParagraphs = existingPage?.paragraphs ?? [];

    await db.bookPageParagraph.deleteMany({ where: { pageId: page.id } });
    if ((pageData.paragraphs ?? []).length > 0) {
      await db.bookPageParagraph.createMany({
        data: (pageData.paragraphs ?? []).map((paragraph) => ({
          pageId: page.id,
          pid: paragraph.pid!,
          text: paragraph.text!,
          footnoteIds: paragraph.footnoteIds ?? null,
        })),
      });
    }

    await db.bookPageFootnote.deleteMany({ where: { pageId: page.id } });
    if ((pageData.footnotes ?? []).length > 0) {
      await db.bookPageFootnote.createMany({
        data: (pageData.footnotes ?? []).map((footnote) => ({
          pageId: page.id,
          marker: footnote.marker!,
          type: footnote.type ?? null,
          content: footnote.content!,
          linkedParagraphs: footnote.linkedParagraphs ?? null,
        })),
      });
    }

    const nextParagraphs = await db.bookPageParagraph.findMany({
      where: { pageId: page.id },
      select: { id: true, pid: true, text: true },
      orderBy: { pid: "asc" },
    });

    await rebindPageAnnotations(db, page.id, previousParagraphs, nextParagraphs);

    await db.book.update({
      where: { id: input.bookId },
      data: {
        contentHash: `${input.bookId}-${Date.now()}`,
        pagesUpdatedAt: new Date(),
      },
    });

    const diffSummaryJson = {
      previousParagraphCount: previousParagraphs.length,
      nextParagraphCount: nextParagraphs.length,
      preservedPageId: existingPage?.id === page.id,
      remappedByPidCount: nextParagraphs.filter((paragraph) =>
        previousParagraphs.some((previous) => previous.pid === paragraph.pid),
      ).length,
    };

    await completeBookPageImportHistory(db, history.id, {
      status: "success",
      pageId: page.id,
      shamelaPageNo: page.shamelaPageNo,
      printedPageNo: page.printedPageNo,
      paragraphCount: nextParagraphs.length,
      footnoteCount: (pageData.footnotes ?? []).length,
      chapterTitle: page.chapterTitle,
      topicTitle: page.topicTitle,
      diffSummaryJson,
    });

    return { page, historyId: history.id, diffSummaryJson };
  } catch (error) {
    await completeBookPageImportHistory(db, history.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Page import failed",
    });
    throw error;
  }
}

async function syncBookFromShamelaInternal(
  db: any,
  input: { shamelaUrl: string; aiProvider: AiProvider; aiModel?: ImportAiModel },
) {
  const { normalizedUrl, shamelaId, bookIndexUrl, linkedPageUrl } = getShamelaBookInfo(
    input.shamelaUrl,
  );

  const existing = await db.book.findFirst({
    where: { shamelaId, deletedAt: null },
    include: {
      blog: { select: { id: true } },
      authors: true,
      shelf: true,
    },
  });

  const history = await createBookImportHistory(db, {
    bookId: existing?.id ?? null,
    sourceUrl: input.shamelaUrl,
    normalizedUrl,
    provider: input.aiProvider,
    importMode: existing ? "reimport" : "link",
  });

  try {
    const metaResult = await callAI(
      input.aiProvider,
      SHAMELA_BOOK_META_PROMPT,
      1024,
      {
        sourceUrl: bookIndexUrl,
        requestedSourceUrl: input.shamelaUrl,
      },
      { openaiModel: input.aiModel === "gemini" ? undefined : input.aiModel },
    );

    const meta = parseBookMeta(metaResult.text);
    const { shelfId, authorId } = await upsertShelfAndAuthor(db, meta);

    let book: any;
    let created = false;

    if (existing) {
      await db.blog.update({
        where: { id: existing.blog.id },
        data: {
          content: meta.description ?? existing.blog.id.toString(),
        },
      });

      book = await db.book.update({
        where: { id: existing.id },
        data: {
          nameAr: meta.nameAr,
          nameEn: meta.nameEn ?? undefined,
          category: meta.category ?? undefined,
          categoryUrl: meta.categoryUrl ?? undefined,
          coverColor: meta.coverColor ?? undefined,
          shelfId: shelfId ?? undefined,
          shamelaUrl: bookIndexUrl,
          ...(authorId ? { authors: { set: [{ id: authorId }] } } : {}),
        },
        include: { authors: true, shelf: true },
      });

      if (meta.description) {
        await attachTags(db, existing.blog.id, meta.description);
      }
    } else {
      created = true;
      const blog = await db.blog.create({
        data: {
          type: "book",
          content: meta.description ?? meta.nameAr,
          published: true,
          status: "published",
        },
      });

      book = await db.book.create({
        data: {
          blogId: blog.id,
          nameAr: meta.nameAr,
          nameEn: meta.nameEn ?? undefined,
          shamelaId,
          shamelaUrl: bookIndexUrl,
          category: meta.category ?? undefined,
          categoryUrl: meta.categoryUrl ?? undefined,
          coverColor: meta.coverColor ?? undefined,
          shelfId,
          ...(authorId ? { authors: { connect: { id: authorId } } } : {}),
        },
        include: { authors: true, shelf: true },
      });

      if (meta.description) {
        await attachTags(db, blog.id, meta.description);
      }
    }

    await recordTokenUsage(
      db,
      metaResult,
      input.aiProvider,
      "book_meta_sync",
      book.id,
    );

    const chaptersImported = await syncToc(
      db,
      book.id,
      bookIndexUrl,
      input.aiProvider,
      input.aiModel,
    );

    let importedPage: {
      id: number;
      shamelaPageNo: number;
      printedPageNo: number | null;
      chapterTitle: string | null;
      topicTitle: string | null;
      importHistoryId: number;
    } | null = null;

    if (linkedPageUrl) {
      const pageAiResult = await callAI(
        input.aiProvider,
        SHAMELA_EXTRACT_PROMPT,
        4096,
        {
          sourceUrl: linkedPageUrl,
          requestedSourceUrl: input.shamelaUrl,
        },
        { openaiModel: input.aiModel === "gemini" ? undefined : input.aiModel },
      );
      const pageData = parsePageData(pageAiResult.text);
      const {
        page,
        historyId: pageImportHistoryId,
      } = await saveParsedPageData(db, {
        bookId: book.id,
        pageData,
        sourceUrl: linkedPageUrl,
        importMethod: existing ? "reimport_url" : "link_url",
        provider: input.aiProvider,
      });

      await recordTokenUsage(
        db,
        pageAiResult,
        input.aiProvider,
        "book_linked_page_import",
        book.id,
        page.id,
      );

      importedPage = {
        id: page.id,
        shamelaPageNo: page.shamelaPageNo,
        printedPageNo: page.printedPageNo ?? null,
        chapterTitle: page.chapterTitle ?? null,
        topicTitle: page.topicTitle ?? null,
        importHistoryId: pageImportHistoryId,
      };
    }

    await completeBookImportHistory(db, history.id, {
      status: "success",
      bookId: book.id,
      createdBookId: created ? book.id : null,
      chaptersImported,
      metadataJson: meta,
    });

    return {
      book,
      created,
      chaptersImported,
      historyId: history.id,
      importedPage,
    };
  } catch (error) {
    console.error("syncBookFromShamela failed", {
      shamelaUrl: input.shamelaUrl,
      normalizedUrl,
      shamelaId,
      bookIndexUrl,
      linkedPageUrl,
      aiProvider: input.aiProvider,
      existingBookId: existing?.id ?? null,
      historyId: history.id,
      ...toErrorLogPayload(error),
    });
    await completeBookImportHistory(db, history.id, {
      status: "failed",
      bookId: existing?.id ?? null,
      errorMessage:
        error instanceof Error ? error.message : "Book import failed",
    });
    throw error;
  }
}

export async function previewBookImportFromShamelaInternal(
  input: { shamelaUrl: string; aiProvider: AiProvider; aiModel?: ImportAiModel },
) {
  const { normalizedUrl, shamelaId, bookIndexUrl, linkedPageUrl } = getShamelaBookInfo(
    input.shamelaUrl,
  );

    const metaResult = await callAI(
      input.aiProvider,
      SHAMELA_BOOK_META_PROMPT,
      1024,
      {
        sourceUrl: bookIndexUrl,
        requestedSourceUrl: input.shamelaUrl,
      },
      { openaiModel: input.aiModel === "gemini" ? undefined : input.aiModel },
    );
  const meta = parseBookMeta(metaResult.text);

  let toc: ParsedTocData = { volumes: [], chapters: [] };
  try {
    const tocResult = await callAI(
      input.aiProvider,
      SHAMELA_TOC_EXTRACT_PROMPT,
      8192,
      {
        sourceUrl: bookIndexUrl,
        requestedSourceUrl: input.shamelaUrl,
      },
      { openaiModel: input.aiModel === "gemini" ? undefined : input.aiModel },
    );
    toc = parseTocData(tocResult.text);
  } catch (error) {
    console.warn("previewBookImportFromShamela toc preview failed", {
      shamelaUrl: input.shamelaUrl,
      aiProvider: input.aiProvider,
      ...toErrorLogPayload(error),
    });
  }

  let linkedPageData: ParsedPageData | null = null;
  if (linkedPageUrl) {
    const pageResult = await callAI(
      input.aiProvider,
      SHAMELA_EXTRACT_PROMPT,
      4096,
      {
        sourceUrl: linkedPageUrl,
        requestedSourceUrl: input.shamelaUrl,
      },
      { openaiModel: input.aiModel === "gemini" ? undefined : input.aiModel },
    );
    const parsedPageData = parsePageData(pageResult.text);
    linkedPageData = {
      ...parsedPageData,
      shamelaPageNo:
        getShamelaPageNoFromUrl(linkedPageUrl) ?? parsedPageData.shamelaPageNo,
    };
  }

  return {
    sourceUrl: input.shamelaUrl,
    normalizedUrl,
    shamelaId,
    bookIndexUrl,
    linkedPageUrl,
    aiProvider: input.aiProvider,
    aiModel: input.aiModel ?? (input.aiProvider === "gemini" ? "gemini" : "gpt-5"),
    previewJson: {
      metadata: meta,
      toc: {
        volumes: toc.volumes,
        chapterCount: toc.chapters.length,
        chapters: toc.chapters.slice(0, 20),
        truncated: toc.chapters.length > 20,
      },
      linkedPage: linkedPageData,
    },
  };
}

async function captureAndStageShamelaPageInternal(
  db: any,
  input: {
    requestedUrl: string;
    finalUrl: string;
    title?: string | null;
    html: string;
    source: string;
    bookId?: number | null;
  },
) {
  const normalizedUrl = (() => {
    try {
      return normalizeSourceUrl(input.finalUrl || input.requestedUrl);
    } catch {
      return input.finalUrl || input.requestedUrl;
    }
  })();

  const shamelaPageNo =
    getShamelaPageNoFromUrl(input.finalUrl) ??
    getShamelaPageNoFromUrl(input.requestedUrl);
  const htmlHash = createHash("sha256").update(input.html).digest("hex");

  const artifactPaths = await dumpShamelaRawArtifact({
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    title: input.title ?? null,
    html: input.html,
    shamelaPageNo,
    rawPageId: 0,
  });

  const parsed = parseShamelaOpenPage({
    html: input.html,
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    title: input.title ?? null,
    capturedAt: new Date().toISOString(),
    htmlHash,
  });

  const linkGraph = await resolveBookLinkGraphStatus(db, {
    explicitBookId: input.bookId ?? null,
    shamelaBookId: parsed.document.meta.shamelaBookId,
    currentTopicHref: parsed.document.context.currentTopic?.href ?? null,
    volumeNumber: parsed.document.meta.volumeNumber,
  });

  let rawPageId: number | null = null;
  let stagedParseId: number | null = null;
  const dbWarnings: string[] = [];

  try {
    const rawPage = await db.shamelaRawPage.create({
      data: {
        bookId: input.bookId ?? null,
        requestedUrl: input.requestedUrl,
        finalUrl: input.finalUrl,
        normalizedUrl,
        title: input.title ?? null,
        html: input.html,
        htmlHash,
        source: input.source,
        captureStatus: "captured",
        shamelaPageNo: shamelaPageNo ?? null,
        metadataJson: {
          htmlLength: input.html.length,
          artifactPaths,
        },
      },
    });
    rawPageId = rawPage.id;
  } catch (error) {
    dbWarnings.push(
      `raw-page-db-save-failed:${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  const preview = {
    id: 0,
    rawPageId,
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    title: input.title ?? null,
    document: {
      ...parsed.document,
      diagnostics: [...parsed.document.diagnostics, ...dbWarnings],
    },
    diagnostics: [...parsed.diagnostics, ...dbWarnings],
    linkGraph,
    artifactPaths,
  };

  if (rawPageId != null) {
    try {
      const staged = await db.shamelaStagedPageParse.create({
        data: {
          rawPageId,
          bookId: input.bookId ?? null,
          status: "parsed",
          parserVersion: "shamela-parser-v1",
          shamelaPageNo:
            parsed.document.meta.shamelaPageNo ?? shamelaPageNo ?? null,
          printedPageNo: parsed.document.meta.printedPageNo,
          volumeNumber: parsed.document.meta.volumeNumber,
          chapterTitle:
            parsed.document.content.find((block) => block.type === "heading")
              ?.text ?? parsed.document.context.currentTopic?.label ?? null,
          chapterUrl: parsed.document.context.currentTopic?.href ?? input.finalUrl,
          topicTitle: parsed.document.context.currentTopic?.label ?? null,
          topicUrl: parsed.document.context.currentTopic?.href ?? null,
          paragraphsJson: parsed.document.content.filter(
            (block) => block.type === "paragraph",
          ),
          footnotesJson: parsed.document.content.filter(
            (block) => block.type === "footnote",
          ),
          factsJson: parsed.facts,
          documentJson: parsed.document,
          diagnosticsJson: {
            diagnostics: preview.diagnostics,
            artifactPaths,
          },
          renderModelJson: parsed.renderModel,
          linkGraphJson: linkGraph,
        },
      });
      stagedParseId = staged.id;
    } catch (error) {
      preview.diagnostics.push(
        `staged-parse-db-save-failed:${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  } else {
    preview.diagnostics.push("staged-parse-skipped-no-raw-page-id");
  }

  return {
    rawPageId,
    stagedParseId,
    preview: {
      ...preview,
      id: stagedParseId ?? 0,
    },
  };
}

export const bookRoutes = createTRPCRouter({
  // ── Shelves ─────────────────────────────────────────────────────────────────

  getShelves: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.bookShelf.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  createShelf: publicProcedure
    .input(z.object({ name: z.string().min(1), nameAr: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bookShelf.create({ data: input });
    }),

  // ── Authors ──────────────────────────────────────────────────────────────────

  getAuthors: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.bookAuthor.findMany({ orderBy: { name: "asc" } });
  }),

  createAuthor: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        nameAr: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bookAuthor.create({ data: input });
    }),

  // ── Books ────────────────────────────────────────────────────────────────────

  getBooks: publicProcedure
    .input(
      z.object({
        shelfId: z.number().optional(),
        cursor: z.number().optional(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const books = await db.book.findMany({
        where: {
          deletedAt: null,
          ...(input.shelfId ? { shelfId: input.shelfId } : {}),
          ...(input.cursor ? { id: { lt: input.cursor } } : {}),
        },
        take: input.limit + 1,
        orderBy: { id: "desc" },
        include: {
          blog: {
            select: {
              id: true,
              content: true,
              blogDate: true,
              blogTags: { include: { tags: true } },
            },
          },
          shelf: true,
          authors: true,
          pages: {
            where: { status: "fetched" },
            orderBy: { shamelaPageNo: "asc" },
            take: 1,
            select: {
              id: true,
              shamelaPageNo: true,
            },
          },
        },
      });

      const hasMore = books.length > input.limit;
      const data = hasMore ? books.slice(0, -1) : books;
      return {
        data,
        nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
      };
    }),

  getBook: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.book.findFirstOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          blog: {
            select: {
              id: true,
              content: true,
              blogDate: true,
              blogTags: { include: { tags: true } },
            },
          },
          shelf: true,
          authors: true,
          volumes: { orderBy: { number: "asc" } },
          pages: {
            orderBy: { shamelaPageNo: "asc" },
            select: {
              id: true,
              shamelaPageNo: true,
              shamelaUrl: true,
              printedPageNo: true,
              chapterTitle: true,
              topicTitle: true,
              status: true,
              volumeId: true,
            },
          },
        },
      });
    }),

  createBook: publicProcedure
    .input(
      z.object({
        nameAr: z.string().min(1),
        nameEn: z.string().optional(),
        description: z.string().optional(),
        shelfId: z.number().optional(),
        shamelaUrl: z.string().optional(),
        shamelaId: z.number().optional(),
        authorName: z.string().optional(),
        authorUrl: z.string().optional(),
        coverUrl: z.string().optional(),
        coverColor: z.string().optional(),
        category: z.string().optional(),
        categoryUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const blog = await db.blog.create({
        data: {
          type: "book",
          content: input.description ?? input.nameAr,
          published: true,
          status: "published",
        },
      });

      const book = await db.book.create({
        data: {
          blogId: blog.id,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          shelfId: input.shelfId,
          shamelaUrl: input.shamelaUrl,
          shamelaId: input.shamelaId,
          coverUrl: input.coverUrl,
          coverColor: input.coverColor,
          category: input.category,
          categoryUrl: input.categoryUrl,
        },
      });

      // Link author if provided
      if (input.authorName) {
        const author = await db.bookAuthor.upsert({
          where: { name: input.authorName },
          create: { name: input.authorName, url: input.authorUrl },
          update: { url: input.authorUrl },
        });
        await db.book.update({
          where: { id: book.id },
          data: { authors: { connect: { id: author.id } } },
        });
      }

      // Extract #tags from description
      if (input.description) {
        await attachTags(db, blog.id, input.description);
      }

      return book;
    }),

  updateBook: publicProcedure
    .input(
      z.object({
        id: z.number(),
        nameAr: z.string().optional(),
        nameEn: z.string().optional(),
        description: z.string().optional(),
        shelfId: z.number().optional(),
        shamelaUrl: z.string().optional(),
        shamelaId: z.number().optional(),
        coverUrl: z.string().optional(),
        coverColor: z.string().optional(),
        category: z.string().optional(),
        categoryUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { id, description, ...rest } = input;

      const book = await db.book.update({
        where: { id },
        data: rest,
      });

      if (description !== undefined) {
        const blog = await db.blog.update({
          where: { id: book.blogId },
          data: { content: description },
        });
        await attachTags(db, blog.id, description);
      }

      return book;
    }),

  deleteBook: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const book = await db.book.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      await db.blog.update({
        where: { id: book.blogId },
        data: { deletedAt: new Date() },
      });
      return book;
    }),

  // ── Volumes ──────────────────────────────────────────────────────────────────

  createVolume: publicProcedure
    .input(
      z.object({
        bookId: z.number(),
        number: z.number(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bookVolume.create({ data: input });
    }),

  // ── Pages ────────────────────────────────────────────────────────────────────

  getPage: publicProcedure
    .input(z.object({ pageId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.bookPage.findFirstOrThrow({
        where: { id: input.pageId, deletedAt: null },
        include: {
          paragraphs: { orderBy: { pid: "asc" } },
          footnotes: { orderBy: { marker: "asc" } },
          highlights: { orderBy: { startOffset: "asc" } },
          comments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
          volume: { select: { id: true, number: true, title: true } },
        },
      });
    }),

  getPageDocument: publicProcedure
    .input(z.object({ pageId: z.number() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.bookPage.findFirstOrThrow({
        where: { id: input.pageId, deletedAt: null },
        select: {
          id: true,
          rawJson: true,
          updatedAt: true,
          paragraphs: {
            select: { id: true, text: true },
            orderBy: { pid: "asc" },
          },
        },
      });
      const content = buildPageDocument(page);

      return {
        pageId: page.id,
        document: content.document,
        contentHtml: content.contentHtml,
        plainText: content.plainText,
        contentVersion: content.contentVersion,
        contentUpdatedAt: content.contentUpdatedAt ?? page.updatedAt?.toISOString() ?? null,
      };
    }),

  savePageDocument: publicProcedure
    .input(
      z.object({
        pageId: z.number(),
        document: z.any(),
        contentHtml: z.string().optional(),
        plainText: z.string().optional(),
        baseVersion: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.bookPage.findFirstOrThrow({
        where: { id: input.pageId, deletedAt: null },
        select: {
          id: true,
          rawJson: true,
          paragraphs: {
            select: { id: true, text: true },
            orderBy: { pid: "asc" },
          },
        },
      });
      const current = buildPageDocument(page);
      const currentVersion = current.contentVersion ?? 0;

      if (input.baseVersion != null && input.baseVersion !== currentVersion) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Page content changed since this draft was opened.",
        });
      }

      const document = input.contentHtml
        ? createDocumentFromHtml(input.contentHtml)
        : (input.document as Parameters<typeof getDocumentPlainText>[0]);
      const contentHtml = input.contentHtml ?? serializeDocumentToHtml(document);
      const plainText =
        input.plainText ??
        getDocumentPlainText(document);
      const nextVersion = currentVersion + 1;
      const contentUpdatedAt = new Date().toISOString();
      const baseRawJson = isRecord(page.rawJson) ? page.rawJson : {};
      const paragraphs = plainText
        .split(/\n\s*\n|\r\n\s*\r\n/g)
        .map((paragraph) => safeString(paragraph) ?? "")
        .filter(Boolean)
        .map((text, index) => ({
          pid: index + 1,
          text,
          footnoteIds: null as string | null,
        }));

      await ctx.db.bookPage.update({
        where: { id: input.pageId },
        data: {
          rawJson: {
            ...baseRawJson,
            contentDocument: document,
            contentHtml,
            contentPlainText: plainText,
            contentVersion: nextVersion,
            contentUpdatedAt,
          },
        },
      });

      await ctx.db.bookPageParagraph.deleteMany({ where: { pageId: input.pageId } });
      if (paragraphs.length > 0) {
        await ctx.db.bookPageParagraph.createMany({
          data: paragraphs.map((paragraph) => ({
            pageId: input.pageId,
            pid: paragraph.pid,
            text: paragraph.text,
            footnoteIds: paragraph.footnoteIds,
          })),
        });
      }

      return {
        pageId: input.pageId,
        document,
        contentHtml,
        plainText,
        contentVersion: nextVersion,
        contentUpdatedAt,
      };
    }),

  getBookImportHistory: publicProcedure
    .input(
      z.object({
        bookId: z.number().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.bookImportHistory.findMany({
        where: input.bookId ? { bookId: input.bookId } : undefined,
        include: {
          book: {
            select: { id: true, nameAr: true, nameEn: true, coverColor: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(input.limit * 5, 200),
      });

      const seen = new Set<string>();

      return history.filter((entry) => {
        const key = getBookImportHistoryKey(entry);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, input.limit);
    }),

  getBookPageImportHistory: publicProcedure
    .input(
      z.object({
        bookId: z.number(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.bookPageImportHistory.findMany({
        where: { bookId: input.bookId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  fetchPage: publicProcedure
    .input(
      z.object({
        bookId: z.number(),
        shamelaUrl: z.string().url(),
        volumeId: z.number().optional(),
        aiProvider: z
          .enum(["anthropic", "openai", "gemini"])
          .default("openai"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const aiResult = await callAI(
        input.aiProvider,
        SHAMELA_EXTRACT_PROMPT,
        4096,
        input.shamelaUrl,
      );
      const pageData = parsePageData(aiResult.text);
      const { page, historyId, diffSummaryJson } = await saveParsedPageData(db, {
        bookId: input.bookId,
        pageData,
        sourceUrl: input.shamelaUrl,
        volumeId: input.volumeId ?? null,
        importMethod: "reimport_url",
        provider: input.aiProvider,
      });

      await recordTokenUsage(
        db,
        aiResult,
        input.aiProvider,
        "page_fetch",
        input.bookId,
        page.id,
      );

      return { ...page, importHistoryId: historyId, diffSummaryJson };
    }),

  fetchNextPage: publicProcedure
    .input(
      z.object({
        bookId: z.number(),
        currentShamelaPageNo: z.number(),
        aiProvider: z
          .enum(["anthropic", "openai", "gemini"])
          .default("openai"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const currentPage = await db.bookPage.findFirst({
        where: {
          bookId: input.bookId,
          shamelaPageNo: input.currentShamelaPageNo,
          deletedAt: null,
        },
      });
      if (!currentPage) throw new Error("Current page not found");

      const book = await db.book.findFirst({
        where: { id: input.bookId, deletedAt: null },
        select: { id: true, shamelaUrl: true },
      });
      if (!book) throw new Error("Book not found");

      const nextPageNo = input.currentShamelaPageNo + 1;
      const nextExistingPage = await db.bookPage.findFirst({
        where: {
          bookId: input.bookId,
          shamelaPageNo: nextPageNo,
          deletedAt: null,
        },
        include: {
          paragraphs: { orderBy: { pid: "asc" } },
          footnotes: { orderBy: { marker: "asc" } },
          highlights: { orderBy: { startOffset: "asc" } },
          comments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
          volume: { select: { id: true, number: true, title: true } },
        },
      });

      if (nextExistingPage?.status === "fetched") {
        return {
          ...nextExistingPage,
          importHistoryId: null,
          diffSummaryJson: null,
        };
      }

      const nextUrl =
        nextExistingPage?.shamelaUrl ||
        (currentPage.shamelaUrl
          ? buildShamelaPageUrl(currentPage.shamelaUrl, nextPageNo)
          : book.shamelaUrl
            ? buildShamelaPageUrl(book.shamelaUrl, nextPageNo)
            : null);

      if (!nextUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No Shamela link is available to import the next page.",
        });
      }

      const aiResult = await callAI(
        input.aiProvider,
        SHAMELA_EXTRACT_PROMPT,
        4096,
        nextUrl,
      );
      const pageData = parsePageData(aiResult.text);
      const { page, historyId, diffSummaryJson } = await saveParsedPageData(db, {
        bookId: input.bookId,
        pageData,
        sourceUrl: nextUrl,
        volumeId: currentPage.volumeId ?? null,
        importMethod: "reimport_url",
        provider: input.aiProvider,
      });

      await recordTokenUsage(
        db,
        aiResult,
        input.aiProvider,
        "page_fetch_next",
        input.bookId,
        page.id,
      );

      return { ...page, importHistoryId: historyId, diffSummaryJson };
    }),

  importBookPageManually: publicProcedure
    .input(
      z.object({
        bookId: z.number().optional(),
        createBook: z
          .object({
            nameAr: z.string().min(1),
            nameEn: z.string().optional(),
            description: z.string().optional(),
            shamelaUrl: z.string().optional(),
          })
          .optional(),
        sourceUrl: z.string().url().optional(),
        shamelaPageNo: z.number().optional(),
        printedPageNo: z.number().optional(),
        chapterTitle: z.string().optional(),
        topicTitle: z.string().optional(),
        pageText: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      let bookId = input.bookId;

      try {
        if (!bookId && !input.createBook) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Select an existing book or create a new one first.",
          });
        }

        if (!bookId && input.createBook) {
          const createdBook = await ctx.db.book.create({
            data: {
              blog: {
                create: {
                  type: "book",
                  content: input.createBook.description ?? input.createBook.nameAr,
                  published: true,
                  status: "published",
                },
              },
              nameAr: input.createBook.nameAr,
              nameEn: input.createBook.nameEn ?? undefined,
              shamelaUrl: input.createBook.shamelaUrl ?? undefined,
            },
          });
          bookId = createdBook.id;
        }

        const shamelaPageNo =
          input.shamelaPageNo ??
          ((await db.bookPage.aggregate({
            where: { bookId },
            _max: { shamelaPageNo: true },
          }))._max.shamelaPageNo ?? 0) + 1;

        const paragraphs = input.pageText
          .split(/\n\s*\n|\r\n\s*\r\n/g)
          .map((paragraph) => safeString(paragraph))
          .filter(Boolean)
          .map((text, index) => ({
            pid: index + 1,
            text: text!,
            footnoteIds: null,
          }));

        const pageData: ParsedPageData = {
          shamelaPageNo,
          printedPageNo: input.printedPageNo ?? null,
          chapterTitle: input.chapterTitle ?? null,
          chapterUrl: null,
          topicTitle: input.topicTitle ?? null,
          topicUrl: null,
          paragraphs,
          footnotes: [],
        };

        const result = await saveParsedPageData(db, {
          bookId: bookId!,
          pageData,
          sourceUrl: input.sourceUrl ?? null,
          importMethod: "manual_paste",
          rawInput: input.pageText,
        });

        return { bookId, ...result };
      } catch (error) {
        console.error("importBookPageManually failed", {
          requestedBookId: input.bookId ?? null,
          resolvedBookId: bookId ?? null,
          createBook: input.createBook
            ? {
                nameAr: input.createBook.nameAr,
                nameEn: input.createBook.nameEn ?? null,
                shamelaUrl: input.createBook.shamelaUrl ?? null,
              }
            : null,
          sourceUrl: input.sourceUrl ?? null,
          shamelaPageNo: input.shamelaPageNo ?? null,
          printedPageNo: input.printedPageNo ?? null,
          chapterTitle: input.chapterTitle ?? null,
          topicTitle: input.topicTitle ?? null,
          pageTextLength: input.pageText.length,
          ...toErrorLogPayload(error),
        });
        throw error;
      }
    }),

  // ── Highlights ───────────────────────────────────────────────────────────────

  addHighlight: publicProcedure
    .input(
      z.object({
        pageId: z.number(),
        paragraphId: z.number().optional(),
        startOffset: z.number(),
        endOffset: z.number(),
        color: z.string().default("#FFD700"),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paragraph = input.paragraphId
        ? await ctx.db.bookPageParagraph.findFirst({
            where: { id: input.paragraphId },
            select: {
              pid: true,
              text: true,
              page: { select: { shamelaPageNo: true } },
            },
          })
        : null;
      return ctx.db.bookPageHighlight.create({
        data: {
          ...input,
          userId: getDefaultBookUserId(),
          pageShamelaPageNo: paragraph?.page.shamelaPageNo ?? null,
          paragraphPid: paragraph?.pid ?? null,
          quoteText: paragraph?.text ?? null,
        },
      });
    }),

  deleteHighlight: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bookPageHighlight.delete({ where: { id: input.id } });
    }),

  // ── Comments ─────────────────────────────────────────────────────────────────

  addPageComment: publicProcedure
    .input(
      z.object({
        pageId: z.number(),
        content: z.string().min(1),
        paragraphId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paragraph = input.paragraphId
        ? await ctx.db.bookPageParagraph.findFirst({
            where: { id: input.paragraphId },
            select: {
              pid: true,
              text: true,
              page: { select: { shamelaPageNo: true } },
            },
          })
        : null;
      return ctx.db.bookPageComment.create({
        data: {
          ...input,
          userId: getDefaultBookUserId(),
          pageShamelaPageNo: paragraph?.page.shamelaPageNo ?? null,
          paragraphPid: paragraph?.pid ?? null,
          quoteText: paragraph?.text ?? null,
        },
      });
    }),

  deletePageComment: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bookPageComment.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  // ── Book meta (lightweight, for offline sync check) ─────────────────────────

  getBookMeta: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const book = await ctx.db.book.findFirstOrThrow({
        where: { id: input.id, deletedAt: null },
        select: { id: true, contentHash: true, pagesUpdatedAt: true },
      });
      const totalCount = await ctx.db.bookPage.count({
        where: { bookId: input.id, deletedAt: null },
      });
      const fetchedCount = await ctx.db.bookPage.count({
        where: { bookId: input.id, status: "fetched", deletedAt: null },
      });
      return {
        id: book.id,
        contentHash: book.contentHash,
        pagesUpdatedAt: book.pagesUpdatedAt,
        fetchedCount,
        totalCount,
      };
    }),

  // ── Bulk download ─────────────────────────────────────────────────────────────

  getBookForDownload: publicProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const book = await db.book.findFirstOrThrow({
        where: { id: input.bookId, deletedAt: null },
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          coverColor: true,
          shamelaId: true,
          contentHash: true,
          pagesUpdatedAt: true,
        },
      });
      const volumes = await db.bookVolume.findMany({
        where: { bookId: input.bookId, deletedAt: null },
        select: { id: true, number: true, title: true },
        orderBy: { number: "asc" },
      });
      const pages = await db.bookPage.findMany({
        where: { bookId: input.bookId, deletedAt: null },
        select: {
          id: true,
          volumeId: true,
          shamelaPageNo: true,
          shamelaUrl: true,
          printedPageNo: true,
          chapterTitle: true,
          topicTitle: true,
          status: true,
          paragraphs: {
            select: { id: true, pid: true, text: true, footnoteIds: true },
            orderBy: { pid: "asc" },
          },
          footnotes: {
            select: { id: true, marker: true, type: true, content: true },
          },
        },
        orderBy: { shamelaPageNo: "asc" },
      });
      const highlights = await db.bookPageHighlight.findMany({
        where: {
          page: { bookId: input.bookId },
          userId: getDefaultBookUserId(),
        },
        select: {
          id: true,
          pageId: true,
          paragraphId: true,
          paragraphPid: true,
          color: true,
          note: true,
          quoteText: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const comments = await db.bookPageComment.findMany({
        where: {
          page: { bookId: input.bookId },
          userId: getDefaultBookUserId(),
          deletedAt: null,
        },
        select: {
          id: true,
          pageId: true,
          paragraphId: true,
          paragraphPid: true,
          content: true,
          quoteText: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return { book, volumes, pages, highlights, comments };
    }),

  // ── Search book content ───────────────────────────────────────────────────────

  searchBookContent: publicProcedure
    .input(z.object({ bookId: z.number(), query: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const titleMatches = await db.bookPage.findMany({
        where: {
          bookId: input.bookId,
          deletedAt: null,
          OR: [
            { chapterTitle: { contains: input.query } },
            { topicTitle: { contains: input.query } },
          ],
        },
        select: {
          id: true,
          chapterTitle: true,
          topicTitle: true,
          printedPageNo: true,
          shamelaPageNo: true,
          status: true,
          volumeId: true,
        },
        take: 30,
      });
      const paraMatches = await db.bookPageParagraph.findMany({
        where: {
          text: { contains: input.query },
          page: { bookId: input.bookId, status: "fetched", deletedAt: null },
        },
        select: {
          id: true,
          text: true,
          page: {
            select: {
              id: true,
              chapterTitle: true,
              topicTitle: true,
              printedPageNo: true,
              shamelaPageNo: true,
              volumeId: true,
            },
          },
        },
        take: 30,
      });
      const seen = new Set<number>();
      const results: {
        pageId: number;
        chapterTitle: string | null;
        topicTitle: string | null;
        printedPageNo: number | null;
        shamelaPageNo: number;
        volumeId: number | null;
        snippet: string | null;
        matchType: "title" | "paragraph";
      }[] = [];
      for (const p of titleMatches) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          results.push({
            pageId: p.id,
            chapterTitle: p.chapterTitle,
            topicTitle: p.topicTitle,
            printedPageNo: p.printedPageNo,
            shamelaPageNo: p.shamelaPageNo,
            volumeId: p.volumeId,
            snippet: null,
            matchType: "title",
          });
        }
      }
      for (const p of paraMatches) {
        if (!seen.has(p.page.id)) {
          seen.add(p.page.id);
          results.push({
            pageId: p.page.id,
            chapterTitle: p.page.chapterTitle,
            topicTitle: p.page.topicTitle,
            printedPageNo: p.page.printedPageNo,
            shamelaPageNo: p.page.shamelaPageNo,
            volumeId: p.page.volumeId,
            snippet: p.text.slice(0, 200),
            matchType: "paragraph",
          });
        }
      }
      return results;
    }),

  // ── Highlights bulk sync ──────────────────────────────────────────────────────

  getHighlightsForBook: publicProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.bookPageHighlight.findMany({
        where: {
          page: { bookId: input.bookId },
          userId: getDefaultBookUserId(),
        },
        select: {
          id: true,
          pageId: true,
          paragraphId: true,
          paragraphPid: true,
          pageShamelaPageNo: true,
          startOffset: true,
          endOffset: true,
          color: true,
          note: true,
          quoteText: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }),

  syncHighlights: publicProcedure
    .input(
      z.object({
        highlights: z.array(
          z.object({
            localId: z.string(),
            pageId: z.number(),
            paragraphId: z.number().optional(),
            startOffset: z.number().optional(),
            endOffset: z.number().optional(),
            color: z.string(),
            note: z.string().optional(),
            quoteText: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: { localId: string; serverId: number }[] = [];
      for (const h of input.highlights) {
        const paragraph = h.paragraphId
          ? await ctx.db.bookPageParagraph.findFirst({
              where: { id: h.paragraphId },
              select: {
                pid: true,
                text: true,
                page: { select: { shamelaPageNo: true } },
              },
            })
          : null;
        const created = await ctx.db.bookPageHighlight.create({
          data: {
            pageId: h.pageId,
            paragraphId: h.paragraphId ?? null,
            paragraphPid: paragraph?.pid ?? null,
            pageShamelaPageNo: paragraph?.page.shamelaPageNo ?? null,
            startOffset: h.startOffset ?? 0,
            endOffset: h.endOffset ?? 0,
            color: h.color,
            note: h.note ?? null,
            quoteText: h.quoteText ?? paragraph?.text ?? null,
            userId: getDefaultBookUserId(),
          },
        });
        results.push({ localId: h.localId, serverId: created.id });
      }
      return results;
    }),

  // ── Comments bulk sync ────────────────────────────────────────────────────────

  getCommentsForBook: publicProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.bookPageComment.findMany({
        where: {
          page: { bookId: input.bookId },
          userId: getDefaultBookUserId(),
          deletedAt: null,
        },
        select: {
          id: true,
          pageId: true,
          paragraphId: true,
          paragraphPid: true,
          pageShamelaPageNo: true,
          content: true,
          quoteText: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }),

  syncComments: publicProcedure
    .input(
      z.object({
        comments: z.array(
          z.object({
            localId: z.string(),
            pageId: z.number(),
            paragraphId: z.number().optional(),
            content: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: { localId: string; serverId: number }[] = [];
      for (const c of input.comments) {
        const paragraph = c.paragraphId
          ? await ctx.db.bookPageParagraph.findFirst({
              where: { id: c.paragraphId },
              select: {
                pid: true,
                text: true,
                page: { select: { shamelaPageNo: true } },
              },
            })
          : null;
        const created = await ctx.db.bookPageComment.create({
          data: {
            pageId: c.pageId,
            paragraphId: c.paragraphId ?? null,
            paragraphPid: paragraph?.pid ?? null,
            pageShamelaPageNo: paragraph?.page.shamelaPageNo ?? null,
            content: c.content,
            quoteText: paragraph?.text ?? null,
            userId: getDefaultBookUserId(),
          },
        });
        results.push({ localId: c.localId, serverId: created.id });
      }
      return results;
    }),

  // ── Sync book from Shamela URL ───────────────────────────────────────────────

  syncBookFromShamela: publicProcedure
    .input(
      z.object({
        shamelaUrl: z.string().min(1),
        aiModel: z.enum(["gpt-5", "gpt-4o", "gemini"]).default("gpt-5"),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      syncBookFromShamelaInternal(ctx.db, {
        shamelaUrl: input.shamelaUrl,
        aiProvider: getProviderForImportModel(input.aiModel),
        aiModel: input.aiModel,
      }),
    ),

  previewBookImportFromShamela: publicProcedure
    .input(
      z.object({
        shamelaUrl: z.string().min(1),
        aiModel: z.enum(["gpt-5", "gpt-4o", "gemini"]).default("gpt-5"),
      }),
    )
    .mutation(async ({ input }) =>
      previewBookImportFromShamelaInternal({
        shamelaUrl: input.shamelaUrl,
        aiProvider: getProviderForImportModel(input.aiModel),
        aiModel: input.aiModel,
      }),
    ),

  captureAndStageShamelaPage: publicProcedure
    .input(
      z.object({
        requestedUrl: z.string().min(1),
        finalUrl: z.string().min(1),
        title: z.string().optional(),
        html: z.string().min(1),
        source: z.string().default("mobile-webview"),
        bookId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      captureAndStageShamelaPageInternal(ctx.db, {
        requestedUrl: input.requestedUrl,
        finalUrl: input.finalUrl,
        title: input.title,
        html: input.html,
        source: input.source,
        bookId: input.bookId,
      }),
    ),

  getStagedShamelaPageParse: publicProcedure
    .input(z.object({ stagedParseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const staged = await ctx.db.shamelaStagedPageParse.findFirstOrThrow({
        where: { id: input.stagedParseId },
        include: {
          rawPage: {
            select: {
              id: true,
              requestedUrl: true,
              finalUrl: true,
              title: true,
              captureStatus: true,
              source: true,
              shamelaPageNo: true,
              createdAt: true,
            },
          },
        },
      });

      return {
        id: staged.id,
        status: staged.status,
        parserVersion: staged.parserVersion,
        shamelaPageNo: staged.shamelaPageNo,
        printedPageNo: staged.printedPageNo,
        volumeNumber: staged.volumeNumber ?? null,
        chapterTitle: staged.chapterTitle,
        chapterUrl: staged.chapterUrl,
        topicTitle: staged.topicTitle,
        topicUrl: staged.topicUrl,
        document:
          staged.documentJson && typeof staged.documentJson === "object"
            ? staged.documentJson
            : null,
        facts:
          staged.factsJson && typeof staged.factsJson === "object"
            ? staged.factsJson
            : null,
        linkGraph:
          staged.linkGraphJson && typeof staged.linkGraphJson === "object"
            ? staged.linkGraphJson
            : null,
        diagnostics:
          staged.diagnosticsJson &&
          typeof staged.diagnosticsJson === "object" &&
          Array.isArray((staged.diagnosticsJson as any).diagnostics)
            ? (staged.diagnosticsJson as any).diagnostics
            : [],
        rawPage: staged.rawPage,
      };
    }),

  getTokenUsage: publicProcedure
    .input(
      z.object({
        bookId: z.number().optional(),
        limit: z.number().default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.aiTokenUsage.findMany({
        where: input.bookId ? { bookId: input.bookId } : undefined,
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
