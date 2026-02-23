// lib/messageService.ts
//
// Single source of truth for fetching Telegram messages.
// Used by:
//   - app/api/telegram/channels/[channelId]/messages/route.ts  (one-shot HTTP)
//   - lib/messageFetcher.ts                                     (background loop)

import { getClient } from "./telegram-client";
import { Api } from "telegram";
import { consoleLog } from "@acme/utils";
import { resolveMediaBot } from "./media-bot-resolver";
import { ResolvedMedia } from "./media-resolver";
// ── Types ─────────────────────────────────────────────────────────────────────

export interface FetchedMessage {
  id: number;
  text: string | null;
  fileId: string | null; // Bot API file_id, null if no media or not resolved
  date: string; // ISO-8601 UTC
}
// packages/telegram/src/message-service.ts

// 🧩 Updated: FetchedMessage now carries structured media instead of flat fileId string

export interface FetchedMessage {
  id: number;
  text: string | null;
  date: string; // ISO-8601
  media: ResolvedMedia | null; // 🧩 was: fileId: string | null
}
export interface FetchMessagesOptions {
  /** Max messages to return (default 20, hard cap 100) */
  limit?: number;

  /**
   * Pagination cursor for one-shot fetches (HTTP route).
   * Returns messages with id LESS THAN startId (i.e. older).
   * Uses GramJS `offsetId` internally.
   */
  startId?: number;

  /** Optional lower-bound filter (messages must have id > minId). */
  minId?: number;

  /** When true, resolves Bot API file_ids for media messages (adds latency). */
  resolveFiles?: boolean;

  audio?: boolean;
  image?: boolean;
  video?: boolean;
  text?: boolean;
  document?: boolean;
}

export interface FetchMessagesResult {
  messages: FetchedMessage[];
  /**
   * For one-shot/paginated use: id of the oldest message in this batch.
   * Pass as `startId` in the next request. Null when no more pages.
   */
  nextStartId: number | null;

  lastMessageId: number | null;
}

// ── Core function ─────────────────────────────────────────────────────────────
type BlogType = "audio" | "image" | "video" | "text" | "document";

