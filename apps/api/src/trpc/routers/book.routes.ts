import { createTRPCRouter, publicProcedure } from "../init";
import { z } from "zod";

const SHAMELA_EXTRACT_PROMPT = `You are a structured data extractor for Islamic books from Shamela (the largest Islamic digital library).

Given an HTML page from Shamela, extract the book page content and return it as a JSON object with this exact shape:

{
  "shamelaPageNo": <number — the page ID from the URL or page metadata>,
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

interface AiResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Call an AI provider with either a raw URL (Anthropic fetches it natively)
 * or pre-fetched HTML for OpenAI/Gemini.
 */
async function callAI(
  provider: AiProvider,
  prompt: string,
  maxTokens: number,
  sourceUrl?: string, // if provided, Anthropic uses URL natively; others fetch HTML
): Promise<AiResult> {
  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const userContent: any[] = sourceUrl
      ? [
          // Let Claude fetch the URL directly — avoids server-side Shamela blocks
          { type: "document", source: { type: "url", url: sourceUrl } },
          { type: "text", text: prompt },
        ]
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
    if (!res.ok)
      throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      text: data.content?.[0]?.text ?? "",
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      model: "claude-sonnet-4-6",
    };
  }

  // For OpenAI / Gemini: embed the URL in the prompt and let the AI handle it
  const fullPrompt = sourceUrl
    ? `${prompt}\n\n<SOURCE_URL>${sourceUrl}</SOURCE_URL>`
    : prompt;

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: fullPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      model: "gpt-4o",
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
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    const meta = data.usageMetadata ?? {};
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      inputTokens: meta.promptTokenCount ?? 0,
      outputTokens: meta.candidatesTokenCount ?? 0,
      model: "gemini-2.0-flash",
    };
  }

  throw new Error(`Unknown AI provider: ${provider}`);
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
): Promise<number> {
  let result: AiResult;
  try {
    result = await callAI(provider, SHAMELA_TOC_EXTRACT_PROMPT, 8192, bookUrl);
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
    toc = JSON.parse(result.text);
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

  fetchPage: publicProcedure
    .input(
      z.object({
        bookId: z.number(),
        shamelaUrl: z.string().url(),
        volumeId: z.number().optional(),
        aiProvider: z
          .enum(["anthropic", "openai", "gemini"])
          .default("anthropic"),
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

      let pageData: any;
      try {
        pageData = JSON.parse(aiResult.text);
      } catch {
        throw new Error(
          `Failed to parse AI response: ${aiResult.text.slice(0, 200)}`,
        );
      }

      const page = await db.bookPage.upsert({
        where: {
          bookId_shamelaPageNo: {
            bookId: input.bookId,
            shamelaPageNo: pageData.shamelaPageNo,
          },
        },
        create: {
          bookId: input.bookId,
          volumeId: input.volumeId ?? null,
          shamelaPageNo: pageData.shamelaPageNo,
          shamelaUrl: input.shamelaUrl,
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
          shamelaUrl: input.shamelaUrl,
          printedPageNo: pageData.printedPageNo ?? null,
          chapterTitle: pageData.chapterTitle ?? null,
          chapterUrl: pageData.chapterUrl ?? null,
          topicTitle: pageData.topicTitle ?? null,
          topicUrl: pageData.topicUrl ?? null,
          rawJson: pageData,
          status: "fetched",
          deletedAt: null,
        },
      });

      await db.bookPageParagraph.deleteMany({ where: { pageId: page.id } });
      if (
        Array.isArray(pageData.paragraphs) &&
        pageData.paragraphs.length > 0
      ) {
        await db.bookPageParagraph.createMany({
          data: pageData.paragraphs.map((p: any) => ({
            pageId: page.id,
            pid: p.pid,
            text: p.text,
            footnoteIds: p.footnoteIds ?? null,
          })),
        });
      }

      await db.bookPageFootnote.deleteMany({ where: { pageId: page.id } });
      if (Array.isArray(pageData.footnotes) && pageData.footnotes.length > 0) {
        await db.bookPageFootnote.createMany({
          data: pageData.footnotes.map((f: any) => ({
            pageId: page.id,
            marker: f.marker,
            type: f.type ?? null,
            content: f.content,
            linkedParagraphs: f.linkedParagraphs ?? null,
          })),
        });
      }

      await db.book.update({
        where: { id: input.bookId },
        data: {
          contentHash: `${input.bookId}-${Date.now()}`,
          pagesUpdatedAt: new Date(),
        },
      });

      await recordTokenUsage(
        db,
        aiResult,
        input.aiProvider,
        "page_fetch",
        input.bookId,
        page.id,
      );

      return page;
    }),

  fetchNextPage: publicProcedure
    .input(
      z.object({
        bookId: z.number(),
        currentShamelaPageNo: z.number(),
        aiProvider: z
          .enum(["anthropic", "openai", "gemini"])
          .default("anthropic"),
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

      const nextPageNo = input.currentShamelaPageNo + 1;
      const nextUrl = currentPage.shamelaUrl.replace(
        /\/(\d+)(\/?$)/,
        `/${nextPageNo}$2`,
      );

      const aiResult = await callAI(
        input.aiProvider,
        SHAMELA_EXTRACT_PROMPT,
        4096,
        nextUrl,
      );

      let pageData: any;
      try {
        pageData = JSON.parse(aiResult.text);
      } catch {
        throw new Error(
          `Failed to parse AI response: ${aiResult.text.slice(0, 200)}`,
        );
      }

      const page = await db.bookPage.upsert({
        where: {
          bookId_shamelaPageNo: {
            bookId: input.bookId,
            shamelaPageNo: pageData.shamelaPageNo,
          },
        },
        create: {
          bookId: input.bookId,
          volumeId: currentPage.volumeId,
          shamelaPageNo: pageData.shamelaPageNo,
          shamelaUrl: nextUrl,
          printedPageNo: pageData.printedPageNo ?? null,
          chapterTitle: pageData.chapterTitle ?? null,
          chapterUrl: pageData.chapterUrl ?? null,
          topicTitle: pageData.topicTitle ?? null,
          topicUrl: pageData.topicUrl ?? null,
          rawJson: pageData,
          status: "fetched",
        },
        update: {
          shamelaUrl: nextUrl,
          printedPageNo: pageData.printedPageNo ?? null,
          chapterTitle: pageData.chapterTitle ?? null,
          chapterUrl: pageData.chapterUrl ?? null,
          topicTitle: pageData.topicTitle ?? null,
          topicUrl: pageData.topicUrl ?? null,
          rawJson: pageData,
          status: "fetched",
          deletedAt: null,
        },
      });

      await db.bookPageParagraph.deleteMany({ where: { pageId: page.id } });
      if (
        Array.isArray(pageData.paragraphs) &&
        pageData.paragraphs.length > 0
      ) {
        await db.bookPageParagraph.createMany({
          data: pageData.paragraphs.map((p: any) => ({
            pageId: page.id,
            pid: p.pid,
            text: p.text,
            footnoteIds: p.footnoteIds ?? null,
          })),
        });
      }

      await db.bookPageFootnote.deleteMany({ where: { pageId: page.id } });
      if (Array.isArray(pageData.footnotes) && pageData.footnotes.length > 0) {
        await db.bookPageFootnote.createMany({
          data: pageData.footnotes.map((f: any) => ({
            pageId: page.id,
            marker: f.marker,
            type: f.type ?? null,
            content: f.content,
            linkedParagraphs: f.linkedParagraphs ?? null,
          })),
        });
      }

      await db.book.update({
        where: { id: input.bookId },
        data: {
          contentHash: `${input.bookId}-${Date.now()}`,
          pagesUpdatedAt: new Date(),
        },
      });

      await recordTokenUsage(
        db,
        aiResult,
        input.aiProvider,
        "page_fetch_next",
        input.bookId,
        page.id,
      );

      return page;
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
      return ctx.db.bookPageHighlight.create({
        data: { ...input, userId: 1 },
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
      return ctx.db.bookPageComment.create({
        data: { ...input, userId: 1 },
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
        where: { page: { bookId: input.bookId }, userId: 1 },
        select: {
          id: true,
          pageId: true,
          paragraphId: true,
          color: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const comments = await db.bookPageComment.findMany({
        where: { page: { bookId: input.bookId }, userId: 1, deletedAt: null },
        select: {
          id: true,
          pageId: true,
          paragraphId: true,
          content: true,
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
        where: { page: { bookId: input.bookId }, userId: 1 },
        select: {
          id: true,
          pageId: true,
          paragraphId: true,
          color: true,
          note: true,
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
            color: z.string(),
            note: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: { localId: string; serverId: number }[] = [];
      for (const h of input.highlights) {
        const created = await ctx.db.bookPageHighlight.create({
          data: {
            pageId: h.pageId,
            paragraphId: h.paragraphId ?? null,
            color: h.color,
            note: h.note ?? null,
            userId: 1,
            startOffset: 0,
            endOffset: 0,
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
        where: { page: { bookId: input.bookId }, userId: 1, deletedAt: null },
        select: {
          id: true,
          pageId: true,
          paragraphId: true,
          content: true,
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
        const created = await ctx.db.bookPageComment.create({
          data: {
            pageId: c.pageId,
            paragraphId: c.paragraphId ?? null,
            content: c.content,
            userId: 1,
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
        aiProvider: z
          .enum(["anthropic", "openai", "gemini"])
          .default("anthropic"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Normalise URL — strip trailing slash, page numbers, query string
      const url = new URL(input.shamelaUrl.trim());
      const bookUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, "");

      // Extract shamelaId from path  e.g. /book/12345  or /book/12345/67
      const match = bookUrl.match(/\/book\/(\d+)/);
      if (!match)
        throw new Error("Invalid Shamela URL — expected a /book/... path");
      const shamelaId = Number(match[1]);

      // Use the canonical book index URL (no page number)
      const bookIndexUrl = `${url.origin}/book/${shamelaId}`;

      // ── Check if book already exists ──────────────────────────────────────
      const existing = await db.book.findFirst({
        where: { shamelaId, deletedAt: null },
        include: {
          blog: { select: { id: true } },
          authors: true,
          shelf: true,
        },
      });

      // ── Call AI for book metadata ─────────────────────────────────────────
      const metaResult = await callAI(
        input.aiProvider,
        SHAMELA_BOOK_META_PROMPT,
        1024,
        bookIndexUrl,
      );

      let meta: {
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
      try {
        meta = JSON.parse(metaResult.text);
      } catch {
        throw new Error(
          `Failed to parse AI response: ${metaResult.text.slice(0, 200)}`,
        );
      }

      // ── Upsert shelf ──────────────────────────────────────────────────────
      let shelfId: number | undefined;
      if (meta.shelfName) {
        const shelf = await db.bookShelf.upsert({
          where: { name: meta.shelfName } as any,
          create: { name: meta.shelfName, nameAr: meta.shelfName },
          update: {},
        });
        shelfId = shelf.id;
      }

      // ── Upsert author ─────────────────────────────────────────────────────
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

      if (existing) {
        // ── UPDATE existing book ───────────────────────────────────────────
        await db.blog.update({
          where: { id: existing.blog.id },
          data: {
            content: meta.description ?? existing.blog.id.toString(),
          },
        });

        const updated = await db.book.update({
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

        await recordTokenUsage(
          db,
          metaResult,
          input.aiProvider,
          "book_meta_sync",
          existing.id,
        );
        const chaptersImported = await syncToc(
          db,
          existing.id,
          bookIndexUrl,
          input.aiProvider,
        );
        return { book: updated, created: false, chaptersImported };
      } else {
        // ── CREATE new book ────────────────────────────────────────────────
        const blog = await db.blog.create({
          data: {
            type: "book",
            content: meta.description ?? meta.nameAr,
            published: true,
            status: "published",
          },
        });

        const book = await db.book.create({
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
        );
        return { book, created: true, chaptersImported };
      }
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
