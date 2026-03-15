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
});