export async function fetchMessages(
  channelUsername: string,
  options: FetchMessagesOptions = {},
): Promise<FetchMessagesResult> {
  const {
    limit = 20,
    startId,
    minId,
    resolveFiles = false,
    audio = true,
    image = true,
    video = true,
    text = true,
    document = true,
  } = options;

  const client = await getClient();

  // 🧩 Key fix 1: use t.me/ prefix — matches your working fetchFromChannel
  const channel = await client.getEntity(`t.me/${channelUsername}`);

  // GetHistory pagination:
  // - offsetId: fetch messages older than this id (primary paging cursor)
  // - minId: optional lower-bound filter (messages newer than minId)
  const response = await client.invoke(
    new Api.messages.GetHistory({
      peer: channel,
      offsetId: startId ?? 0,
      limit,
      minId: minId ?? 0,
      maxId: 0,
      addOffset: 0,
      hash: BigInt(0) as any,
    }),
  );

  if (!("messages" in response)) {
    consoleLog("Unexpected response format from GetHistory:", response);
    return { messages: [], nextStartId: null, lastMessageId: null };
  }

  let lastMessageId: number | null = null;
  const unknownFormats: string[] = [];

  // 🧩 Key fix 4: mirror your filter logic exactly using instanceof checks
  const __messages = response.messages as Api.Message[];

  const filtered = __messages.filter((msg, index) => {
    if (index === response.messages.length - 1) {
      lastMessageId = msg.id;
    }

    if ("media" in msg && msg.media) {
      if (msg.media instanceof Api.MessageMediaPhoto) {
        return image;
      }

      if (msg.media instanceof Api.MessageMediaDocument) {
        const mt: string = (msg.media.document as any)?.mimeType ?? "";

        switch (mt) {
          case "application/pdf":
            return document;
          case "video/mp4":
            return video;
          case "audio/mpeg":
          case "audio/MP3":
          case "audio/mp3":
          case "audio/mp4":
          case "audio/m4a":
          case "audio/aac":
          case "audio/ogg":
          case "audio/amr":
            return audio;
          default: {
            const [type] = mt.split("/");
            switch (type) {
              case "audio":
                return audio;
              case "image":
                return image;
              case "video":
                return video;
              default:
                unknownFormats.push(mt);
                return false;
            }
          }
        }
      }
    }

    return text;
  });
  consoleLog(
    "Message Ids",
    filtered.map((a) => a.id),
  );
  // Sort ascending (oldest first) — consistent with fetcher cursor logic
  filtered.sort((a, b) => a.id - b.id);

  // 🧩 Map + resolve file_ids
  const messages: FetchedMessage[] = await Promise.all(
    filtered.map(async (msg) => {
      const mediaMeta = extractMediaMeta(msg);
      let media: ResolvedMedia | null = null;

      if (mediaMeta && resolveFiles) {
        try {
          const botMedia = await resolveMediaBot(
            client,
            channelUsername,
            msg.id,
          );
          media = botMedia ? { ...mediaMeta, ...botMedia } : null;
        } catch (err) {
          consoleLog(
            "[message-service]",
            `fileId resolution failed msg=${msg.id}:`,
            err,
          );
        }
      }
      // consoleLog("Fetched message", {
      //   id: msg.id,
      //   text: msg.text,
      //   mediaMeta,
      //   resolvedFileId: media?.fileId ?? null,
      // });
      return {
        id: msg.id,
        text: ("message" in msg ? msg.message : null) ?? null,
        date: new Date((msg as any).date * 1000).toISOString(),
        media: media!,
      };
    }),
  );

  const nextStartId = messages.length === limit ? messages?.[0]?.id! : null;

  return { messages, nextStartId, lastMessageId };
}
function extractMediaMeta(
  msg: Api.Message,
): (Omit<ResolvedMedia, "fileId"> & { type: BlogType }) | null {
  if (!("media" in msg) || !msg.media) return null;

  // ── Photo ────────────────────────────────────────────────────────────────
  if (msg.media instanceof Api.MessageMediaPhoto) {
    const photo = msg.media.photo as any;
    const largest = photo?.sizes?.at(-1);
    return {
      type: "image",
      mimeType: "image/jpeg",
      // width: largest?.w,
      // height: largest?.h,
    };
  }

  // ── Document (audio, video, pdf, etc.) ───────────────────────────────────
  if (msg.media instanceof Api.MessageMediaDocument) {
    const doc = msg.media.document as any;
    const mimeType: string = doc?.mimeType ?? "application/octet-stream";
    const attrs = (doc?.attributes ?? []) as any[];

    const audioAttr = attrs.find(
      (a) => a instanceof Api.DocumentAttributeAudio,
    );
    const videoAttr = attrs.find(
      (a) => a instanceof Api.DocumentAttributeVideo,
    );
    const fileAttr = attrs.find(
      (a) => a instanceof Api.DocumentAttributeFilename,
    );

    const base = {
      mimeType,
      title: audioAttr?.title ?? fileAttr?.fileName ?? undefined,
      // author: audioAttr?.performer ?? undefined,
      // duration: audioAttr?.duration ?? videoAttr?.duration ?? undefined,
      // width: videoAttr?.w ?? undefined,
      // height: videoAttr?.h ?? undefined,
      // fileSize: doc?.size ?? undefined,
    };

    // Mirror your old mimeType switch exactly
    const [mediaType] = mimeType.split("/");
    switch (mimeType) {
      case "application/pdf":
        return { ...base, type: "document" };
      case "video/mp4":
        return { ...base, type: "video" };
      case "audio/mpeg":
      case "audio/MP3":
      case "audio/mp3":
      case "audio/mp4":
      case "audio/m4a":
      case "audio/aac":
      case "audio/ogg":
      case "audio/amr":
        return { ...base, type: "audio" };
      default:
        switch (mediaType) {
          case "audio":
            return { ...base, type: "audio" };
          case "image":
            return { ...base, type: "image" };
          case "video":
            return { ...base, type: "video" };
          default:
            return null; // unknown — skip
        }
    }
  }

  return null;
}
