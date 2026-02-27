// apps/api/src/routers/blog.route.ts
import { createTRPCRouter, publicProcedure } from "../init";
import { z } from "zod";
import { transcribeRange, transcribeRangeSchema } from "../../queries/blog";
import { posts, postsSchema } from "../../queries/posts";

export const blogRoutes = createTRPCRouter({
  posts: publicProcedure.input(postsSchema).query(async (props) => {
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
});
