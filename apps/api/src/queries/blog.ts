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
export type SavedIncomingMessageResult = {
  telegramMessageId: number;
  status: "created" | "duplicate";
  blogId: number;
  mediaId: number | null;
};
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
type OpenAIVerboseWord = {
  word?: string;
  start?: number;
  end?: number;
};
type XaiSttWord = {
  text?: string;
  start?: number;
  end?: number;
};
type TranscriptionUsage = {
  provider: "local" | "openai" | "gemini" | "xai";
  model: TranscriptionModel;
  audioSeconds?: number;
  billableSeconds?: number;
  fileBytes?: number;
  requestCount: number;
};
type TranscriptWord = {
  word: string;
  startSec: number;
  endSec: number;
};
type TranscribedSegment = {
  id: string;
  from: number;
  to: number;
  text: string;
  words?: TranscriptWord[];
};

export const transcriptionModelSchema = z.enum([
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "gemini-2.0-flash",
  "grok-whisper",
  "whisper-local",
]);
export type TranscriptionModel = z.infer<typeof transcriptionModelSchema>;
type TranscriptionResult = {
  segments: TranscribedSegment[];
  usage?: TranscriptionUsage;
};

export const transcribeRangeSchema = z.object({
  mediaId: z.number().optional(),
  fileId: z.string().min(1),
  fromSec: z.number().min(0),
  toSec: z.number().min(0),
  provider: z.enum(["openai", "gemini", "grok", "whisper-local"]).optional(),
  model: transcriptionModelSchema.optional(),
  localTranscriberBaseUrl: z.string().url().optional(),
  language: z.string().min(2).max(8).optional(),
  force: z.boolean().optional(),
});
export type TranscribeRangeSchema = z.infer<typeof transcribeRangeSchema>;

export const transcriptChunkSchema = z.object({
  mediaId: z.number(),
  fileId: z.string().min(1),
  positionSec: z.number().min(0).optional(),
  chunkStartSec: z.number().min(0).optional(),
  chunkDurationSec: z.number().min(5).max(120).default(30),
  provider: z.enum(["openai", "gemini", "grok", "whisper-local"]).optional(),
  model: transcriptionModelSchema.optional(),
  localTranscriberBaseUrl: z.string().url().optional(),
  language: z.string().min(2).max(8).optional(),
  force: z.boolean().optional(),
});
export type TranscriptChunkSchema = z.infer<typeof transcriptChunkSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveBlogType(
  media: MessageMedia | null,
): "text" | "image" | "audio" {
  if (!media) return "text";
  if (media.mimeType.startsWith("audio")) return "audio";
  if (media.mimeType.startsWith("image")) return "image";
  return "text";
}

function getTelegramMessageId(blog: {
  telegramMessageId?: number | null;
  meta?: unknown;
}) {
  return (
    blog.telegramMessageId ??
    ((blog.meta as BlogMeta | null)?.telegramMessageId || null)
  );
}

