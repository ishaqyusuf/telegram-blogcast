// apps/api/src/db/queries/channel.ts
import type { TRPCContext } from "@api/trpc/init";
import { z } from "zod";
import { getClient } from "@telegram/telegram-client";
import { messageFetcher, type FetchedMessage } from "@telegram/message-fetcher";
import { Api } from "telegram";
import { saveBatch, type IncomingMessage } from "./blog";
import { consoleLog } from "@acme/utils";
import { type BlogMeta } from "../type";
// ── Schemas ───────────────────────────────────────────────────────────────────

export const syncChannelsSchema = z.object({}).optional();
export type SyncChannelsSchema = z.infer<typeof syncChannelsSchema>;

export const toggleFetchableSchema = z.object({
  channelId: z.number(),
  isFetchable: z.boolean(),
});
export type ToggleFetchableSchema = z.infer<typeof toggleFetchableSchema>;

// ── Queries ───────────────────────────────────────────────────────────────────
// apps/api/src/db/queries/channel.ts
// 🧩 Updated: replaced client.getDialogs() with Api.messages.GetDialogs invoke (matches old working pattern)

// helper — mirrors old isRTL usage (add your real one from utils if available)
function isRTL(text: string | null) {
  if (!text) return false;
  return /[\u0600-\u06FF\u0590-\u05FF]/.test(text);
}

interface FetchDialogsProps {
  offsetId?: number;
  offsetDate?: number;
  offsetPeer?: Api.TypeInputPeer;
  limit?: number;
  pages?: number;
  results?: TelegramChannel[];
}

interface TelegramChannel {
  id: unknown;
  title: string;
  username: string | null;
  date: Date | null;
  rtl: boolean;
  photo: unknown;
}

async function fetchTelegramChannels({
  offsetId = 0,
  offsetDate = 0,
  offsetPeer = new Api.InputPeerEmpty(),
  limit = 150,
  pages = 1,
  results = [],
}: FetchDialogsProps): Promise<TelegramChannel[]> {
  const client = await getClient();
  let hasMore = false;

  const result = await client.invoke(
    new Api.messages.GetDialogs({ offsetDate, offsetId, offsetPeer, limit }),
  );

  const dialogs = result.toJSON() as any;
  if ("chats" in dialogs) {
    for (const channel of dialogs.chats) {
      if ("username" in channel) {
        results.push({
          id: channel.id,
          title: channel.title,
          username: channel.username ?? null,
          date: channel.date ? new Date(channel.date * 1000) : null,
          rtl: isRTL(channel.title),
          photo: (channel.photo as any)?.photoId,
        });
      }
    }

    const dLen = dialogs.dialogs?.length - 1;
    if ("messages" in dialogs && dialogs.messages.length > 0) {
      const lastMsg = dialogs.messages[dialogs.messages.length - 1];
      if (lastMsg && "date" in lastMsg) {
        offsetId = lastMsg.id;
        offsetDate = lastMsg.date;
        offsetPeer = dialogs.dialogs?.[dLen]?.peer;
        hasMore = true;
      }
    }

    if (hasMore && pages < 6) {
      return fetchTelegramChannels({
        offsetPeer,
        offsetDate,
        offsetId,
        pages: pages + 1,
        results,
      });
    }
  }

  return results;
}

