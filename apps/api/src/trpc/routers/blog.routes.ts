// apps/api/src/routers/blog.route.ts
import { createTRPCRouter, publicProcedure } from "../init";
import { z } from "zod";
import { transcribeRange, transcribeRangeSchema } from "../../queries/blog";
import { posts, postsSchema } from "../../queries/posts";
import { consoleLog } from "@acme/utils";
import { TRPCError } from "@trpc/server";

const blogStatusSchema = z.enum(["draft", "published"]);
const blogMediaUploadSchema = z.object({
  url: z.string().url(),
  downloadUrl: z.string().url().optional(),
  pathname: z.string().min(1),
  contentType: z.string().min(1),
  etag: z.string().optional(),
  size: z.number().nonnegative().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  width: z.number().nonnegative().optional(),
  height: z.number().nonnegative().optional(),
  duration: z.number().nonnegative().optional(),
});

type BlogMediaUpload = z.infer<typeof blogMediaUploadSchema>;

function normalizeTagTitle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

function extractHashTags(content: string) {
  return [...(content.match(/#([\p{L}\p{N}_\u0600-\u06FF]+)/gu) ?? [])].map(
    (tag) => tag.slice(1),
  );
}

function inferBlogType(
  requestedType: "text" | "audio" | "image" | "video" | "pdf" | undefined,
  mediaUploads: BlogMediaUpload[],
) {
  if (requestedType && requestedType !== "text") return requestedType;
  const firstMedia = mediaUploads[0];
  if (!firstMedia) return requestedType ?? "text";
  const contentType = firstMedia.contentType.toLowerCase();
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType === "application/pdf" || firstMedia.pathname.endsWith(".pdf")) {
    return "pdf";
  }
  return "text";
}

async function attachTagsToBlog(
  db: any,
  blogId: number,
  values: Array<string | null | undefined>,
) {
  const uniqueTags = Array.from(
    new Set(values.map((tag) => normalizeTagTitle(tag ?? "")).filter(Boolean)),
  ).slice(0, 10);

  for (const title of uniqueTags) {
    const tag = await db.tags.upsert({
      where: { title },
      create: { title },
      update: {},
    });
    const exists = await db.blogTags.findFirst({
      where: { blogId, tagId: tag.id, deletedAt: null },
    });
    if (!exists) {
      await db.blogTags.create({ data: { blogId, tagId: tag.id } });
    }
  }

  return uniqueTags;
}

async function attachBlobMediaToBlog(
  db: any,
  blogId: number,
  mediaUploads: BlogMediaUpload[],
) {
  for (const upload of mediaUploads) {
    const fileUniqueId = `vercel:${upload.etag || upload.pathname}`;
    const file = await db.file.upsert({
      where: { fileUniqueId },
      create: {
        source: "vercel_blob",
        fileType: upload.contentType.split("/")[0] || "file",
        fileId: upload.pathname,
        fileUniqueId,
        fileSize: upload.size ?? null,
        fileName: upload.name ?? upload.pathname.split("/").pop() ?? null,
        mimeType: upload.contentType,
        width: upload.width ?? null,
        height: upload.height ?? null,
        duration: upload.duration ?? null,
        blobUrl: upload.url,
        blobDownloadUrl: upload.downloadUrl ?? upload.url,
        blobPathname: upload.pathname,
        blobContentType: upload.contentType,
        blobEtag: upload.etag ?? null,
        storageMetadata: upload as any,
      },
      update: {
        source: "vercel_blob",
        fileType: upload.contentType.split("/")[0] || "file",
        fileId: upload.pathname,
        fileSize: upload.size ?? null,
        fileName: upload.name ?? upload.pathname.split("/").pop() ?? null,
        mimeType: upload.contentType,
        width: upload.width ?? null,
        height: upload.height ?? null,
        duration: upload.duration ?? null,
        blobUrl: upload.url,
        blobDownloadUrl: upload.downloadUrl ?? upload.url,
        blobPathname: upload.pathname,
        blobContentType: upload.contentType,
        blobEtag: upload.etag ?? null,
        storageMetadata: upload as any,
      },
    });

    const existing = await db.media.findFirst({
      where: { blogId, fileId: file.id },
    });
    if (!existing) {
      await db.media.create({
        data: {
          blogId,
          fileId: file.id,
          mimeType: upload.contentType,
          title: upload.title ?? upload.name ?? null,
        },
      });
    }
  }
}

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
              album: { select: { id: true, name: true } },
              albumAudioIndex: { select: { index: true } },
            },
          },
          blogTags: {
            include: { tags: true },
          },
          channel: {
            select: {
              id: true,
              title: true,
              username: true,
            },
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

  restoreBlog: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.blog.update({
        where: { id: input.id },
        data: { deletedAt: null },
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
    .input(
      z.object({
        blogId: z.number(),
        content: z.string().min(1),
        timestampSeconds: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Create the comment as a Blog record
      const comment = await db.blog.create({
        data: {
          content: input.content,
          type: "text",
          published: true,
          status: "published",
          meta:
            typeof input.timestampSeconds === "number"
              ? { audioTimestampSeconds: input.timestampSeconds }
              : undefined,
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

  getComments: publicProcedure
    .input(
      z.object({
        blogId: z.number(),
        search: z.string().optional(),
        tagId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const blog = await ctx.db.blog.findFirstOrThrow({
        where: { id: input.blogId },
        select: { arrangementMode: true },
      });

      const links = await ctx.db.blogComments.findMany({
        where: { blogId: input.blogId, deletedAt: null },
        orderBy: blog.arrangementMode === "indexed" ? { order: "asc" } : { createdAt: "asc" },
        include: {
          comment: {
            select: {
              id: true,
              content: true,
              deletedAt: true,
              createdAt: true,
              blogTags: { include: { tags: true }, where: { deletedAt: null } },
            },
          },
        },
      });

      // Collect all unique tags from all (unfiltered) comments for the filter chips
      const allLinks = await ctx.db.blogComments.findMany({
        where: { blogId: input.blogId, deletedAt: null },
        include: {
          comment: {
            select: { blogTags: { include: { tags: true }, where: { deletedAt: null } } },
          },
        },
      });
      const tagMap = new Map<number, string>();
      allLinks.forEach((l) =>
        l.comment?.blogTags.forEach((bt) => {
          if (bt.tags) tagMap.set(bt.tags.id, bt.tags.title);
        })
      );

      const filteredLinks = links.filter((link) => {
        const comment = link.comment;
        if (!comment || comment.deletedAt) return false;
        if (
          input.search &&
          !comment.content?.toLowerCase().includes(input.search.toLowerCase())
        ) {
          return false;
        }
        if (
          input.tagId &&
          !comment.blogTags.some((blogTag) => blogTag.tagId === input.tagId)
        ) {
          return false;
        }
        return true;
      });

      return {
        comments: filteredLinks,
        arrangementMode: blog.arrangementMode,
        availableTags: [...tagMap.entries()].map(([id, title]) => ({ id, title })),
      };
    }),

  editComment: publicProcedure
    .input(z.object({ commentId: z.number(), content: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      ctx.db.blog.update({
        where: { id: input.commentId },
        data: { content: input.content },
      })
    ),

  deleteComment: publicProcedure
    .input(z.object({ blogId: z.number(), commentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.blogComments.findFirst({
        where: { blogId: input.blogId, commentId: input.commentId, deletedAt: null },
      });
      if (!link) throw new Error("Comment not found");
      return ctx.db.blogComments.update({
        where: { id: link.id },
        data: { deletedAt: new Date() },
      });
    }),

  reorderComments: publicProcedure
    .input(
      z.object({
        blogId: z.number(),
        order: z.array(z.object({ commentId: z.number(), order: z.number() })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.order.map(({ commentId, order }) =>
          ctx.db.blogComments.updateMany({
            where: { blogId: input.blogId, commentId },
            data: { order },
          })
        )
      );
      return { updated: input.order.length };
    }),

  setBlogArrangementMode: publicProcedure
    .input(z.object({ blogId: z.number(), mode: z.enum(["default", "indexed"]) }))
    .mutation(({ ctx, input }) =>
      ctx.db.blog.update({
        where: { id: input.blogId },
        data: { arrangementMode: input.mode },
      })
    ),

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
        title: z.string().trim().max(180).optional(),
        content: z.string().trim().max(20000).optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
        type: z.enum(["text", "audio", "image", "video", "pdf"]).optional(),
        published: z.boolean().optional(),
        status: blogStatusSchema.optional(),
        channelId: z.number().optional(),
        mediaUploads: z.array(blogMediaUploadSchema).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const now = new Date();
      const title = input.title?.trim() ?? "";
      const body = input.content?.trim() ?? "";
      const mediaUploads = input.mediaUploads ?? [];
      const normalizedContent = [title, body].filter(Boolean).join("\n\n").trim();

      if (!normalizedContent && mediaUploads.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Title, content, or media is required.",
        });
      }

      const status =
        input.status ?? (input.published === false ? "draft" : "published");
      const type = inferBlogType(input.type, mediaUploads);

      return db.$transaction(async (tx) => {
        const blog = await tx.blog.create({
          data: {
            content: normalizedContent || null,
            type,
            published: status === "published",
            publishedAt: status === "published" ? now : null,
            blogDate: now,
            status,
            ...(input.channelId ? { channelId: input.channelId } : {}),
            meta: {
              title: title || null,
              mediaSource: mediaUploads.length > 0 ? "vercel_blob" : null,
            },
          },
        });

        await attachBlobMediaToBlog(tx, blog.id, mediaUploads);
        await attachTagsToBlog(tx, blog.id, [
          ...(input.tags ?? []),
          ...extractHashTags(normalizedContent),
        ]);

        return blog;
      });
    }),

  updateBlog: publicProcedure
    .input(
      z.object({
        id: z.number(),
        content: z.string().min(1),
        status: blogStatusSchema.optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
        mediaUploads: z.array(blogMediaUploadSchema).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      return db.$transaction(async (tx) => {
        const blog = await tx.blog.update({
          where: { id: input.id },
          data: {
            content: input.content,
            ...(input.status
              ? {
                  status: input.status,
                  published: input.status === "published",
                  publishedAt:
                    input.status === "published" ? new Date() : undefined,
                }
              : {}),
          },
        });

        await attachBlobMediaToBlog(tx, blog.id, input.mediaUploads ?? []);
        await attachTagsToBlog(tx, blog.id, [
          ...(input.tags ?? []),
          ...extractHashTags(input.content),
        ]);

        return blog;
      });
    }),

  confirmBlobUpload: publicProcedure
    .input(
      z.object({
        blogId: z.number(),
        media: blogMediaUploadSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await attachBlobMediaToBlog(ctx.db, input.blogId, [input.media]);
      return ctx.db.blog.findFirstOrThrow({
        where: { id: input.blogId },
        include: { medias: { include: { file: true } } },
      });
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
