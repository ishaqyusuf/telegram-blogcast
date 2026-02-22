// apps/api/src/db/queries/blog.ts
import type { TRPCContext } from "@api/trpc/init";
import { z } from "zod";

// ── Schemas ───────────────────────────────────────────────────────────────────

export const messageMediaSchema = z.object({
  fileId: z.string(),
  mimeType: z.string(),
  title: z.string().optional(),
  // type: z.enum(["audio", "image", "video", "document", "text"]),
  author: z.string().optional(),
  duration: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fileSize: z.number().optional(),
});

export const incomingMessageSchema = z.object({
  id: z.number(),
  text: z.string().nullable(),
  date: z.string(),
  media: messageMediaSchema.nullable(),
});

export const saveBatchSchema = z.object({
  channelId: z.number(),
  messages: z.array(incomingMessageSchema),
});

export type SaveBatchSchema = z.infer<typeof saveBatchSchema>;
export type IncomingMessage = z.infer<typeof incomingMessageSchema>;
export type MessageMedia = z.infer<typeof messageMediaSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveBlogType(
  media: MessageMedia | null,
): "text" | "image" | "audio" {
  if (!media) return "text";
  if (media.mimeType.startsWith("audio")) return "audio";
  if (media.mimeType.startsWith("image")) return "image";
  return "text";
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Batch-persist messages as Blog records.
 * - Idempotent: skips messageIds already stored in meta.telegramMessageId.
 * - Creates File + Media for any message with media.
 * - For audio: upserts Author by name, sets Media.title + authorId.
 * - Updates channel.lastMessageId to the highest id in this batch.
 */
export async function saveBatch(ctx: TRPCContext, input: SaveBatchSchema) {
  const { db } = ctx;
  const { channelId, messages } = input;

  if (messages.length === 0) return { created: 0 };

  // ── Skip already persisted messages ──────────────────────────────────────
  const existingBlogs = await db.blog.findMany({
    where: { channelId, deletedAt: null },
    select: { meta: true },
  });

  const existingIds = new Set(
    existingBlogs
      .map((b) => (b.meta as any)?.telegramMessageId as number | undefined)
      .filter(Boolean),
  );

  const newMessages = messages.filter((m) => !existingIds.has(m.id));
  if (newMessages.length === 0) return { created: 0 };

  let created = 0;

  for (const msg of newMessages) {
    const blogDate = new Date(msg.date);
    const type = resolveBlogType(msg.media);

    // ── Blog ────────────────────────────────────────────────────────────────
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

    // ── File + Media ────────────────────────────────────────────────────────
    if (msg.media) {
      const {
        fileId,
        mimeType,
        title,
        author,
        duration,
        width,
        height,
        fileSize,
      } = msg.media;

      // Upsert Author for audio messages
      let authorId: number | undefined;
      if (type === "audio" && author) {
        const authorRecord = await db.author.upsert({
          where: { name: author },
          create: { name: author },
          update: {},
        });
        authorId = authorRecord.id;
      }

      const file = await db.file.create({
        data: {
          fileId,
          fileType: type,
          mimeType,
          duration,
          width,
          height,
          fileSize,
        },
      });

      await db.media.create({
        data: {
          mimeType,
          fileId: file.id,
          blogId: blog.id,
          title: title ?? null,
          authorId: authorId ?? null,
        },
      });
    }

    created++;
  }

  // ── Advance cursor ────────────────────────────────────────────────────────
  const maxId = Math.max(...messages.map((m) => m.id));
  await db.channel.update({
    where: { id: channelId },
    data: { lastMessageId: maxId },
  });

  return { created };
}

/**
 * Get the resume cursor for a channel.
 * Checks channel.lastMessageId first, falls back to scanning Blog.meta.
 */
export async function getLatestMessageId(
  ctx: TRPCContext,
  input: { channelId: number },
) {
  const { db } = ctx;

  const channel = await db.channel.findFirst({
    where: { id: input.channelId, deletedAt: null },
    select: { lastMessageId: true },
  });

  if (channel?.lastMessageId) {
    return { lastMessageId: channel.lastMessageId };
  }

  // Fallback: derive from Blog.meta
  const latest = await db.blog.findFirst({
    where: { channelId: input.channelId, deletedAt: null },
    orderBy: { blogDate: "desc" },
    select: { meta: true },
  });

  return {
    lastMessageId: ((latest?.meta as any)?.telegramMessageId ?? null) as
      | number
      | null,
  };
}
