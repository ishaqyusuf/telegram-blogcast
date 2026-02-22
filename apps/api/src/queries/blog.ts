// apps/api/src/db/queries/blog.ts
import type { TRPCContext } from "@api/trpc/init";
import { z } from "zod";
import type { FetchedMessage } from "@telegram/message-service";

// ── Schemas ───────────────────────────────────────────────────────────────────

export const createBlogsFromMessagesSchema = z.object({
  channelId: z.number(),
  messages: z.array(
    z.object({
      id: z.number(),
      text: z.string().nullable(),
      fileId: z.string().nullable(),
      date: z.string(), // ISO-8601
    }),
  ),
});
export type CreateBlogsFromMessagesSchema = z.infer<
  typeof createBlogsFromMessagesSchema
>;

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Batch-create Blog records from a completed message fetch batch.
 * - Skips messages already tracked via MessageForward (idempotent).
 * - Creates a Blog per message, then a MessageForward record linking them.
 * - If message has a fileId, creates a Media + File record attached to the blog.
 */
export async function createBlogsFromMessages(
  ctx: TRPCContext,
  input: CreateBlogsFromMessagesSchema,
) {
  const { db } = ctx;
  const { channelId, messages } = input;

  // Collect already-processed messageIds for this channel to skip duplicates
  const existingForwards = await db.messageForward.findMany({
    where: {
      channelId,
      messageId: { in: messages.map((m) => m.id) },
      deletedAt: null,
    },
    select: { messageId: true },
  });
  const existingIds = new Set(existingForwards.map((f) => f.messageId));

  const newMessages = messages.filter((m) => !existingIds.has(m.id));
  if (newMessages.length === 0) return { created: 0 };

  let created = 0;

  // Process sequentially to avoid race conditions on FK constraints
  for (const msg of newMessages) {
    const blogDate = new Date(msg.date);
    const type = msg.fileId
      ? msg.fileId.startsWith("photo_")
        ? "image"
        : "audio"
      : "text";

    // Create the Blog
    const blog = await db.blog.create({
      data: {
        content: msg.text,
        type,
        published: true,
        publishedAt: blogDate,
        blogDate,
        channelId,
        status: "published",
        meta: { telegramMessageId: msg.id },
      },
    });

    // If there is media, persist a File + Media record linked to the blog
    if (msg.fileId) {
      const file = await db.file.create({
        data: {
          fileId: msg.fileId,
          fileType: type,
          mimeType: type === "audio" ? "audio/ogg" : "image/jpeg",
        },
      });

      await db.media.create({
        data: {
          mimeType: type === "audio" ? "audio/ogg" : "image/jpeg",
          fileId: file.id,
          blogId: blog.id,
        },
      });
    }

    // Track the forward so we never re-process this messageId
    await db.messageForward.create({
      data: {
        messageId: msg.id,
        channelId,
        publishedDate: blogDate,
        status: "captured",
      },
    });

    created++;
  }

  return { created };
}

/** Get blog count per channel (for dashboard summary) */
export async function getChannelBlogStats(
  ctx: TRPCContext,
  input: { channelId: number },
) {
  const { db } = ctx;
  return db.blog.count({
    where: { channelId: input.channelId, deletedAt: null },
  });
}
