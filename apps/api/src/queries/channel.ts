// apps/api/src/db/queries/channel.ts
import type { TRPCContext } from "@api/trpc/init";
import { z } from "zod";
import { getClient } from "@telegram/telegram-client";

import { Api } from "telegram";
import { consoleLog } from "@acme/utils";
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
