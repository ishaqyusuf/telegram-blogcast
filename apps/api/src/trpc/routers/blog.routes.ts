// apps/api/src/routers/blog.route.ts
import { createTRPCRouter, publicProcedure } from "../init";
import { z } from "zod";
import { transcribeRange, transcribeRangeSchema } from "../../queries/blog";
import { posts, postsSchema } from "../../queries/posts";
import { consoleLog } from "@acme/utils";

export const blogRoutes = createTRPCRouter({
  posts: publicProcedure.input(postsSchema).query(async (props) => {
    consoleLog("Fetching posts with input:", props.input);
    return posts(props.ctx, props.input);
  }),

  getBlog: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      return db.blog.findFirstOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          medias: {
            include: {
              file: true,
              author: true,
            },
          },
          blogTags: {
            include: { tags: true },
          },
          // comments = BlogComments where blog is parent, include the comment blog
          blogs: {
            include: {
              comment: {
                select: { id: true, content: true, createdAt: true },
              },
            },
          },
        },
      });
    }),

  deleteBlog: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.blog.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  // ── Tags ────────────────────────────────────────────────────────────────────

  getTags: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.tags.findMany({
      where: { deletedAt: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    });
  }),

  addTag: publicProcedure
    .input(z.object({ blogId: z.number(), title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Upsert tag by title
      const tag = await db.tags.upsert({
        where: { title: input.title },
        create: { title: input.title },
        update: {},
      });

      // Link to blog (skip if already linked)
      const existing = await db.blogTags.findFirst({
        where: { blogId: input.blogId, tagId: tag.id, deletedAt: null },
      });
      if (existing) return existing;

      return db.blogTags.create({
        data: { blogId: input.blogId, tagId: tag.id },
      });
    }),

  removeTag: publicProcedure
    .input(z.object({ blogTagId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.blogTags.update({
        where: { id: input.blogTagId },
        data: { deletedAt: new Date() },
      });
    }),

  // ── Comments ────────────────────────────────────────────────────────────────
  // Blog model uses BlogComments join table (blog = parent, comment = child Blog)
  // A comment is itself a Blog record of type "text" linked via BlogComments

  addComment: publicProcedure
    .input(z.object({ blogId: z.number(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Create the comment as a Blog record
      const comment = await db.blog.create({
        data: {
          content: input.content,
          type: "text",
          published: true,
          status: "published",
        },
      });

      // Link via BlogComments
      return db.blogComments.create({
        data: {
          blogId: input.blogId,
          commentId: comment.id,
        },
      });
    }),

  transcribeRange: publicProcedure
    .input(transcribeRangeSchema)
    .mutation(async (props) => {
      return transcribeRange(props.ctx, props.input);
    }),

  // ── Transcript ──────────────────────────────────────────────────────────────

  getTranscript: publicProcedure
    .input(z.object({ mediaId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.transcript.findUnique({
        where: { mediaId: input.mediaId },
        include: {
          segments: { orderBy: { startSec: "asc" } },
        },
      });
    }),

  saveTranscript: publicProcedure
    .input(
      z.object({
        mediaId: z.number(),
        segments: z.array(
          z.object({
            startSec: z.number(),
            endSec: z.number(),
            text: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Upsert transcript record
      const transcript = await db.transcript.upsert({
        where: { mediaId: input.mediaId },
        create: { mediaId: input.mediaId, status: "done" },
        update: { status: "done", updatedAt: new Date() },
      });
      // Replace all segments
      await db.transcriptSegment.deleteMany({
        where: { transcriptId: transcript.id },
      });
      await db.transcriptSegment.createMany({
        data: input.segments.map((s) => ({
          transcriptId: transcript.id,
          startSec: s.startSec,
          endSec: s.endSec,
          text: s.text,
        })),
      });
      return transcript;
    }),

  // ── Play History ─────────────────────────────────────────────────────────

  getRecentlyPlayed: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      return db.recentlyPlayed.findMany({
        where: { userId: 1 },
        orderBy: { playedAt: "desc" },
        take: input.limit,
        include: {
          Media: {
            include: {
              file: true,
              blog: {
                select: { id: true, content: true, type: true, blogDate: true },
              },
            },
          },
        },
      });
    }),

  savePlayHistory: publicProcedure
    .input(
      z.object({
        mediaId: z.number(),
        // progress in milliseconds
        progressMs: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Ensure default user exists
      await db.user.upsert({
        where: { id: 1 },
        create: { id: 1, name: "Default User" },
        update: {},
      });
      // Upsert: one record per media per user
      const existing = await db.recentlyPlayed.findFirst({
        where: { mediaId: input.mediaId, userId: 1 },
      });
      if (existing) {
        return db.recentlyPlayed.update({
          where: { id: existing.id },
          data: { progress: input.progressMs, playedAt: new Date() },
        });
      }
      return db.recentlyPlayed.create({
        data: {
          mediaId: input.mediaId,
          userId: 1,
          progress: input.progressMs,
          playedAt: new Date(),
        },
      });
    }),

  // ── Analytics ────────────────────────────────────────────────────────────

  getAnalytics: publicProcedure.query(async ({ ctx }) => {
    const { db } = ctx;
    const [totalPosts, audioPosts, textPosts, totalViews, totalReactions] =
      await Promise.all([
        db.blog.count({ where: { deletedAt: null } }),
        db.blog.count({ where: { type: "audio", deletedAt: null } }),
        db.blog.count({ where: { type: "text", deletedAt: null } }),
        db.blogViews.count({ where: { type: "view" } }),
        db.reaction.count(),
      ]);
    return { totalPosts, audioPosts, textPosts, totalViews, totalReactions };
  }),

  // ── Reactions ────────────────────────────────────────────────────────────

  getReactions: publicProcedure
    .input(z.object({ blogId: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.reaction.groupBy({
        by: ["emoji"],
        where: { blogId: input.blogId },
        _count: { emoji: true },
      });
      // Also check which ones current user (id=1) reacted to
      const mine = await ctx.db.reaction.findMany({
        where: { blogId: input.blogId, userId: 1 },
        select: { emoji: true },
      });
      const myEmojis = new Set(mine.map((r) => r.emoji));
      return rows.map((r) => ({
        emoji: r.emoji,
        count: r._count.emoji,
        reacted: myEmojis.has(r.emoji),
      }));
    }),

  addReaction: publicProcedure
    .input(z.object({ blogId: z.number(), emoji: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Ensure default user exists
      await db.user.upsert({
        where: { id: 1 },
        create: { id: 1, name: "Default User" },
        update: {},
      });
      // Toggle: if exists delete, else create
      const existing = await db.reaction.findFirst({
        where: { blogId: input.blogId, userId: 1, emoji: input.emoji },
      });
      if (existing) {
        await db.reaction.delete({ where: { id: existing.id } });
        return { action: "removed" };
      }
      await db.reaction.create({
        data: { blogId: input.blogId, userId: 1, emoji: input.emoji },
      });
      return { action: "added" };
    }),

  // ── Recently Viewed ───────────────────────────────────────────────────────

  markViewed: publicProcedure
    .input(z.object({ blogId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.user.upsert({
        where: { id: 1 },
        create: { id: 1, name: "Default User" },
        update: {},
      });
      // Upsert: one record per blog per user, update viewedAt
      const existing = await db.recentlyViewed.findFirst({
        where: { blogId: input.blogId, userId: 1 },
      });
      if (existing) {
        return db.recentlyViewed.update({
          where: { id: existing.id },
          data: { viewedAt: new Date() },
        });
      }
      return db.recentlyViewed.create({
        data: { blogId: input.blogId, userId: 1 },
      });
    }),

  getRecentlyViewed: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.recentlyViewed.findMany({
        where: { userId: 1 },
        orderBy: { viewedAt: "desc" },
        take: input.limit,
        include: {
          blog: {
            select: {
              id: true,
              content: true,
              type: true,
              blogDate: true,
              medias: { include: { file: true }, take: 1 },
            },
          },
        },
      });
    }),

  // ── Search ───────────────────────────────────────────────────────────────

  search: publicProcedure
    .input(z.object({ q: z.string().min(1), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      return db.blog.findMany({
        where: {
          deletedAt: null,
          OR: [
            { content: { contains: input.q, mode: "insensitive" } },
            {
              blogTags: {
                some: {
                  tags: { title: { contains: input.q, mode: "insensitive" } },
                },
              },
            },
          ],
        },
        take: input.limit,
        orderBy: { blogDate: "desc" },
        select: {
          id: true,
          content: true,
          type: true,
          blogDate: true,
          medias: { include: { file: true }, take: 1 },
          blogTags: { include: { tags: true } },
        },
      });
    }),

  // ── Create / Update text blogs ────────────────────────────────────────────

  createBlog: publicProcedure
    .input(
      z.object({
        content: z.string().min(1),
        status: z.enum(["draft", "published"]).default("published"),
        channelId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const now = new Date();
      const blog = await db.blog.create({
        data: {
          content: input.content,
          type: "text",
          published: input.status === "published",
          publishedAt: input.status === "published" ? now : null,
          blogDate: now,
          status: input.status,
          ...(input.channelId ? { channelId: input.channelId } : {}),
        },
      });
      // Auto-tag from #hashtags embedded in content
      const hashTags = [...(input.content.match(/#([\p{L}\p{N}_]+)/gu) ?? [])].map((t) =>
        t.slice(1)
      );
      for (const title of [...new Set(hashTags)]) {
        const tag = await db.tags.upsert({
          where: { title },
          create: { title },
          update: {},
        });
        const exists = await db.blogTags.findFirst({
          where: { blogId: blog.id, tagId: tag.id },
        });
        if (!exists) {
          await db.blogTags.create({ data: { blogId: blog.id, tagId: tag.id } });
        }
      }
      return blog;
    }),

  updateBlog: publicProcedure
    .input(
      z.object({
        id: z.number(),
        content: z.string().min(1),
        status: z.enum(["draft", "published"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const blog = await db.blog.update({
        where: { id: input.id },
        data: {
          content: input.content,
          ...(input.status
            ? {
                status: input.status,
                published: input.status === "published",
                publishedAt: input.status === "published" ? new Date() : undefined,
              }
            : {}),
        },
      });
      // Sync auto-tags from content hashtags
      const hashTags = [...(input.content.match(/#([\p{L}\p{N}_]+)/gu) ?? [])].map((t) =>
        t.slice(1)
      );
      for (const title of [...new Set(hashTags)]) {
        const tag = await db.tags.upsert({
          where: { title },
          create: { title },
          update: {},
        });
        const exists = await db.blogTags.findFirst({
          where: { blogId: blog.id, tagId: tag.id },
        });
        if (!exists) {
          await db.blogTags.create({ data: { blogId: blog.id, tagId: tag.id } });
        }
      }
      return blog;
    }),

  saveSearch: publicProcedure
    .input(z.object({ term: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.search.create({ data: { searchTerm: input.term } });
    }),

  getRecentSearches: publicProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.search.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit,
        distinct: ["searchTerm"],
        select: { id: true, searchTerm: true, createdAt: true },
      });
    }),
});
