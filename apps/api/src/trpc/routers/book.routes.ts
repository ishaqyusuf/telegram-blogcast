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
import type { ShamelaTocNode } from "@acme/document";

const readerWindowInput = z.object({
  pageId: z.number(),
  referenceId: z.number().optional(),
  mediaId: z.number().optional(),
  centerSec: z.number().int().nonnegative().optional(),
  radius: z.number().int().min(1).max(10).optional().default(2),
  direction: z.enum(["initial", "previous", "next"]).optional().default("initial"),
  cursor: z.number().optional(),
});

const SHAMELA_EXTRACT_PROMPT = `You are a structured data extractor for Islamic books from Shamela (the largest Islamic digital library).

Given an HTML page from Shamela, extract the book page content and return it as a JSON object with this exact shape:

{
  "shamelaPageNo": <number — the page ID from the URL path's last segment, e.g. /book/123/1112 => 1112>,
  "printedPageNo": <number | null — the printed book page number if shown>,
  "chapterTitle": <string | null — the chapter/باب title if present>,
  "chapterUrl": <string | null — the chapter URL if present>,
  "topicTitle": <string | null — the topic/فصل title if present>,
  "topicUrl": <string | null — the topic URL if present>,
  "previousShamelaPageNo": <number | null — the previous Shamela page ID if present>,
  "previousShamelaUrl": <string | null — the previous page URL if present>,
  "nextShamelaPageNo": <number | null — the next Shamela page ID if present>,
  "nextShamelaUrl": <string | null — the next page URL if present>,
  "firstShamelaPageNo": <number | null — the first Shamela page ID from the << pagination button if present>,
  "firstShamelaUrl": <string | null — the first page URL from the << pagination button if present>,
  "lastShamelaPageNo": <number | null — the last Shamela page ID from the >> pagination button if present>,
  "lastShamelaUrl": <string | null — the last page URL from the >> pagination button if present>,
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
- Extract first/previous/next/last page links from Shamela page navigation controls. Use absolute https://shamela.ws URLs when present.
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
  previousShamelaPageNo?: number | null;
  previousShamelaUrl?: string | null;
  nextShamelaPageNo?: number | null;
  nextShamelaUrl?: string | null;
  firstShamelaPageNo?: number | null;
  firstShamelaUrl?: string | null;
  lastShamelaPageNo?: number | null;
  lastShamelaUrl?: string | null;
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
      shamelaUrl: getShamelaStoragePath(ch.shamelaUrl) ?? ch.shamelaUrl,
      chapterTitle: ch.chapterTitle ?? null,
      topicTitle: ch.topicTitle ?? null,
      volumeId: volumeIdMap.get(ch.volumeNumber) ?? null,
      status: "pending",
    })),
  });

  for (const chapter of toc.chapters) {
    const shamelaUrl =
      getShamelaStoragePath(chapter.shamelaUrl) ?? chapter.shamelaUrl;
    await db.bookPage.updateMany({
      where: { bookId, shamelaPageNo: chapter.shamelaPageNo },
      data: { shamelaUrl },
    });
  }

  for (const vol of toc.volumes ?? []) {
    await db.bookTocNode.upsert({
      where: { bookId_treePath: { bookId, treePath: String(vol.number) } },
      create: {
        bookId,
        kind: "volume",
        title: vol.title ?? `Volume ${vol.number}`,
        shamelaPath: null,
        volumeNumber: vol.number,
        depth: 0,
        sortOrder: vol.number - 1,
        treePath: String(vol.number),
      },
      update: {
        title: vol.title ?? `Volume ${vol.number}`,
        volumeNumber: vol.number,
        depth: 0,
        sortOrder: vol.number - 1,
        deletedAt: null,
      },
    });
  }

  const pageRows = await db.bookPage.findMany({
    where: {
      bookId,
      shamelaPageNo: {
        in: toc.chapters.map((chapter) => chapter.shamelaPageNo),
      },
      deletedAt: null,
    },
    select: { id: true, shamelaPageNo: true },
  });
  const pageIdByPageNo = new Map(
    pageRows.map((page: { id: number; shamelaPageNo: number }) => [
      page.shamelaPageNo,
      page.id,
    ]),
  );
  const chaptersByVolume = new Map<number, ParsedTocData["chapters"]>();
  for (const chapter of toc.chapters) {
    const volumeNumber = chapter.volumeNumber || 1;
    const current = chaptersByVolume.get(volumeNumber) ?? [];
    current.push(chapter);
    chaptersByVolume.set(volumeNumber, current);
  }
  for (const [volumeNumber, chapters] of chaptersByVolume) {
    const parent = await db.bookTocNode.upsert({
      where: { bookId_treePath: { bookId, treePath: String(volumeNumber) } },
      create: {
        bookId,
        kind: "volume",
        title:
          toc.volumes.find((volume) => volume.number === volumeNumber)?.title ??
          `Volume ${volumeNumber}`,
        volumeNumber,
        depth: 0,
        sortOrder: volumeNumber - 1,
        treePath: String(volumeNumber),
      },
      update: { deletedAt: null },
      select: { id: true },
    });
    for (const [index, chapter] of chapters.entries()) {
      const treePath = `${volumeNumber}.${index + 1}`;
      await db.bookTocNode.upsert({
        where: { bookId_treePath: { bookId, treePath } },
        create: {
          bookId,
          parentId: parent.id,
          pageId: pageIdByPageNo.get(chapter.shamelaPageNo) ?? null,
          kind: "chapter",
          title:
            chapter.topicTitle ??
            chapter.chapterTitle ??
            `Page ${chapter.shamelaPageNo}`,
          shamelaPath: getShamelaStoragePath(chapter.shamelaUrl),
          shamelaPageNo: chapter.shamelaPageNo,
          volumeNumber,
          depth: 1,
          sortOrder: index,
          treePath,
          metadataJson: { source: "ai_toc" },
        },
        update: {
          parentId: parent.id,
          pageId: pageIdByPageNo.get(chapter.shamelaPageNo) ?? null,
          title:
            chapter.topicTitle ??
            chapter.chapterTitle ??
            `Page ${chapter.shamelaPageNo}`,
          shamelaPath: getShamelaStoragePath(chapter.shamelaUrl),
          shamelaPageNo: chapter.shamelaPageNo,
          volumeNumber,
          depth: 1,
          sortOrder: index,
          metadataJson: { source: "ai_toc" },
          deletedAt: null,
        },
      });
    }
  }

  return results.count;
}

function getDefaultBookUserId(): number {
  return 1;
}

function getCurrentBookUserId(ctx: { userId?: number | null }): number {
  return ctx.userId ?? getDefaultBookUserId();
}

function isShamelaSource(source: {
  shamelaId?: number | null;
  shamelaUrl?: string | null;
}) {
  return Boolean(source.shamelaId || source.shamelaUrl);
}

function canEditBook(
  book: {
    editable?: boolean | null;
    sourceType?: string | null;
    ownerUserId?: number | null;
    shamelaId?: number | null;
    shamelaUrl?: string | null;
  },
  userId: number,
): boolean {
  const sourceType = book.sourceType ?? "user";
  return Boolean(
    book.editable !== false &&
    sourceType === "user" &&
    !isShamelaSource(book) &&
    (book.ownerUserId == null || book.ownerUserId === userId),
  );
}

async function assertBookEditableById(db: any, bookId: number, userId: number) {
  const book = await db.book.findFirstOrThrow({
    where: { id: bookId, deletedAt: null },
    select: {
      id: true,
      editable: true,
      sourceType: true,
      ownerUserId: true,
      shamelaId: true,
      shamelaUrl: true,
    } as any,
  });

  if (!canEditBook(book, userId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Imported books are read-only. Re-download from the source URL instead.",
    });
  }

  return book;
}

async function assertPageBookEditable(db: any, pageId: number, userId: number) {
  const page = await db.bookPage.findFirstOrThrow({
    where: { id: pageId, deletedAt: null },
    select: {
      id: true,
      bookId: true,
      book: {
        select: {
          id: true,
          editable: true,
          sourceType: true,
          ownerUserId: true,
          shamelaId: true,
          shamelaUrl: true,
        },
      },
    } as any,
  });

  if (!canEditBook(page.book, userId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Imported books are read-only. Re-download from the source URL instead.",
    });
  }

  return page;
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
      typeof rawJson.contentPlainText === "string"
        ? rawJson.contentPlainText
        : null,
    contentVersion:
      typeof rawJson.contentVersion === "number" ? rawJson.contentVersion : 0,
    contentUpdatedAt:
      typeof rawJson.contentUpdatedAt === "string"
        ? rawJson.contentUpdatedAt
        : null,
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
  const contentHtml =
    stored.contentHtml ??
    serializeDocumentToHtml(
      document as Parameters<typeof serializeDocumentToHtml>[0],
    );
  const plainText =
    stored.contentPlainText ??
    getDocumentPlainText(
      document as Parameters<typeof getDocumentPlainText>[0],
    );

  return {
    document,
    contentHtml,
    plainText,
    contentVersion: stored.contentVersion,
    contentUpdatedAt: stored.contentUpdatedAt,
  };
}

function normalizeSourceUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim(), "https://shamela.ws");
  url.search = "";
  url.hash = "";
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

function isAbsoluteUrl(value: string) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function isShamelaHostname(hostname: string) {
  return hostname === "shamela.ws" || hostname.endsWith(".shamela.ws");
}

function isShamelaUrlOrPath(rawUrlOrPath: string) {
  try {
    const url = new URL(rawUrlOrPath.trim(), "https://shamela.ws");
    return !isAbsoluteUrl(rawUrlOrPath) || isShamelaHostname(url.hostname);
  } catch {
    return false;
  }
}

function getShamelaPath(
  rawUrlOrPath: string | null | undefined,
): string | null {
  const value = safeString(rawUrlOrPath);
  if (!value) return null;
  try {
    const url = new URL(value, "https://shamela.ws");
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

function getShamelaStoragePath(
  rawUrlOrPath: string | null | undefined,
): string | null {
  const value = safeString(rawUrlOrPath);
  if (!value) return null;
  try {
    const url = new URL(value, "https://shamela.ws");
    if (isAbsoluteUrl(value) && !isShamelaHostname(url.hostname)) {
      return null;
    }
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

function getShamelaBookStoragePath(
  rawUrlOrPath: string | null | undefined,
): string | null {
  const path = getShamelaStoragePath(rawUrlOrPath);
  const match = path?.match(/^\/book\/(\d+)(?:\/\d+)?$/);
  return match ? `/book/${match[1]}` : null;
}

function buildShamelaUrlFromPath(pathOrUrl: string): string {
  return normalizeSourceUrl(pathOrUrl);
}

function buildShamelaPageSourceUrl(pathOrUrl: string): string {
  if (!isShamelaUrlOrPath(pathOrUrl)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Invalid Shamela page link — only shamela.ws links are supported.",
    });
  }
  const sourceUrl = buildShamelaUrlFromPath(pathOrUrl);
  const hasBook = getShamelaBookIdFromUrl(sourceUrl) != null;
  const hasPage = getShamelaPageNoFromUrl(sourceUrl) != null;
  if (!hasBook || !hasPage) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Shamela page link — expected /book/{bookId}/{pageNo}.",
    });
  }
  return sourceUrl;
}

function getShamelaBookUrlFromUrl(rawUrl: string): string | null {
  try {
    if (!isShamelaUrlOrPath(rawUrl)) return null;
    const normalizedUrl = normalizeSourceUrl(rawUrl);
    const match = normalizedUrl.match(
      /^(https?:\/\/[^/]+\/book\/\d+)(?:\/\d+)?$/,
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeShamelaUrlInput(rawUrl: string | null | undefined) {
  const value = safeString(rawUrl);
  if (!value) return undefined;
  const bookPath = getShamelaBookStoragePath(value);
  if (!bookPath) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Shamela URL — expected a /book/... path.",
    });
  }
  return bookPath;
}

function getShamelaBookIdFromUrl(
  rawUrl: string | null | undefined,
): number | null {
  if (!rawUrl) return null;
  try {
    const normalizedUrl = normalizeSourceUrl(rawUrl);
    const match = normalizedUrl.match(/\/book\/(\d+)(?:\/\d+)?$/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function buildShamelaPageUrl(baseUrl: string, shamelaPageNo: number): string {
  const bookUrl = getShamelaBookUrlFromUrl(baseUrl);
  if (!bookUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Shamela book URL for page navigation.",
    });
  }

  return `${bookUrl}/${shamelaPageNo}`;
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

  const pageSegment = input.shamelaPageNo
    ? `page-${input.shamelaPageNo}`
    : "page-unknown";
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
  const volume =
    matchedBookId && input.volumeNumber != null
      ? await db.bookVolume.findFirst({
          where: {
            bookId: matchedBookId,
            number: input.volumeNumber,
            deletedAt: null,
          },
          select: { id: true },
        })
      : null;

  const topicPage =
    matchedBookId && input.currentTopicHref
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

function getPreviewSafeShamelaDocument(
  document: ReturnType<typeof parseShamelaOpenPage>["document"],
) {
  return {
    ...document,
    context: {
      ...document.context,
      toc: document.context.toc.map((node) => ({
        kind: node.kind,
        title: node.title,
        path: node.path,
        url: node.url,
        shamelaPageNo: node.shamelaPageNo,
        volumeNumber: node.volumeNumber,
        depth: node.depth,
        sortOrder: node.sortOrder,
        treePath: node.treePath,
        parentTreePath: node.parentTreePath,
        active: node.active,
      })),
    },
  };
}

function getPreviewSafeShamelaFacts(
  facts: ReturnType<typeof parseShamelaOpenPage>["facts"],
) {
  const flatNodes = flattenShamelaTocNodes(facts.toc.nodes);
  return {
    ...facts,
    toc: {
      ...facts.toc,
      nodes: flatNodes.map((node) => ({
        kind: node.kind,
        title: node.title,
        path: node.path,
        url: node.url,
        shamelaPageNo: node.shamelaPageNo,
        volumeNumber: node.volumeNumber,
        depth: node.depth,
        sortOrder: node.sortOrder,
        treePath: node.treePath,
        parentTreePath: node.parentTreePath,
        active: node.active,
      })),
      activeNode: facts.toc.activeNode
        ? {
            kind: facts.toc.activeNode.kind,
            title: facts.toc.activeNode.title,
            path: facts.toc.activeNode.path,
            url: facts.toc.activeNode.url,
            shamelaPageNo: facts.toc.activeNode.shamelaPageNo,
            volumeNumber: facts.toc.activeNode.volumeNumber,
            depth: facts.toc.activeNode.depth,
            sortOrder: facts.toc.activeNode.sortOrder,
            treePath: facts.toc.activeNode.treePath,
            parentTreePath: facts.toc.activeNode.parentTreePath,
            active: facts.toc.activeNode.active,
          }
        : null,
    },
  };
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
  if (!isShamelaUrlOrPath(rawUrl)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Shamela URL — only shamela.ws links are supported.",
    });
  }
  const normalizedUrl = normalizeSourceUrl(rawUrl);
  const parsedUrl = new URL(rawUrl.trim(), "https://shamela.ws");
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
      ? normalizeSourceUrl(
          `${parsedUrl.origin}/${pathSegments.slice(0, 3).join("/")}`,
        )
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
    previousShamelaPageNo:
      typeof parsed.previousShamelaPageNo === "number"
        ? parsed.previousShamelaPageNo
        : parsed.previousShamelaUrl
          ? getShamelaPageNoFromUrl(parsed.previousShamelaUrl)
          : null,
    previousShamelaUrl: safeString(parsed.previousShamelaUrl),
    nextShamelaPageNo:
      typeof parsed.nextShamelaPageNo === "number"
        ? parsed.nextShamelaPageNo
        : parsed.nextShamelaUrl
          ? getShamelaPageNoFromUrl(parsed.nextShamelaUrl)
          : null,
    nextShamelaUrl: safeString(parsed.nextShamelaUrl),
    firstShamelaPageNo:
      typeof parsed.firstShamelaPageNo === "number"
        ? parsed.firstShamelaPageNo
        : parsed.firstShamelaUrl
          ? getShamelaPageNoFromUrl(parsed.firstShamelaUrl)
          : null,
    firstShamelaUrl: safeString(parsed.firstShamelaUrl),
    lastShamelaPageNo:
      typeof parsed.lastShamelaPageNo === "number"
        ? parsed.lastShamelaPageNo
        : parsed.lastShamelaUrl
          ? getShamelaPageNoFromUrl(parsed.lastShamelaUrl)
          : null,
    lastShamelaUrl: safeString(parsed.lastShamelaUrl),
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
      .filter(
        (footnote) => footnote.marker.length > 0 && footnote.content.length > 0,
      ),
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
  input: {
    bookId?: number | null;
    sourceUrl: string;
    normalizedUrl?: string | null;
    provider?: string | null;
    importMode?: string;
  },
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

function flattenShamelaTocNodes(nodes: ShamelaTocNode[]): ShamelaTocNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenShamelaTocNodes(node.children),
  ]);
}

async function syncParsedShamelaBookTree(
  db: any,
  input: {
    explicitBookId?: number | null;
    parsed: ReturnType<typeof parseShamelaOpenPage>;
    fallbackTitle?: string | null;
    finalUrl: string;
  },
) {
  const bookMeta = input.parsed.facts.book;
  const shamelaId =
    bookMeta.shamelaBookId ??
    input.parsed.document.meta.shamelaBookId ??
    getShamelaBookIdFromUrl(input.finalUrl);
  const bookPath =
    bookMeta.bookPath ??
    (shamelaId ? `/book/${shamelaId}` : getShamelaPath(input.finalUrl));
  const bookUrl = bookPath ? buildShamelaUrlFromPath(bookPath) : input.finalUrl;
  const bookStoragePath =
    getShamelaBookStoragePath(bookPath ?? bookUrl) ?? bookPath ?? bookUrl;
  const title =
    safeString(bookMeta.title) ??
    safeString(input.fallbackTitle) ??
    `Shamela book ${shamelaId ?? "unknown"}`;
  const pageMeta = input.parsed.facts.pageMeta;
  const firstShamelaUrl =
    getShamelaStoragePath(pageMeta.firstShamelaUrl) ??
    pageMeta.firstShamelaUrl ??
    null;
  const lastShamelaUrl =
    getShamelaStoragePath(pageMeta.lastShamelaUrl) ??
    pageMeta.lastShamelaUrl ??
    null;

  let book = input.explicitBookId
    ? await db.book.findFirst({
        where: { id: input.explicitBookId, deletedAt: null },
        include: { blog: { select: { id: true } } },
      })
    : null;

  if (!book && shamelaId) {
    book = await db.book.findFirst({
      where: { shamelaId, deletedAt: null },
      include: { blog: { select: { id: true } } },
    });
  }

  if (!book) {
    const blog = await db.blog.create({
      data: {
        type: "book",
        content: title,
        published: true,
        status: "published",
      },
    });
    book = await db.book.create({
      data: {
        blogId: blog.id,
        ownerUserId: getDefaultBookUserId(),
        sourceType: "shamela",
        editable: false,
        nameAr: title,
        shamelaId: shamelaId ?? undefined,
        shamelaUrl: bookStoragePath,
        firstShamelaPageNo: pageMeta.firstShamelaPageNo ?? undefined,
        firstShamelaUrl,
        lastShamelaPageNo: pageMeta.lastShamelaPageNo ?? undefined,
        lastShamelaUrl,
        category: bookMeta.category?.name ?? undefined,
        categoryUrl: bookMeta.category?.url ?? undefined,
        coverColor: "#14532d",
      },
      include: { blog: { select: { id: true } } },
    });
  } else {
    book = await db.book.update({
      where: { id: book.id },
      data: {
        nameAr: title,
        sourceType: "shamela",
        editable: false,
        shamelaId: shamelaId ?? book.shamelaId ?? undefined,
        shamelaUrl: bookStoragePath,
        firstShamelaPageNo: pageMeta.firstShamelaPageNo ?? undefined,
        firstShamelaUrl,
        lastShamelaPageNo: pageMeta.lastShamelaPageNo ?? undefined,
        lastShamelaUrl,
        category: bookMeta.category?.name ?? undefined,
        categoryUrl: bookMeta.category?.url ?? undefined,
      },
      include: { blog: { select: { id: true } } },
    });
  }

  if (bookMeta.author?.name) {
    const author = await db.bookAuthor.upsert({
      where: { name: bookMeta.author.name },
      create: {
        name: bookMeta.author.name,
        nameAr: bookMeta.author.name,
        url: bookMeta.author.url ?? undefined,
      },
      update: {
        nameAr: bookMeta.author.name,
        url: bookMeta.author.url ?? undefined,
      },
    });
    await db.book.update({
      where: { id: book.id },
      data: { authors: { set: [{ id: author.id }] } },
    });
  }

  const tocNodes = input.parsed.facts.toc.nodes;
  const flatNodes = flattenShamelaTocNodes(tocNodes);
  const volumeIdByNumber = new Map<number, number>();
  for (const node of tocNodes.filter((item) => item.kind === "volume")) {
    if (node.volumeNumber == null) continue;
    const volume = await db.bookVolume.upsert({
      where: { bookId_number: { bookId: book.id, number: node.volumeNumber } },
      create: { bookId: book.id, number: node.volumeNumber, title: node.title },
      update: { title: node.title, deletedAt: null },
    });
    volumeIdByNumber.set(node.volumeNumber, volume.id);
  }

  const pageIdByPageNo = new Map<number, number>();
  const nodesWithPages = flatNodes.filter(
    (node) => node.shamelaPageNo != null && (node.path || node.url),
  );
  for (const node of nodesWithPages) {
    const shamelaPageNo = node.shamelaPageNo!;
    const shamelaUrl =
      getShamelaStoragePath(node.path ?? node.url!) ??
      buildShamelaUrlFromPath(node.path ?? node.url!);
    const page = await db.bookPage.upsert({
      where: {
        bookId_shamelaPageNo: {
          bookId: book.id,
          shamelaPageNo,
        },
      },
      create: {
        bookId: book.id,
        volumeId:
          node.volumeNumber != null
            ? (volumeIdByNumber.get(node.volumeNumber) ?? null)
            : null,
        shamelaPageNo,
        shamelaUrl,
        chapterTitle: node.kind === "chapter" ? node.title : null,
        topicTitle: node.kind === "chapter" ? node.title : null,
        status: "pending",
      },
      update: {
        volumeId:
          node.volumeNumber != null
            ? (volumeIdByNumber.get(node.volumeNumber) ?? undefined)
            : undefined,
        shamelaUrl,
        ...(node.kind === "chapter"
          ? {
              chapterTitle: node.title,
              topicTitle: node.title,
            }
          : {}),
        deletedAt: null,
      },
      select: { id: true },
    });
    pageIdByPageNo.set(shamelaPageNo, page.id);
  }

  async function upsertNode(node: ShamelaTocNode, parentId: number | null) {
    const pageId =
      node.shamelaPageNo != null
        ? (pageIdByPageNo.get(node.shamelaPageNo) ?? null)
        : null;
    const nodeShamelaPath = getShamelaStoragePath(node.path ?? node.url);
    const row = await db.bookTocNode.upsert({
      where: {
        bookId_treePath: {
          bookId: book.id,
          treePath: node.treePath,
        },
      },
      create: {
        bookId: book.id,
        parentId,
        pageId,
        kind: node.kind,
        title: node.title,
        shamelaPath: nodeShamelaPath,
        shamelaPageNo: node.shamelaPageNo ?? null,
        volumeNumber: node.volumeNumber ?? null,
        depth: node.depth,
        sortOrder: node.sortOrder,
        treePath: node.treePath,
        isCurrent: node.active,
        metadataJson: {
          url: node.url,
          parentTreePath: node.parentTreePath,
        },
        deletedAt: null,
      },
      update: {
        parentId,
        pageId,
        kind: node.kind,
        title: node.title,
        shamelaPath: nodeShamelaPath,
        shamelaPageNo: node.shamelaPageNo ?? null,
        volumeNumber: node.volumeNumber ?? null,
        depth: node.depth,
        sortOrder: node.sortOrder,
        isCurrent: node.active,
        metadataJson: {
          url: node.url,
          parentTreePath: node.parentTreePath,
        },
        deletedAt: null,
      },
      select: { id: true },
    });
    for (const child of node.children) {
      await upsertNode(child, row.id);
    }
  }

  for (const node of tocNodes) {
    await upsertNode(node, null);
  }

  return {
    bookId: book.id,
    book,
    tocNodeCount: flatNodes.length,
    pageStubCount: pageIdByPageNo.size,
  };
}

async function rebindPageAnnotations(
  db: any,
  pageId: number,
  previousParagraphs: { id: number; pid: number; text: string }[],
  nextParagraphs: { id: number; pid: number; text: string }[],
) {
  const nextByPid = new Map(
    nextParagraphs.map((paragraph) => [paragraph.pid, paragraph]),
  );
  const nextByText = new Map(
    nextParagraphs.map((paragraph) => [paragraph.text.trim(), paragraph]),
  );
  const previousById = new Map(
    previousParagraphs.map((paragraph) => [paragraph.id, paragraph]),
  );

  const rebindParagraph = (
    paragraphId: number | null | undefined,
    paragraphPid: number | null | undefined,
    quoteText: string | null | undefined,
  ) => {
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
  const shamelaBookUrl = input.sourceUrl
    ? getShamelaBookUrlFromUrl(input.sourceUrl)
    : null;
  const sourceShamelaBookId = getShamelaBookIdFromUrl(shamelaBookUrl);

  if (sourceShamelaBookId != null) {
    const targetBook = await db.book.findFirstOrThrow({
      where: { id: input.bookId, deletedAt: null },
      select: {
        id: true,
        shamelaId: true,
        shamelaUrl: true,
      },
    });
    const targetShamelaBookId =
      targetBook.shamelaId ?? getShamelaBookIdFromUrl(targetBook.shamelaUrl);

    if (
      targetShamelaBookId != null &&
      targetShamelaBookId !== sourceShamelaBookId
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This page belongs to a different Shamela book source.",
      });
    }
  }

  const resolvedShamelaPageNo =
    input.sourceUrl != null
      ? (getShamelaPageNoFromUrl(input.sourceUrl) ??
        input.pageData.shamelaPageNo)
      : input.pageData.shamelaPageNo;
  const pageData = {
    ...input.pageData,
    shamelaPageNo: resolvedShamelaPageNo,
  };
  const sourceStoragePath =
    getShamelaStoragePath(input.sourceUrl) ?? input.sourceUrl ?? "";
  const previousShamelaUrl =
    getShamelaStoragePath(pageData.previousShamelaUrl) ??
    pageData.previousShamelaUrl ??
    null;
  const nextShamelaUrl =
    getShamelaStoragePath(pageData.nextShamelaUrl) ??
    pageData.nextShamelaUrl ??
    null;
  const firstShamelaUrl =
    getShamelaStoragePath(pageData.firstShamelaUrl) ??
    pageData.firstShamelaUrl ??
    null;
  const lastShamelaUrl =
    getShamelaStoragePath(pageData.lastShamelaUrl) ??
    pageData.lastShamelaUrl ??
    null;
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
        shamelaUrl: sourceStoragePath,
        printedPageNo: pageData.printedPageNo ?? null,
        chapterTitle: pageData.chapterTitle ?? null,
        chapterUrl: pageData.chapterUrl ?? null,
        topicTitle: pageData.topicTitle ?? null,
        topicUrl: pageData.topicUrl ?? null,
        previousShamelaPageNo: pageData.previousShamelaPageNo ?? null,
        previousShamelaUrl,
        nextShamelaPageNo: pageData.nextShamelaPageNo ?? null,
        nextShamelaUrl,
        rawJson: pageData,
        status: "fetched",
      },
      update: {
        volumeId: input.volumeId ?? undefined,
        shamelaUrl: sourceStoragePath || (existingPage?.shamelaUrl ?? ""),
        printedPageNo: pageData.printedPageNo ?? null,
        chapterTitle: pageData.chapterTitle ?? null,
        chapterUrl: pageData.chapterUrl ?? null,
        topicTitle: pageData.topicTitle ?? null,
        topicUrl: pageData.topicUrl ?? null,
        previousShamelaPageNo: pageData.previousShamelaPageNo ?? null,
        previousShamelaUrl,
        nextShamelaPageNo: pageData.nextShamelaPageNo ?? null,
        nextShamelaUrl,
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

    await rebindPageAnnotations(
      db,
      page.id,
      previousParagraphs,
      nextParagraphs,
    );

    await db.book.update({
      where: { id: input.bookId },
      data: {
        contentHash: `${input.bookId}-${Date.now()}`,
        pagesUpdatedAt: new Date(),
        ...(pageData.firstShamelaPageNo || firstShamelaUrl
          ? {
              firstShamelaPageNo: pageData.firstShamelaPageNo ?? null,
              firstShamelaUrl,
            }
          : {}),
        ...(pageData.lastShamelaPageNo || lastShamelaUrl
          ? {
              lastShamelaPageNo: pageData.lastShamelaPageNo ?? null,
              lastShamelaUrl,
            }
          : {}),
        ...(shamelaBookUrl
          ? {
              sourceType: "shamela",
              editable: false,
              shamelaUrl:
                getShamelaBookStoragePath(shamelaBookUrl) ?? shamelaBookUrl,
            }
          : {}),
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
      errorMessage:
        error instanceof Error ? error.message : "Page import failed",
    });
    throw error;
  }
}

async function syncBookFromShamelaInternal(
  db: any,
  input: {
    shamelaUrl: string;
    aiProvider: AiProvider;
    aiModel?: ImportAiModel;
  },
) {
  const { normalizedUrl, shamelaId, bookIndexUrl, linkedPageUrl } =
    getShamelaBookInfo(input.shamelaUrl);
  const bookStoragePath =
    getShamelaBookStoragePath(bookIndexUrl) ?? bookIndexUrl;

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
          sourceType: "shamela",
          editable: false,
          category: meta.category ?? undefined,
          categoryUrl: meta.categoryUrl ?? undefined,
          coverColor: meta.coverColor ?? undefined,
          shelfId: shelfId ?? undefined,
          shamelaUrl: bookStoragePath,
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
          ownerUserId: getDefaultBookUserId(),
          sourceType: "shamela",
          editable: false,
          shamelaId,
          shamelaUrl: bookStoragePath,
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
      const { page, historyId: pageImportHistoryId } = await saveParsedPageData(
        db,
        {
          bookId: book.id,
          pageData,
          sourceUrl: linkedPageUrl,
          importMethod: existing ? "reimport_url" : "link_url",
          provider: input.aiProvider,
        },
      );

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

export async function previewBookImportFromShamelaInternal(input: {
  shamelaUrl: string;
  aiProvider: AiProvider;
  aiModel?: ImportAiModel;
}) {
  const { normalizedUrl, shamelaId, bookIndexUrl, linkedPageUrl } =
    getShamelaBookInfo(input.shamelaUrl);

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
    aiModel:
      input.aiModel ?? (input.aiProvider === "gemini" ? "gemini" : "gpt-5"),
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
  if (
    !isShamelaUrlOrPath(input.finalUrl || input.requestedUrl) ||
    getShamelaBookIdFromUrl(input.finalUrl || input.requestedUrl) == null
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only Shamela book pages can be captured here.",
    });
  }

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
      ...getPreviewSafeShamelaDocument(parsed.document),
      diagnostics: [...parsed.document.diagnostics, ...dbWarnings],
    },
    facts: getPreviewSafeShamelaFacts(parsed.facts),
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
              ?.text ??
            parsed.document.context.currentTopic?.label ??
            null,
          chapterUrl:
            parsed.document.context.currentTopic?.href ?? input.finalUrl,
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

async function promoteStagedShamelaPageParseInternal(
  db: any,
  input: { stagedParseId: number; bookId?: number | null },
) {
  const staged = await db.shamelaStagedPageParse.findFirstOrThrow({
    where: { id: input.stagedParseId },
    include: {
      rawPage: {
        select: {
          id: true,
          requestedUrl: true,
          finalUrl: true,
          title: true,
          html: true,
          htmlHash: true,
        },
      },
    },
  });

  if (staged.status === "promoted" && staged.promotedPageId) {
    const promotedPage = await db.bookPage.findFirst({
      where: { id: staged.promotedPageId, deletedAt: null },
    });
    if (promotedPage) {
      return {
        bookId: promotedPage.bookId,
        page: promotedPage,
        historyId: null,
        diffSummaryJson: null,
      };
    }
  }

  const reparsed = parseShamelaOpenPage({
    html: staged.rawPage.html,
    requestedUrl: staged.rawPage.requestedUrl,
    finalUrl: staged.rawPage.finalUrl,
    title: staged.rawPage.title,
    capturedAt: staged.createdAt?.toISOString() ?? null,
    htmlHash: staged.rawPage.htmlHash,
  });

  const document = reparsed.document;
  const meta = isRecord(document?.meta) ? (document.meta as any) : {};
  const linkGraph = isRecord(staged.linkGraphJson)
    ? (staged.linkGraphJson as any)
    : {};
  const shamelaBookId =
    typeof meta.shamelaBookId === "number" ? meta.shamelaBookId : null;
  let bookId =
    input.bookId ??
    staged.bookId ??
    (typeof linkGraph.matchedBookId === "number"
      ? linkGraph.matchedBookId
      : null);

  if (!bookId && shamelaBookId) {
    const existingBook = await db.book.findFirst({
      where: { shamelaId: shamelaBookId, deletedAt: null },
      select: { id: true },
    });
    bookId = existingBook?.id ?? null;
  }

  const treeSync = await syncParsedShamelaBookTree(db, {
    explicitBookId: bookId,
    parsed: reparsed,
    fallbackTitle:
      safeString(staged.rawPage.title) ??
      safeString(staged.chapterTitle) ??
      safeString(staged.topicTitle),
    finalUrl: staged.rawPage.finalUrl,
  });
  bookId = treeSync.bookId;

  let volumeId: number | null = null;
  const parsedVolumeNumber =
    typeof meta.volumeNumber === "number"
      ? meta.volumeNumber
      : staged.volumeNumber;
  if (typeof parsedVolumeNumber === "number") {
    const volume = await db.bookVolume.upsert({
      where: { bookId_number: { bookId, number: parsedVolumeNumber } },
      create: { bookId, number: parsedVolumeNumber, title: null },
      update: {},
    });
    volumeId = volume.id;
  }

  const paragraphBlocks = document.content.filter(
    (block) => block.type === "paragraph",
  );
  const footnoteBlocks = document.content.filter(
    (block) => block.type === "footnote",
  );
  const pageData: ParsedPageData = {
    shamelaPageNo:
      (typeof meta.shamelaPageNo === "number" ? meta.shamelaPageNo : null) ??
      staged.shamelaPageNo ??
      getShamelaPageNoFromUrl(staged.rawPage.finalUrl) ??
      getShamelaPageNoFromUrl(staged.rawPage.requestedUrl) ??
      1,
    printedPageNo:
      (typeof meta.printedPageNo === "number" ? meta.printedPageNo : null) ??
      staged.printedPageNo ??
      null,
    chapterTitle:
      document.context.currentTopic?.label ?? staged.chapterTitle ?? null,
    chapterUrl:
      document.context.currentTopic?.href ?? staged.chapterUrl ?? null,
    topicTitle:
      document.context.currentTopic?.label ?? staged.topicTitle ?? null,
    topicUrl: document.context.currentTopic?.href ?? staged.topicUrl ?? null,
    previousShamelaPageNo:
      (typeof meta.previousShamelaPageNo === "number"
        ? meta.previousShamelaPageNo
        : null) ??
      document.context.adjacentPages?.previous?.shamelaPageNo ??
      null,
    previousShamelaUrl: document.context.adjacentPages?.previous?.href ?? null,
    nextShamelaPageNo:
      (typeof meta.nextShamelaPageNo === "number"
        ? meta.nextShamelaPageNo
        : null) ??
      document.context.adjacentPages?.next?.shamelaPageNo ??
      null,
    nextShamelaUrl: document.context.adjacentPages?.next?.href ?? null,
    firstShamelaPageNo:
      document.context.adjacentPages?.first?.shamelaPageNo ?? null,
    firstShamelaUrl: document.context.adjacentPages?.first?.href ?? null,
    lastShamelaPageNo:
      document.context.adjacentPages?.last?.shamelaPageNo ?? null,
    lastShamelaUrl: document.context.adjacentPages?.last?.href ?? null,
    paragraphs: paragraphBlocks
      .filter((block) => block?.type === "paragraph" && safeString(block.text))
      .map((block, index) => ({
        pid: index + 1,
        text: String(block.text),
        footnoteIds:
          Array.isArray(block.footnoteRefs) && block.footnoteRefs.length
            ? block.footnoteRefs.join(",")
            : null,
      })),
    footnotes: footnoteBlocks
      .filter((block) => block?.type === "footnote" && safeString(block.text))
      .map((block, index) => ({
        marker: safeString(block.marker) ?? String(index + 1),
        type: "footnote",
        content: String(block.text),
        linkedParagraphs: null,
      })),
  };

  const result = await saveParsedPageData(db, {
    bookId,
    pageData,
    sourceUrl: staged.rawPage.finalUrl,
    volumeId,
    importMethod: "mobile_webview_capture",
    provider: "webview",
    rawInput: `shamelaRawPage:${staged.rawPage.id}`,
  });

  await db.shamelaStagedPageParse.update({
    where: { id: staged.id },
    data: {
      bookId,
      promotedPageId: result.page.id,
      status: "promoted",
    },
  });

  return {
    bookId,
    page: result.page,
    historyId: result.historyId,
    diffSummaryJson: result.diffSummaryJson,
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
          albumReferences: {
            where: { deletedAt: null },
            include: {
              album: { select: { id: true, name: true, albumType: true } },
            },
          },
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
      const book = await ctx.db.book.findFirstOrThrow({
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
              previousShamelaPageNo: true,
              previousShamelaUrl: true,
              nextShamelaPageNo: true,
              nextShamelaUrl: true,
              status: true,
              volumeId: true,
            },
          },
        },
      });
      const tocDelegate = (ctx.db as any).bookTocNode;
      let tocNodes: any[] = [];
      if (tocDelegate) {
        try {
          tocNodes = await tocDelegate.findMany({
            where: { bookId: input.id, deletedAt: null },
            orderBy: [{ depth: "asc" }, { sortOrder: "asc" }],
            select: {
              id: true,
              parentId: true,
              pageId: true,
              kind: true,
              title: true,
              shamelaPath: true,
              shamelaPageNo: true,
              volumeNumber: true,
              depth: true,
              sortOrder: true,
              treePath: true,
              isCurrent: true,
              page: {
                select: {
                  id: true,
                  status: true,
                  shamelaUrl: true,
                  printedPageNo: true,
                  volumeId: true,
                },
              },
            },
          });
        } catch (error) {
          console.warn("[Book] tocNodes unavailable for getBook", error);
        }
      }

      return { ...book, tocNodes };
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
      const userId = getCurrentBookUserId(ctx);
      const normalizedShamelaUrl = normalizeShamelaUrlInput(input.shamelaUrl);
      const isImportedSource = isShamelaSource({
        shamelaId: input.shamelaId,
        shamelaUrl: normalizedShamelaUrl,
      });

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
          ownerUserId: userId,
          sourceType: isImportedSource ? "shamela" : "user",
          editable: !isImportedSource,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          shelfId: input.shelfId,
          shamelaUrl: normalizedShamelaUrl,
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
      await assertBookEditableById(db, id, getCurrentBookUserId(ctx));
      const normalizedShamelaUrl = normalizeShamelaUrlInput(rest.shamelaUrl);
      const isImportedSource = isShamelaSource({
        shamelaId: rest.shamelaId,
        shamelaUrl: normalizedShamelaUrl,
      });
      const updateData = {
        ...rest,
        ...(rest.shamelaUrl !== undefined
          ? { shamelaUrl: normalizedShamelaUrl }
          : {}),
        ...(isImportedSource
          ? {
              sourceType: "shamela",
              editable: false,
            }
          : {}),
      };

      const book = await db.book.update({
        where: { id },
        data: updateData,
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
      const page = await ctx.db.bookPage.findFirstOrThrow({
        where: { id: input.pageId, deletedAt: null },
        include: {
          paragraphs: { orderBy: { pid: "asc" } },
          footnotes: { orderBy: { marker: "asc" } },
          highlights: { orderBy: { startOffset: "asc" } },
          audioReferences: {
            where: { deletedAt: null },
            include: {
              media: {
                select: {
                  id: true,
                  title: true,
                  file: {
                    select: { id: true, fileName: true, duration: true },
                  },
                  album: { select: { id: true, name: true } },
                  blog: { select: { id: true, content: true } },
                },
              },
            },
          },
          comments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
          volume: { select: { id: true, number: true, title: true } },
          book: {
            select: {
              id: true,
              sourceType: true,
              editable: true,
              ownerUserId: true,
              shamelaId: true,
              shamelaUrl: true,
            },
          },
        },
      });
      const previousPageNo =
        page.previousShamelaPageNo ??
        (page.previousShamelaUrl
          ? getShamelaPageNoFromUrl(page.previousShamelaUrl)
          : null);
      const nextPageNo =
        page.nextShamelaPageNo ??
        (page.nextShamelaUrl ? getShamelaPageNoFromUrl(page.nextShamelaUrl) : null);
      const previousUrl = page.previousShamelaUrl ?? null;
      const nextUrl =
        page.nextShamelaUrl ?? null;
      const adjacentRows = await ctx.db.bookPage.findMany({
        where: {
          bookId: page.bookId,
          shamelaPageNo: {
            in: [previousPageNo, nextPageNo].filter(
              (value): value is number => typeof value === "number",
            ),
          },
          deletedAt: null,
        },
        select: {
          id: true,
          shamelaPageNo: true,
          shamelaUrl: true,
          status: true,
        },
      });
      const adjacentByPageNo = new Map(
        adjacentRows.map((row) => [row.shamelaPageNo, row]),
      );

      return {
        ...page,
        adjacentPages: {
          previous: {
            shamelaPageNo: previousPageNo,
            shamelaUrl: previousUrl,
            page: previousPageNo
              ? (adjacentByPageNo.get(previousPageNo) ?? null)
              : null,
          },
          next: {
            shamelaPageNo: nextPageNo,
            shamelaUrl: nextUrl,
            page: nextPageNo ? (adjacentByPageNo.get(nextPageNo) ?? null) : null,
          },
        },
      };
    }),

  getReaderWindow: publicProcedure
    .input(readerWindowInput)
    .query(async ({ ctx, input }) => {
      const openedPage = await ctx.db.bookPage.findFirstOrThrow({
        where: { id: input.pageId, deletedAt: null },
        select: {
          id: true,
          bookId: true,
          shamelaPageNo: true,
          shamelaUrl: true,
          previousShamelaPageNo: true,
          previousShamelaUrl: true,
          nextShamelaPageNo: true,
          nextShamelaUrl: true,
        },
      });

      let centerPageNo = openedPage.shamelaPageNo;
      let centerPageId = openedPage.id;
      let centerReferenceId: number | null = null;

      if (input.referenceId) {
        const reference = await ctx.db.mediaBookPageReference.findFirst({
          where: {
            id: input.referenceId,
            bookId: openedPage.bookId,
            deletedAt: null,
          },
          include: {
            page: { select: { id: true, shamelaPageNo: true } },
          },
        });
        if (reference?.page) {
          centerPageNo = reference.page.shamelaPageNo;
          centerPageId = reference.page.id;
          centerReferenceId = reference.id;
        }
      }
      if (!centerReferenceId && input.mediaId && input.centerSec != null) {
        const references = await ctx.db.mediaBookPageReference.findMany({
          where: {
            mediaId: input.mediaId,
            bookId: openedPage.bookId,
            deletedAt: null,
            startSec: { not: null },
          },
          include: {
            page: { select: { id: true, shamelaPageNo: true } },
          },
          take: 200,
        });
        const nearest = references
          .filter((reference) => reference.page && reference.startSec != null)
          .sort(
            (a, b) =>
              Math.abs((a.startSec ?? 0) - input.centerSec!) -
              Math.abs((b.startSec ?? 0) - input.centerSec!),
          )[0];
        if (nearest?.page) {
          centerPageNo = nearest.page.shamelaPageNo;
          centerPageId = nearest.page.id;
          centerReferenceId = nearest.id;
        }
      }

      const cursor = input.cursor ?? centerPageNo;
      const pageWhere =
        input.direction === "previous"
          ? { lt: cursor }
          : input.direction === "next"
            ? { gt: cursor }
            : {
                gte: Math.max(0, centerPageNo - input.radius),
                lte: centerPageNo + input.radius,
              };
      const take =
        input.direction === "initial" ? input.radius * 2 + 1 : input.radius;
      const orderBy =
        input.direction === "previous"
          ? ({ shamelaPageNo: "desc" } as const)
          : ({ shamelaPageNo: "asc" } as const);

      const rows = await ctx.db.bookPage.findMany({
        where: {
          bookId: openedPage.bookId,
          deletedAt: null,
          shamelaPageNo: pageWhere,
        },
        orderBy,
        take,
        include: {
          paragraphs: { orderBy: { pid: "asc" } },
          footnotes: { orderBy: { marker: "asc" } },
          highlights: { orderBy: { startOffset: "asc" } },
          audioReferences: {
            where: { deletedAt: null },
            include: {
              media: {
                select: {
                  id: true,
                  title: true,
                  file: {
                    select: { id: true, fileName: true, duration: true },
                  },
                  album: { select: { id: true, name: true } },
                  blog: { select: { id: true, content: true } },
                },
              },
            },
          },
          comments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
          volume: { select: { id: true, number: true, title: true } },
          book: {
            select: {
              id: true,
              sourceType: true,
              editable: true,
              ownerUserId: true,
              shamelaId: true,
              shamelaUrl: true,
            },
          },
        },
      });
      const data =
        input.direction === "previous"
          ? [...rows].reverse()
          : rows;
      const first = data[0];
      const last = data[data.length - 1];

      const [previousCount, nextCount] = await Promise.all([
        first
          ? ctx.db.bookPage.count({
              where: {
                bookId: openedPage.bookId,
                deletedAt: null,
                shamelaPageNo: { lt: first.shamelaPageNo },
              },
            })
          : Promise.resolve(0),
        last
          ? ctx.db.bookPage.count({
              where: {
                bookId: openedPage.bookId,
                deletedAt: null,
                shamelaPageNo: { gt: last.shamelaPageNo },
              },
            })
          : Promise.resolve(0),
      ]);

      return {
        data,
        meta: {
          activePageId: centerPageId,
          centerPageNo,
          centerReferenceId,
          previousCursor: previousCount > 0 ? first?.shamelaPageNo : null,
          nextCursor: nextCount > 0 ? last?.shamelaPageNo : null,
        },
      };
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
        contentUpdatedAt:
          content.contentUpdatedAt ?? page.updatedAt?.toISOString() ?? null,
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
      await assertPageBookEditable(
        ctx.db,
        input.pageId,
        getCurrentBookUserId(ctx),
      );
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
      const contentHtml =
        input.contentHtml ?? serializeDocumentToHtml(document);
      const plainText = input.plainText ?? getDocumentPlainText(document);
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

      await ctx.db.bookPageParagraph.deleteMany({
        where: { pageId: input.pageId },
      });
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

      return history
        .filter((entry) => {
          const key = getBookImportHistoryKey(entry);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, input.limit);
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
        shamelaUrl: z.string().min(1),
        volumeId: z.number().optional(),
        aiProvider: z.enum(["anthropic", "openai", "gemini"]).default("openai"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const sourceUrl = buildShamelaPageSourceUrl(input.shamelaUrl);
      const aiResult = await callAI(
        input.aiProvider,
        SHAMELA_EXTRACT_PROMPT,
        4096,
        sourceUrl,
      );
      const pageData = parsePageData(aiResult.text);
      const { page, historyId, diffSummaryJson } = await saveParsedPageData(
        db,
        {
          bookId: input.bookId,
          pageData,
          sourceUrl,
          volumeId: input.volumeId ?? null,
          importMethod: "reimport_url",
          provider: input.aiProvider,
        },
      );

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
        direction: z.enum(["previous", "next"]).default("next"),
        aiProvider: z.enum(["anthropic", "openai", "gemini"]).default("openai"),
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

      const storedAdjacentUrl =
        input.direction === "previous"
          ? currentPage.previousShamelaUrl
          : currentPage.nextShamelaUrl;
      const targetPageNo =
        input.direction === "previous"
          ? (currentPage.previousShamelaPageNo ??
            (storedAdjacentUrl ? getShamelaPageNoFromUrl(storedAdjacentUrl) : null))
          : (currentPage.nextShamelaPageNo ??
            (storedAdjacentUrl ? getShamelaPageNoFromUrl(storedAdjacentUrl) : null));
      const nextExistingPage = await db.bookPage.findFirst({
        where: {
          bookId: input.bookId,
          ...(targetPageNo == null
            ? { id: -1 }
            : { shamelaPageNo: targetPageNo }),
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

      const nextUrlCandidate =
        storedAdjacentUrl ||
        nextExistingPage?.shamelaUrl;

      if (!nextUrlCandidate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No Shamela link is available to import the next page.",
        });
      }
      const nextUrl = buildShamelaPageSourceUrl(nextUrlCandidate);

      const aiResult = await callAI(
        input.aiProvider,
        SHAMELA_EXTRACT_PROMPT,
        4096,
        nextUrl,
      );
      const pageData = parsePageData(aiResult.text);
      const { page, historyId, diffSummaryJson } = await saveParsedPageData(
        db,
        {
          bookId: input.bookId,
          pageData,
          sourceUrl: nextUrl,
          volumeId: currentPage.volumeId ?? null,
          importMethod: "reimport_url",
          provider: input.aiProvider,
        },
      );

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
      let createdBookNow = false;

      try {
        if (!bookId && !input.createBook) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Select an existing book or create a new one first.",
          });
        }

        if (!bookId && input.createBook) {
          const normalizedShamelaUrl = normalizeShamelaUrlInput(
            input.createBook.shamelaUrl,
          );
          const isImportedSource = isShamelaSource({
            shamelaUrl: normalizedShamelaUrl,
          });
          const createdBook = await ctx.db.book.create({
            data: {
              blog: {
                create: {
                  type: "book",
                  content:
                    input.createBook.description ?? input.createBook.nameAr,
                  published: true,
                  status: "published",
                },
              },
              ownerUserId: getCurrentBookUserId(ctx),
              sourceType: isImportedSource ? "shamela" : "user",
              editable: !isImportedSource,
              nameAr: input.createBook.nameAr,
              nameEn: input.createBook.nameEn ?? undefined,
              shamelaUrl: normalizedShamelaUrl,
            },
          });
          bookId = createdBook.id;
          createdBookNow = true;
        }

        if (bookId && !createdBookNow) {
          await assertBookEditableById(db, bookId, getCurrentBookUserId(ctx));
        }

        const shamelaPageNo =
          input.shamelaPageNo ??
          ((
            await db.bookPage.aggregate({
              where: { bookId },
              _max: { shamelaPageNo: true },
            })
          )._max.shamelaPageNo ?? 0) + 1;

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
        select: {
          id: true,
          shamelaId: true,
          shamelaUrl: true,
          sourceType: true,
          editable: true,
          ownerUserId: true,
          contentHash: true,
          pagesUpdatedAt: true,
        },
      });
      const totalCount = await ctx.db.bookPage.count({
        where: { bookId: input.id, deletedAt: null },
      });
      const fetchedCount = await ctx.db.bookPage.count({
        where: { bookId: input.id, status: "fetched", deletedAt: null },
      });
      return {
        id: book.id,
        shamelaId: book.shamelaId,
        shamelaUrl: book.shamelaUrl,
        sourceType: book.sourceType,
        editable: book.editable,
        ownerUserId: book.ownerUserId,
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
          shamelaUrl: true,
          firstShamelaPageNo: true,
          firstShamelaUrl: true,
          lastShamelaPageNo: true,
          lastShamelaUrl: true,
          sourceType: true,
          editable: true,
          ownerUserId: true,
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
          previousShamelaPageNo: true,
          previousShamelaUrl: true,
          nextShamelaPageNo: true,
          nextShamelaUrl: true,
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
      let tocNodes: any[] = [];
      const tocDelegate = (db as any).bookTocNode;
      if (tocDelegate) {
        try {
          tocNodes = await tocDelegate.findMany({
            where: { bookId: input.bookId, deletedAt: null },
            select: {
              id: true,
              bookId: true,
              parentId: true,
              pageId: true,
              kind: true,
              title: true,
              shamelaPath: true,
              shamelaPageNo: true,
              volumeNumber: true,
              depth: true,
              sortOrder: true,
              treePath: true,
              isCurrent: true,
            },
            orderBy: [{ depth: "asc" }, { sortOrder: "asc" }],
          });
        } catch (error) {
          console.warn("[Book] tocNodes unavailable for download", error);
        }
      }
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
      return { book, volumes, pages, tocNodes, highlights, comments };
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

  getAudioReferencesForPage: publicProcedure
    .input(z.object({ pageId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db as any;
      return db.mediaBookPageReference.findMany({
        where: { pageId: input.pageId, deletedAt: null },
        orderBy: [{ startSec: "asc" }, { createdAt: "desc" }],
        include: {
          media: {
            select: {
              id: true,
              title: true,
              file: { select: { id: true, fileName: true, duration: true } },
              album: { select: { id: true, name: true } },
              blog: { select: { id: true, content: true } },
            },
          },
          book: {
            select: {
              id: true,
              nameAr: true,
              nameEn: true,
            },
          },
        },
      });
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
        bookId: staged.bookId,
        promotedPageId: staged.promotedPageId,
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

  promoteStagedShamelaPageParse: publicProcedure
    .input(
      z.object({
        stagedParseId: z.number(),
        bookId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      promoteStagedShamelaPageParseInternal(ctx.db, {
        stagedParseId: input.stagedParseId,
        bookId: input.bookId ?? null,
      }),
    ),

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
