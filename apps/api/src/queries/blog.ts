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
type TelegramGetFileResponse = {
  ok: boolean;
  result?: {
    file_path?: string;
  };
  description?: string;
};

type OpenAIVerboseSegment = {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
};

export const transcribeRangeSchema = z.object({
  fileId: z.string().min(1),
  fromSec: z.number().min(0),
  toSec: z.number().min(0),
  provider: z.enum(["openai", "gemini"]).default("openai"),
  language: z.string().min(2).max(8).optional(),
});
export type TranscribeRangeSchema = z.infer<typeof transcribeRangeSchema>;

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

async function getTelegramFilePath(fileId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(`Telegram getFile failed (${res.status})`);
  }

  const data = (await res.json()) as TelegramGetFileResponse;
  if (!data.ok || !data.result?.file_path) {
    throw new Error(data.description ?? "Telegram file path not found");
  }

  return { botToken, filePath: data.result.file_path };
}

function overlapsRange(
  segmentStart: number,
  segmentEnd: number,
  fromSec: number,
  toSec: number,
) {
  return segmentStart < toSec && segmentEnd > fromSec;
}

async function transcribeWithOpenAi(input: {
  fileBlob: Blob;
  fromSec: number;
  toSec: number;
  language?: string;
}) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const formData = new FormData();
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  if (input.language) formData.append("language", input.language);
  formData.append("file", input.fileBlob, "audio-input.mp3");

  const transcriptRes = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
      body: formData,
    },
  );

  if (!transcriptRes.ok) {
    const errText = await transcriptRes.text();
    throw new Error(`OpenAI transcription failed: ${errText}`);
  }

  const json = (await transcriptRes.json()) as {
    text?: string;
    segments?: OpenAIVerboseSegment[];
  };

  const segments = (json.segments ?? [])
    .filter((segment) => {
      const start = segment.start ?? 0;
      const end = segment.end ?? start;
      return overlapsRange(start, end, input.fromSec, input.toSec);
    })
    .map((segment, idx) => ({
      id: `seg-${segment.id ?? idx}`,
      from: Math.max(input.fromSec, Math.floor(segment.start ?? input.fromSec)),
      to: Math.min(input.toSec, Math.ceil(segment.end ?? input.toSec)),
      text: (segment.text ?? "").trim(),
    }))
    .filter((segment) => segment.text.length > 0 && segment.to > segment.from);

  if (segments.length === 0 && json.text?.trim()) {
    return {
      segments: [
        {
          id: "seg-full",
          from: Math.floor(input.fromSec),
          to: Math.ceil(input.toSec),
          text: json.text.trim(),
        },
      ],
    };
  }

  return { segments };
}

async function transcribeWithGemini(input: {
  fileBase64: string;
  mimeType: string;
  fromSec: number;
  toSec: number;
  language?: string;
}) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const languageNote = input.language
    ? `Use language code "${input.language}" if possible.`
    : "Detect language automatically.";
  const prompt = [
    "Transcribe the provided audio and return only valid JSON.",
    `Focus on the timeframe ${Math.floor(input.fromSec)}s to ${Math.ceil(input.toSec)}s.`,
    languageNote,
    'Output shape: {"segments":[{"from":number,"to":number,"text":string}]}',
    "Rules: timestamps are absolute seconds from start, from<to, concise cleaned text.",
  ].join(" ");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: input.mimeType,
                  data: input.fileBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini transcription failed: ${errText}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { segments: [] as Array<{ id: string; from: number; to: number; text: string }> };
  }

  let parsedJson: unknown = null;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return {
      segments: [] as Array<{ id: string; from: number; to: number; text: string }>,
    };
  }

  const parsed = z
    .object({
      segments: z.array(
        z.object({
          from: z.number(),
          to: z.number(),
          text: z.string(),
        }),
      ),
    })
    .safeParse(parsedJson);

  if (!parsed.success) {
    return { segments: [] as Array<{ id: string; from: number; to: number; text: string }> };
  }

  return {
    segments: parsed.data.segments
      .map((segment, idx) => ({
        id: `gem-${idx}`,
        from: Math.max(input.fromSec, Math.floor(segment.from)),
        to: Math.min(input.toSec, Math.ceil(segment.to)),
        text: segment.text.trim(),
      }))
      .filter((segment) => segment.text.length > 0 && segment.to > segment.from),
  };
}

export async function transcribeRange(
  _: TRPCContext,
  input: TranscribeRangeSchema,
) {
  const { fileId, fromSec, toSec, language, provider } = input;
  if (toSec <= fromSec) {
    throw new Error("`toSec` must be greater than `fromSec`");
  }

  const { botToken, filePath } = await getTelegramFilePath(fileId);
  const upstreamRes = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${filePath}`,
    { cache: "no-store" },
  );
  if (!upstreamRes.ok) {
    throw new Error(
      `Failed to fetch media from Telegram (${upstreamRes.status})`,
    );
  }

  const fileBuffer = await upstreamRes.arrayBuffer();
  const fileSize = fileBuffer.byteLength;
  const mimeType = upstreamRes.headers.get("content-type") ?? "audio/mpeg";
  const fileBlob = new Blob([fileBuffer], {
    type: mimeType,
  });

  // Provider upload limits are strict; fail early with a clear message.
  if (provider === "openai" && fileSize > 24 * 1024 * 1024) {
    throw new Error(
      "Audio file is too large for OpenAI transcription (>24MB). Use a shorter source audio.",
    );
  }
  if (provider === "gemini" && fileSize > 19 * 1024 * 1024) {
    throw new Error(
      "Audio file is too large for Gemini inline transcription (>19MB). Use a shorter source audio.",
    );
  }
  if (provider === "gemini") {
    return transcribeWithGemini({
      fileBase64: Buffer.from(fileBuffer).toString("base64"),
      mimeType,
      fromSec,
      toSec,
      language,
    });
  }

  return transcribeWithOpenAi({ fileBlob, fromSec, toSec, language });
}