export async function syncChannels(ctx: TRPCContext) {
  const { db } = ctx;

  // 🧩 Updated: uses recursive GetDialogs invoke instead of client.getDialogs()
  const telegramChannels = await fetchTelegramChannels({});

  await Promise.all(
    telegramChannels
      .filter((ch) => ch.username) // skip channels without a username
      .map((ch) =>
        db.channel.upsert({
          where: { username: ch.username! },
          create: {
            username: ch.username!,
            title: ch.title,
            isFetchable: false,
          },
          update: { title: ch.title },
        }),
      ),
  );

  return db.channel.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/** Toggle isFetchable flag on a channel */
export async function toggleFetchable(
  ctx: TRPCContext,
  input: ToggleFetchableSchema,
) {
  const { db } = ctx;
  return db.channel.update({
    where: { id: input.channelId },
    data: { isFetchable: input.isFetchable },
  });
}

function withRTL<T extends { title: string | null }>(channels: T[]) {
  return channels.map((ch) => ({ ...ch, rtl: isRTL(ch.title) }));
}

export async function getFetchableChannels(ctx: TRPCContext) {
  const { db } = ctx;
  const channels = await db.channel.findMany({
    where: { deletedAt: null, isFetchable: true },
    orderBy: [{ isFetchable: "desc" }, { title: "asc" }],
  });
  return withRTL(channels);
}

export async function getChannels(ctx: TRPCContext) {
  const { db } = ctx;
  const channels = await db.channel.findMany({
    where: { deletedAt: null },
    orderBy: [{ isFetchable: "desc" }, { title: "asc" }],
  });
  return withRTL(channels);
}

export const startFetchSchema = z.object({
  channelId: z.number(),
  maxTotalFetch: z.number().positive().optional(), // 🧩 added
});
export type StartFetchSchema = z.infer<typeof startFetchSchema>;
/**
 * Resolves the resume cursor then starts the background fetcher.
 * Wires fetcher "messages" event → saveBatch() so each batch is persisted
 * to Blog before the next poll tick begins.
 */
export async function startFetch(ctx: TRPCContext, input: StartFetchSchema) {
  const { db } = ctx;

  const channel = await db.channel.findFirstOrThrow({
    where: { id: input.channelId, deletedAt: null, isFetchable: true },
    select: {
      id: true,
      username: true,
      lastMessageId: true,
      blogs: {
        select: {
          meta: true,
        },
      },
    },
  });
  const channelMessageIds = channel.blogs
    .map(
      (b) =>
        (b.meta as any as BlogMeta)?.telegramMessageId as number | undefined,
    )
    .filter((id): id is number => typeof id === "number")
    .sort((a, b) => a - b); // asc

  // Resolve cursor — channel.lastMessageId first, Blog.meta as fallback
  let lastMessageId = channelMessageIds?.[0] ?? null;

  // Re-wire listener on every start to avoid duplicates
  // @ts-ignore
  messageFetcher.removeAllListeners("event");
  // @ts-ignore
  messageFetcher.on("event", async (event) => {
    if (event.type !== "messages") return;

    const mapped: IncomingMessage[] = event.messages.map(
      (m: FetchedMessage) => ({
        id: m.id,
        text: m.text,
        date: m.date,
        media: (m as any).media ?? null,
      }),
    );
    consoleLog("[messageFetcher] fetched batch", {
      total: mapped.length,
      ids: mapped.map((m) => m.id),
    });
    // mapped.map((m,mi) => {
    //   consoleLog(`[messageFetcher] batch message ${mi}`, {
    //     id: m.id,
    //     text: m.text,
    //     date: m.date,
    //     media: m.media,
    //   });
    // });
    const result = await saveBatch(ctx, {
      channelId: channel.id,
      messages: mapped,
    }).catch((err) => consoleLog("[startFetch] saveBatch failed:", err));
    if (result?.created) {
      mapped.forEach((m) => {
        // messageFetcher exposes addKnownIds for this purpose
        messageFetcher.addKnownIds([m.id]);
      });
    }
  });

  messageFetcher.start({
    channelId: channel.id,
    channelUsername: channel.username,
    lastMessageId,
    resolveFiles: true,
    maxTotalFetch: input.maxTotalFetch, // 🧩 added
    channelMessageIds: channelMessageIds,
    allFetched: false,

    // allFetched: channel.allFetched ?? false,
  });

  return {
    ok: true,
    lastMessageId,
    channelId: channel.id,
    knownMessageCount: channelMessageIds.length,
  };
}

export async function stopFetch() {
  messageFetcher.stop();
  return { ok: true };
}

export async function getFetcherState() {
  return messageFetcher.getState();
}