async function findExistingTelegramBlogs(
  db: TRPCContext["db"],
  channelId: number,
  messageIds: number[],
) {
  if (messageIds.length === 0) {
    return new Map<number, { blogId: number; mediaId: number | null }>();
  }

  const existingBlogsByColumn = await db.blog.findMany({
    where: {
      channelId,
      deletedAt: null,
      telegramMessageId: { in: messageIds },
    },
    select: {
      id: true,
      telegramMessageId: true,
      meta: true,
      medias: {
        select: { id: true },
        take: 1,
      },
    },
  });

  const existing = new Map<
    number,
    { blogId: number; mediaId: number | null }
  >();
  for (const blog of existingBlogsByColumn) {
    const telegramMessageId = getTelegramMessageId(blog);
    if (!telegramMessageId) continue;
    existing.set(telegramMessageId, {
      blogId: blog.id,
      mediaId: blog.medias?.[0]?.id ?? null,
    });
  }

  const missingIds = messageIds.filter((id) => !existing.has(id));
  if (missingIds.length === 0) return existing;

  const legacyMetaBlogs = await db.blog.findMany({
    where: {
      channelId,
      deletedAt: null,
    },
    select: {
      id: true,
      meta: true,
      medias: {
        select: { id: true },
        take: 1,
      },
    },
  });
  const missingIdSet = new Set(missingIds);

  for (const blog of legacyMetaBlogs) {
    const telegramMessageId = getTelegramMessageId(blog);
    if (!telegramMessageId || !missingIdSet.has(telegramMessageId)) continue;
    existing.set(telegramMessageId, {
      blogId: blog.id,
      mediaId: blog.medias?.[0]?.id ?? null,
    });
  }

  return existing;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Batch-persist messages as Blog records.
 * - Idempotent: skips messageIds already stored in meta.telegramMessageId.
 * - Creates File + Media for any message with media.
 * - For audio: upserts Author by name, sets Media.title + authorId.
 * - Updates channel.lastMessageId to the highest id in this batch.
 */
export async function saveIncomingMessages(
  ctx: TRPCContext,
  input: SaveBatchSchema,
) {
  const { db } = ctx;
  const { channelId, messages } = input;

  if (messages.length === 0) {
    return { created: 0, skipped: 0, results: [] };
  }

  const existing = await findExistingTelegramBlogs(
    db,
    channelId,
    messages.map((m) => m.id),
  );
  const createdMessageIds: number[] = [];
  const results: SavedIncomingMessageResult[] = [];
  let created = 0;
  let skipped = 0;

  for (const msg of messages) {
    const duplicate = existing.get(msg.id);
    if (duplicate) {
      skipped++;
      results.push({
        telegramMessageId: msg.id,
        status: "duplicate",
        blogId: duplicate.blogId,
        mediaId: duplicate.mediaId,
      });
      continue;
    }

    const blogDate = new Date(msg.date);
    const type = resolveBlogType(msg.media);

    try {
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
          telegramMessageId: msg.id,
          meta: { telegramMessageId: msg.id },
        },
      });

      let mediaId: number | null = null;
      // ── File + Media ────────────────────────────────────────────────────────
      if (msg.media) {
        mediaId =
          (await persistResolvedMedia(ctx, msg.media, blog.id).catch((err) => {
            consoleLog("[saveBatch] persistResolvedMedia failed:", err);
            return undefined;
          })) ?? null;
      }

      created++;
      createdMessageIds.push(msg.id);
      existing.set(msg.id, {
        blogId: blog.id,
        mediaId,
      });
      results.push({
        telegramMessageId: msg.id,
        status: "created",
        blogId: blog.id,
        mediaId,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const refreshed = await findExistingTelegramBlogs(db, channelId, [
        msg.id,
      ]);
      const existingAfterRace = refreshed.get(msg.id);
      if (!existingAfterRace) {
        throw error;
      }

      skipped++;
      results.push({
        telegramMessageId: msg.id,
        status: "duplicate",
        blogId: existingAfterRace.blogId,
        mediaId: existingAfterRace.mediaId,
      });
    }
  }

  consoleLog(
    `[saveBatch] channelId=${channelId} created=${created} skipped=${skipped}`,
  );

  if (createdMessageIds.length > 0) {
    const oldestMessageId = Math.min(...createdMessageIds);
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: { lastMessageId: true },
    });

    await db.channel.update({
      where: { id: channelId },
      data: {
        allFetched: false,
        lastMessageId:
          channel?.lastMessageId == null
            ? oldestMessageId
            : Math.min(channel.lastMessageId, oldestMessageId),
      },
    });
  }

  return { created, skipped, results };
}

