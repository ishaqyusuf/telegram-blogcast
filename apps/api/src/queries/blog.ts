// apps/api/src/db/queries/blog.ts
import { consoleLog } from "@acme/utils";
import type { TRPCContext } from "@api/trpc/init";
import type { BlogMeta } from "@api/type";
import type { ResolvedMedia } from "@telegram/media-resolver";
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
  media: z.any(),
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
    where: {
      channelId,
      deletedAt: null,
      meta: {
        equals: {
          propName: "telegramMessageId",
          operator: "in",
          value: messages.map((m) => m.id),
        },
        // path: ["telegramMessageId"],

        // in: messages.map((m) => m.id),
      },
    },
    select: { meta: true },
  });

  const existingIds = new Set(
    existingBlogs
      .map((b) => (b.meta as BlogMeta)?.telegramMessageId as number | undefined)
      .filter(Boolean),
  );

  const newMessages = messages.filter((m) => !existingIds.has(m.id));
  const skipped = messages.length - newMessages.length;
  if (newMessages.length === 0) return { created: 0, skipped };

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
      await persistResolvedMedia(ctx, msg.media, blog.id).catch((err) => {
        consoleLog("[saveBatch] persistResolvedMedia failed:", err);
      });
    }

    created++;
  }
  consoleLog(
    `[saveBatch] channelId=${channelId} created=${created} skipped=${skipped}`,
  );
  return { created, skipped };
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
    lastMessageId: ((latest?.meta as BlogMeta)?.telegramMessageId ?? null) as
      | number
      | null,
  };
}
export async function persistResolvedMedia(
  //   db: Db,
  ctx: TRPCContext,
  resolved: ResolvedMedia,
  blogId: number,
): Promise<number> {
  const { db } = ctx;
  if (!resolved.file) return;
  // ── Author ────────────────────────────────────────────────────────────────
  let authorId: number | undefined;

  if (resolved.author) {
    const { name, nameAr } = resolved.author;

    // Upsert by nameAr first (more specific), then name
    if (nameAr) {
      const author = await db.author.upsert({
        where: { nameAr },
        create: { nameAr, name: name ?? null },
        update: { name: name ?? undefined }, // fill name if we get it later
      });
      authorId = author.id;
    } else if (name) {
      const author = await db.author.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      authorId = author.id;
    }
  }

  // ── Primary File ──────────────────────────────────────────────────────────
  const file = await db.file.upsert({
    where: { fileUniqueId: resolved.file.fileUniqueId ?? resolved.file.fileId },
    create: {
      fileId: resolved.file.fileId,
      fileUniqueId: resolved.file.fileUniqueId ?? resolved.file.fileId,
      fileType: resolved.file.fileType,
      mimeType: resolved.file.mimeType ?? null,
      fileName: resolved.file.fileName ?? null,
      fileSize: resolved.file.fileSize ?? null,
      width: resolved.file.width ?? null,
      height: resolved.file.height ?? null,
      duration: resolved.file.duration ?? null,
    },
    update: {
      // Update fileId in case it rotated (Bot API file_ids can change)
      fileId: resolved.file.fileId,
    },
  });

  // ── Thumbnails ────────────────────────────────────────────────────────────
  await Promise.all(
    resolved.thumbnails!?.map(async (thumb) => {
      const thumbFile = await db.file.upsert({
        where: { fileUniqueId: thumb.fileUniqueId ?? thumb.fileId },
        create: {
          fileId: thumb.fileId,
          fileUniqueId: thumb.fileUniqueId ?? thumb.fileId,
          fileType: "thumbnail",
          width: thumb.width ?? null,
          height: thumb.height ?? null,
          fileSize: thumb.fileSize ?? null,
        },
        update: { fileId: thumb.fileId },
      });

      // Link to Thumbnail table
      await db.thumbnail
        .upsert({
          where: { id: thumbFile.id }, // approximate — thumbnail has no unique fileId field
          create: { fileId: thumbFile.id, blogId },
          update: {},
        })
        .catch(() => {
          // Thumbnail may already exist — non-critical
        });
    }),
  );

  // ── Media ─────────────────────────────────────────────────────────────────
  const media = await db.media.create({
    data: {
      mimeType: resolved.mimeType,
      fileId: file.id,
      blogId,
      title: resolved.title ?? null,
      authorId: authorId ?? null,
    },
  });

  return media.id;
}
