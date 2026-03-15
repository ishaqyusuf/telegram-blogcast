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

function extractHashTags(text: string): string[] {
  const matches = text.match(/#([\p{L}\p{N}_][^\s#]*)/gu) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).trim()))];
}

async function attachTags(
  db: any,
  blogId: number,
  description: string
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
      })
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
      })
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
      })
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
      })
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
      })
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // 1. Fetch the Shamela HTML
      const htmlRes = await fetch(input.shamelaUrl);
      const html = await htmlRes.text();

      // 2. Call Claude to extract structured page data
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `${SHAMELA_EXTRACT_PROMPT}\n\n<SHAMELA_PAGE_URL>${input.shamelaUrl}</SHAMELA_PAGE_URL>\n\n<PAGE_HTML>${html.slice(0, 40000)}</PAGE_HTML>`,
            },
          ],
        }),
      });

      if (!claudeRes.ok) {
        throw new Error(`Claude API error: ${claudeRes.status}`);
      }

      const claudeData = await claudeRes.json();
      const rawText = claudeData.content?.[0]?.text ?? "";
      let pageData: any;
      try {
        pageData = JSON.parse(rawText);
      } catch {
        throw new Error(`Failed to parse Claude response: ${rawText.slice(0, 200)}`);
      }

      // 3. Upsert BookPage
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

      // 4. Replace paragraphs
      await db.bookPageParagraph.deleteMany({ where: { pageId: page.id } });
      if (Array.isArray(pageData.paragraphs) && pageData.paragraphs.length > 0) {
        await db.bookPageParagraph.createMany({
          data: pageData.paragraphs.map((p: any) => ({
            pageId: page.id,
            pid: p.pid,
            text: p.text,
            footnoteIds: p.footnoteIds ?? null,
          })),
        });
      }

      // 5. Replace footnotes
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

      return page;
    }),

  fetchNextPage: publicProcedure
    .input(
      z.object({
        bookId: z.number(),
        currentShamelaPageNo: z.number(),
      })
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

      // Construct next page URL by incrementing the page number in the URL
      const nextPageNo = input.currentShamelaPageNo + 1;
      const nextUrl = currentPage.shamelaUrl.replace(
        /\/(\d+)(\/?$)/,
        `/${nextPageNo}$2`
      );

      // Call fetchPage logic inline
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const htmlRes = await fetch(nextUrl);
      const html = await htmlRes.text();

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `${SHAMELA_EXTRACT_PROMPT}\n\n<SHAMELA_PAGE_URL>${nextUrl}</SHAMELA_PAGE_URL>\n\n<PAGE_HTML>${html.slice(0, 40000)}</PAGE_HTML>`,
            },
          ],
        }),
      });

      if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

      const claudeData = await claudeRes.json();
      const rawText = claudeData.content?.[0]?.text ?? "";
      let pageData: any;
      try {
        pageData = JSON.parse(rawText);
      } catch {
        throw new Error(`Failed to parse Claude response: ${rawText.slice(0, 200)}`);
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
      if (Array.isArray(pageData.paragraphs) && pageData.paragraphs.length > 0) {
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
      })
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
      })
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

  // ── Sync book from Shamela URL ───────────────────────────────────────────────

  syncBookFromShamela: publicProcedure
    .input(z.object({ shamelaUrl: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Normalise URL — strip trailing slash, page numbers, query string
      const url = new URL(input.shamelaUrl.trim());
      const bookUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, "");

      // Extract shamelaId from path  e.g. /book/12345  or /book/12345/67
      const match = bookUrl.match(/\/book\/(\d+)/);
      if (!match) throw new Error("Invalid Shamela URL — expected a /book/... path");
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

      // ── Fetch HTML ────────────────────────────────────────────────────────
      const htmlRes = await fetch(bookIndexUrl);
      if (!htmlRes.ok) throw new Error(`Failed to fetch Shamela page: ${htmlRes.status}`);
      const html = await htmlRes.text();

      // ── Call Claude for book metadata ─────────────────────────────────────
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `${SHAMELA_BOOK_META_PROMPT}\n\n<SHAMELA_BOOK_URL>${bookIndexUrl}</SHAMELA_BOOK_URL>\n\n<PAGE_HTML>${html.slice(0, 40000)}</PAGE_HTML>`,
            },
          ],
        }),
      });

      if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);
      const claudeData = await claudeRes.json();
      const rawText = claudeData.content?.[0]?.text ?? "";

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
        meta = JSON.parse(rawText);
      } catch {
        throw new Error(`Failed to parse Claude response: ${rawText.slice(0, 200)}`);
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
            ...(authorId
              ? { authors: { set: [{ id: authorId }] } }
              : {}),
          },
          include: { authors: true, shelf: true },
        });

        if (meta.description) {
          await attachTags(db, existing.blog.id, meta.description);
        }

        return { book: updated, created: false };
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

        return { book, created: true };
      }
    }),
});