export async function saveBatch(ctx: TRPCContext, input: SaveBatchSchema) {
  return saveIncomingMessages(ctx, input);
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
): Promise<number | undefined> {
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
    (resolved.thumbnails ?? []).map(async (thumb) => {
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

function normalizeChunkStart(input: {
  positionSec?: number;
  chunkStartSec?: number;
  chunkDurationSec: number;
}) {
  const rawStart =
    typeof input.chunkStartSec === "number"
      ? input.chunkStartSec
      : Math.floor((input.positionSec ?? 0) / input.chunkDurationSec) *
        input.chunkDurationSec;
  return Math.max(
    0,
    Math.floor(rawStart / input.chunkDurationSec) * input.chunkDurationSec,
  );
}

function distributeWords(segment: {
  text: string;
  from: number;
  to: number;
}): TranscriptWord[] {
  const tokens = segment.text.match(/\S+/g) ?? [];
  if (tokens.length === 0 || segment.to <= segment.from) return [];

  const duration = segment.to - segment.from;
  return tokens.map((word, index) => {
    const startSec = segment.from + (duration * index) / tokens.length;
    const endSec = segment.from + (duration * (index + 1)) / tokens.length;
    return { word, startSec, endSec };
  });
}

function attachWordsToSegments(
  segments: TranscribedSegment[],
  words: TranscriptWord[],
) {
  return segments.map((segment) => {
    const segmentWords = words.filter((word) =>
      overlapsRange(word.startSec, word.endSec, segment.from, segment.to),
    );

    return {
      ...segment,
      words: segmentWords.length > 0 ? segmentWords : distributeWords(segment),
    };
  });
}

function groupWordsIntoSegments(input: {
  words: TranscriptWord[];
  fromSec: number;
  toSec: number;
  idPrefix: string;
}) {
  const segments: TranscribedSegment[] = [];
  let pending: TranscriptWord[] = [];
  let lastEnd = input.fromSec;

  const flush = () => {
    if (pending.length === 0) return;
    const first = pending[0]!;
    const last = pending[pending.length - 1]!;
    const from = Math.max(input.fromSec, first.startSec);
    const to = Math.min(input.toSec, last.endSec);
    if (to > from) {
      segments.push({
        id: `${input.idPrefix}-${segments.length}`,
        from,
        to,
        text: pending
          .map((word) => word.word)
          .join(" ")
          .trim(),
        words: pending,
      });
    }
    pending = [];
  };

  for (const word of input.words) {
    const gap = word.startSec - lastEnd;
    if (pending.length > 0 && (gap > 1.25 || pending.length >= 24)) {
      flush();
    }
    pending.push(word);
    lastEnd = word.endSec;
  }

  flush();
  return segments;
}

function normalizeDbWords(value: unknown): TranscriptWord[] {
  const parsed = z
    .array(
      z.object({
        word: z.string(),
        startSec: z.number(),
        endSec: z.number(),
      }),
    )
    .safeParse(value);

  return parsed.success ? parsed.data : [];
}

function normalizeDbSegment(segment: {
  id: number;
  startSec: number;
  endSec: number;
  text: string;
  words?: unknown;
}) {
  return {
    id: String(segment.id),
    from: segment.startSec,
    to: segment.endSec,
    startSec: segment.startSec,
    endSec: segment.endSec,
    text: segment.text,
    words: normalizeDbWords(segment.words),
  };
}

async function transcribeWithOpenAi(input: {
  fileBlob: Blob;
  model: "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
  fromSec: number;
  toSec: number;
  language?: string;
}) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const formData = new FormData();
  formData.append("model", input.model);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  formData.append("timestamp_granularities[]", "word");
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
    words?: OpenAIVerboseWord[];
  };
  const words = (json.words ?? [])
    .map((word) => ({
      word: (word.word ?? "").trim(),
      startSec: word.start ?? 0,
      endSec: word.end ?? word.start ?? 0,
    }))
    .filter(
      (word) =>
        word.word.length > 0 &&
        word.endSec > word.startSec &&
        overlapsRange(word.startSec, word.endSec, input.fromSec, input.toSec),
    );

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
          words: words.length > 0 ? words : undefined,
        },
      ],
    };
  }

  return { segments: attachWordsToSegments(segments, words) };
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
    return {
      segments: [] as Array<{
        id: string;
        from: number;
        to: number;
        text: string;
      }>,
    };
  }

  let parsedJson: unknown = null;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return {
      segments: [] as Array<{
        id: string;
        from: number;
        to: number;
        text: string;
      }>,
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
    return {
      segments: [] as Array<{
        id: string;
        from: number;
        to: number;
        text: string;
      }>,
    };
  }

  const segments = parsed.data.segments
    .map((segment, idx) => ({
      id: `gem-${idx}`,
      from: Math.max(input.fromSec, Math.floor(segment.from)),
      to: Math.min(input.toSec, Math.ceil(segment.to)),
      text: segment.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0 && segment.to > segment.from);

  return {
    segments: segments.map((segment) => ({
      ...segment,
      words: distributeWords(segment),
    })),
  };
}

async function transcribeWithGrokWhisper(input: {
  fileBlob: Blob;
  fileBytes: number;
  fromSec: number;
  toSec: number;
  language?: string;
}) {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }

  const baseUrl = (
    process.env.XAI_STT_BASE_URL ?? "https://api.x.ai/v1"
  ).replace(/\/+$/, "");
  const formData = new FormData();
  if (input.language) {
    formData.append("language", input.language);
    formData.append("format", "true");
  }
  formData.append("file", input.fileBlob, "audio-input.mp3");

  const res = await fetch(`${baseUrl}/stt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${xaiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Grok Whisper transcription failed: ${errText}`);
  }

  const json = (await res.json()) as {
    text?: string;
    duration?: number;
    words?: XaiSttWord[];
    channels?: Array<{ words?: XaiSttWord[] }>;
  };
  const rawWords =
    json.words ??
    json.channels?.flatMap((channel) => channel.words ?? []) ??
    [];
  const words = rawWords
    .map((word) => ({
      word: (word.text ?? "").trim(),
      startSec: word.start ?? 0,
      endSec: word.end ?? word.start ?? 0,
    }))
    .filter(
      (word) =>
        word.word.length > 0 &&
        word.endSec > word.startSec &&
        overlapsRange(word.startSec, word.endSec, input.fromSec, input.toSec),
    );

  const segments = groupWordsIntoSegments({
    words,
    fromSec: input.fromSec,
    toSec: input.toSec,
    idPrefix: "grok",
  });

  if (segments.length === 0 && json.text?.trim() && rawWords.length === 0) {
    segments.push({
      id: "grok-full",
      from: Math.floor(input.fromSec),
      to: Math.ceil(input.toSec),
      text: json.text.trim(),
      words: distributeWords({
        text: json.text.trim(),
        from: input.fromSec,
        to: input.toSec,
      }),
    });
  }

  const audioSeconds = json.duration ?? input.toSec - input.fromSec;
  return {
    segments,
    usage: {
      provider: "xai",
      model: "grok-whisper",
      audioSeconds,
      billableSeconds: audioSeconds,
      fileBytes: input.fileBytes,
      requestCount: 1,
    } satisfies TranscriptionUsage,
  };
}

function resolveTranscriptionModel(
  input: TranscribeRangeSchema,
): TranscriptionModel {
  if (input.model) return input.model;
  if (input.provider === "gemini") return "gemini-2.0-flash";
  if (input.provider === "grok") return "grok-whisper";
  if (input.provider === "whisper-local") return "whisper-local";
  return "gpt-4o-transcribe";
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getLocalTranscriberBaseUrl(value?: string) {
  return normalizeBaseUrl(
    value ??
      process.env.LOCAL_TRANSCRIBER_URL ??
      process.env.TRANSCRIBER_URL ??
      "http://127.0.0.1:8787",
  );
}

const transcriptChunkCacheEnabled = true;

export async function checkLocalTranscriber(baseUrl?: string) {
  const normalizedUrl = getLocalTranscriberBaseUrl(baseUrl);
  const res = await fetch(`${normalizedUrl}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Local transcriber health check failed (${res.status})`);
  }
  return (await res.json()) as {
    ok?: boolean;
    service?: string;
    model?: string;
    device?: string;
    status?: string;
    ready?: boolean;
    error?: string | null;
    loadSeconds?: number | null;
  };
}

async function transcribeWithLocalWhisper(input: {
  audioUrl: string;
  baseUrl?: string;
  fromSec: number;
  toSec: number;
  language?: string;
  force?: boolean;
}) {
  const baseUrl = getLocalTranscriberBaseUrl(input.baseUrl);
  const res = await fetch(`${baseUrl}/transcribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      audioUrl: input.audioUrl,
      from: input.fromSec,
      to: input.toSec,
      language: input.language ?? "ar",
      force: input.force ?? false,
      wordTimestamps: true,
    }),
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(
      `Local Whisper returned an unreadable response (${res.status})`,
    );
  }

  if (!res.ok) {
    const message =
      typeof json === "object" && json && "detail" in json
        ? JSON.stringify((json as { detail: unknown }).detail)
        : `HTTP ${res.status}`;
    throw new Error(`Local Whisper transcription failed: ${message}`);
  }

  const parsed = z
    .object({
      segments: z.array(
        z.object({
          start: z.number(),
          end: z.number(),
          text: z.string(),
          words: z
            .array(
              z.object({
                word: z.string(),
                start: z.number(),
                end: z.number(),
              }),
            )
            .optional(),
        }),
      ),
    })
    .safeParse(json);

  if (!parsed.success)
    return {
      segments: [] as Array<{
        id: string;
        from: number;
        to: number;
        text: string;
      }>,
    };

  const segments = parsed.data.segments
    .map((segment, idx) => ({
      id: `whisper-${idx}`,
      from: Math.max(input.fromSec, segment.start),
      to: Math.min(input.toSec, segment.end),
      text: segment.text.trim(),
      words: (segment.words ?? [])
        .map((word) => ({
          word: word.word.trim(),
          startSec: Math.max(input.fromSec, word.start),
          endSec: Math.min(input.toSec, word.end),
        }))
        .filter(
          (word) =>
            word.word.length > 0 &&
            word.endSec > word.startSec &&
            overlapsRange(
              word.startSec,
              word.endSec,
              input.fromSec,
              input.toSec,
            ),
        ),
    }))
    .filter((segment) => segment.text.length > 0 && segment.to > segment.from);

  return {
    segments: segments.map((segment) => ({
      ...segment,
      words:
        segment.words.length > 0 ? segment.words : distributeWords(segment),
    })),
  };
}

async function persistTranscribedSegments(input: {
  ctx: TRPCContext;
  mediaId: number;
  fromSec: number;
  toSec: number;
  segments: TranscribedSegment[];
  model: TranscriptionModel;
  chunkStartSec?: number;
  chunkEndSec?: number;
}) {
  const db = input.ctx.db as any;
  const transcript = await db.transcript.upsert({
    where: { mediaId: input.mediaId },
    create: { mediaId: input.mediaId, status: "done" },
    update: { status: "done", updatedAt: new Date() },
  });

  await db.transcriptSegment.deleteMany({
    where: {
      transcriptId: transcript.id,
      startSec: { gte: input.fromSec },
      endSec: { lte: input.toSec },
    },
  });

  if (input.segments.length > 0) {
    await db.transcriptSegment.createMany({
      data: input.segments.map((segment) => ({
        transcriptId: transcript.id,
        startSec: segment.from,
        endSec: segment.to,
        text: segment.text,
        chunkStartSec: input.chunkStartSec ?? input.fromSec,
        chunkEndSec: input.chunkEndSec ?? input.toSec,
        status: "done",
        words: segment.words ?? distributeWords(segment),
        model: input.model,
      })),
    });
  }

  return transcript;
}

export async function transcribeRange(
  ctx: TRPCContext,
  input: TranscribeRangeSchema,
): Promise<TranscriptionResult> {
  const { fileId, fromSec, toSec, language } = input;
  const model = resolveTranscriptionModel(input);
  if (toSec <= fromSec) {
    throw new Error("`toSec` must be greater than `fromSec`");
  }

  const { botToken, filePath } = await getTelegramFilePath(fileId);
  const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

  const result =
    model === "whisper-local"
      ? await transcribeWithLocalWhisper({
          audioUrl: telegramFileUrl,
          baseUrl: input.localTranscriberBaseUrl,
          fromSec,
          toSec,
          language,
          force: input.force,
        })
      : await (async () => {
          const upstreamRes = await fetch(telegramFileUrl, {
            cache: "no-store",
          });
          if (!upstreamRes.ok) {
            throw new Error(
              `Failed to fetch media from Telegram (${upstreamRes.status})`,
            );
          }

          const fileBuffer = await upstreamRes.arrayBuffer();
          const fileSize = fileBuffer.byteLength;
          const mimeType =
            upstreamRes.headers.get("content-type") ?? "audio/mpeg";
          const fileBlob = new Blob([fileBuffer], {
            type: mimeType,
          });

          if (
            (model === "gpt-4o-transcribe" ||
              model === "gpt-4o-mini-transcribe") &&
            fileSize > 24 * 1024 * 1024
          ) {
            throw new Error(
              "Audio file is too large for OpenAI transcription (>24MB). Use a shorter source audio.",
            );
          }
          if (model === "gemini-2.0-flash" && fileSize > 19 * 1024 * 1024) {
            throw new Error(
              "Audio file is too large for Gemini inline transcription (>19MB). Use a shorter source audio.",
            );
          }
          if (model === "grok-whisper" && fileSize > 500 * 1024 * 1024) {
            throw new Error(
              "Audio file is too large for Grok Whisper transcription (>500MB). Use a shorter source audio.",
            );
          }
          if (model === "grok-whisper") {
            return transcribeWithGrokWhisper({
              fileBlob,
              fileBytes: fileSize,
              fromSec,
              toSec,
              language,
            });
          }
          if (model === "gemini-2.0-flash") {
            return transcribeWithGemini({
              fileBase64: Buffer.from(fileBuffer).toString("base64"),
              mimeType,
              fromSec,
              toSec,
              language,
            });
          }

          const openAiModel =
            model === "gpt-4o-mini-transcribe"
              ? "gpt-4o-mini-transcribe"
              : "gpt-4o-transcribe";
          return transcribeWithOpenAi({
            fileBlob,
            model: openAiModel,
            fromSec,
            toSec,
            language,
          });
        })();

  if (input.mediaId) {
    await persistTranscribedSegments({
      ctx,
      mediaId: input.mediaId,
      fromSec,
      toSec,
      segments: result.segments,
      model,
    });
  }

  return result;
}

export async function getOrTranscribeTranscriptChunk(
  ctx: TRPCContext,
  input: TranscriptChunkSchema,
) {
  const db = ctx.db as any;
  const chunkStartSec = normalizeChunkStart(input);
  const chunkEndSec = chunkStartSec + input.chunkDurationSec;
  const model: TranscriptionModel = input.model ?? "whisper-local";

  const transcript = await db.transcript.upsert({
    where: { mediaId: input.mediaId },
    create: { mediaId: input.mediaId, status: "pending" },
    update: {},
  });

  const cachedSegments =
    !transcriptChunkCacheEnabled || input.force
      ? []
      : await db.transcriptSegment.findMany({
          where: {
            transcriptId: transcript.id,
            startSec: { gte: chunkStartSec },
            endSec: { lte: chunkEndSec },
            status: "done",
          },
          orderBy: { startSec: "asc" },
        });

  if (cachedSegments.length > 0) {
    return {
      mediaId: input.mediaId,
      chunkStartSec,
      chunkEndSec,
      status: "done" as const,
      cached: true,
      model: cachedSegments[0]?.model ?? model,
      segments: cachedSegments.map(normalizeDbSegment),
    };
  }

  try {
    await db.transcript.update({
      where: { mediaId: input.mediaId },
      data: { status: "processing", updatedAt: new Date() },
    });

    const result = await transcribeRange(ctx, {
      fileId: input.fileId,
      fromSec: chunkStartSec,
      toSec: chunkEndSec,
      model,
      localTranscriberBaseUrl: input.localTranscriberBaseUrl,
      language: input.language,
      force: input.force || !transcriptChunkCacheEnabled,
    });

    await persistTranscribedSegments({
      ctx,
      mediaId: input.mediaId,
      fromSec: chunkStartSec,
      toSec: chunkEndSec,
      segments: result.segments,
      model,
      chunkStartSec,
      chunkEndSec,
    });

    return {
      mediaId: input.mediaId,
      chunkStartSec,
      chunkEndSec,
      status: "done" as const,
      cached: false,
      model,
      usage: result.usage,
      segments: result.segments.map((segment) => ({
        ...segment,
        startSec: segment.from,
        endSec: segment.to,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    await db.transcript.update({
      where: { mediaId: input.mediaId },
      data: { status: "failed", updatedAt: new Date() },
    });
    await db.transcriptSegment.deleteMany({
      where: {
        transcriptId: transcript.id,
        startSec: { gte: chunkStartSec },
        endSec: { lte: chunkEndSec },
      },
    });
    await db.transcriptSegment.create({
      data: {
        transcriptId: transcript.id,
        startSec: chunkStartSec,
        endSec: chunkEndSec,
        text: "",
        chunkStartSec,
        chunkEndSec,
        status: "failed",
        model,
        error: message,
      },
    });
    throw err;
  }
}
