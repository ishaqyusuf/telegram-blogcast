// packages/telegram/src/file-id-resolver.ts
//
// Resolves a Bot API file_id for a media message by:
//   1. Temporarily deleting webhook so getUpdates works
//   2. Forwarding the message via MTProto to the bot's own chat
//   3. Long-polling getUpdates until the forwarded message arrives
//   4. Extracting the Bot API file_id
//   5. Restoring the webhook
//
// 🧩 Serialized via mutex — prevents concurrent getUpdates conflict error

import { consoleLog } from "@acme/utils";
import { Api, type TelegramClient } from "telegram";
import { extractResolvedMedia } from "./media-resolver";
import type { ResolvedMedia } from "./media-resolver";

// ── Config ────────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BOT_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const RESOLVE_TIMEOUT_MS = 15_000;
const BOT_API_TIMEOUT_MS = 3_000;
const BOT_API_COOLDOWN_MS = 60_000;
const POLL_INTERVAL_MS = 800;
let botApiUnavailableUntil = 0;

// ── Bot API helper ────────────────────────────────────────────────────────────

async function botApi<T = any>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const cooldownMs = botApiUnavailableUntil - Date.now();
  if (cooldownMs > 0) {
    throw new Error(
      `Bot API temporarily unavailable; skipping ${method} for ${Math.ceil(
        cooldownMs / 1000,
      )}s`,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOT_API_TIMEOUT_MS);

  try {
    const res = await fetch(`${BOT_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result: T;
    };
    if (!data.ok) {
      throw new Error(`Bot API ${method} failed: ${data.description}`);
    }
    return data.result;
  } catch (err) {
    if (isBotApiNetworkError(err)) {
      botApiUnavailableUntil = Date.now() + BOT_API_COOLDOWN_MS;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Webhook helpers ───────────────────────────────────────────────────────────

async function dropWebhook(): Promise<void> {
  await botApi("deleteWebhook", { drop_pending_updates: false });
}

async function restoreWebhook(): Promise<void> {
  const webhookUrl = process.env.TELEGRAM_BOT_WEBHOOK_URL;
  if (!webhookUrl) return;
  await botApi("setWebhook", { url: webhookUrl }).catch((err) => {
    console.warn("[file-id-resolver] failed to restore webhook:", err.message);
  });
}

// ── Offset helper ─────────────────────────────────────────────────────────────

async function getNextOffset(): Promise<number> {
  const updates = await botApi<any[]>("getUpdates", { limit: 1, offset: -1 });
  if (!updates.length) return 0;
  return updates[updates.length - 1].update_id + 1;
}

// ── File ID extractor ─────────────────────────────────────────────────────────

// function extractFileId(msg: any): string | null {
//   if (msg.photo) return msg.photo[msg.photo.length - 1].file_id;
//   if (msg.video) return msg.video.file_id;
//   if (msg.document) return msg.document.file_id;
//   if (msg.audio) return msg.audio.file_id;
//   if (msg.voice) return msg.voice.file_id;
//   if (msg.video_note) return msg.video_note.file_id;
//   if (msg.sticker) return msg.sticker.file_id;
//   if (msg.animation) return msg.animation.file_id;
//   return null;
// }

// ── Mutex — serializes concurrent calls to avoid getUpdates conflict ──────────
// 🧩 Each call chains onto the previous one, ensuring only one getUpdates
//    session is active at a time regardless of Promise.all batching

let resolveLock: Promise<unknown> = Promise.resolve();

export function resolveMediaBot(
  mtprotoClient: TelegramClient,
  fromChatId: string | number,
  messageId: number,
): Promise<ResolvedMedia | null> {
  const result = resolveLock.then(() =>
    _resolveFileId(mtprotoClient, fromChatId, messageId),
  );
  // Swallow on the lock chain so one failure doesn't block all subsequent calls
  resolveLock = result.catch(() => {});
  return result;
}

// ── Core resolver (private, runs exclusively via mutex) ───────────────────────
let cachedBotEntity:
  | Awaited<ReturnType<TelegramClient["getEntity"]>>[number]
  | null = null;
let cachedBotId: number | null = null;

async function getBotEntity(client: TelegramClient) {
  if (cachedBotEntity && cachedBotId) {
    return { entity: cachedBotEntity, id: cachedBotId };
  }
  const me = await botApi<{ id: number; username: string }>("getMe");
  cachedBotEntity = await client.getEntity(`@${me.username}`);
  cachedBotId = me.id;
  consoleLog("ME", { me });
  return { entity: cachedBotEntity, id: cachedBotId };
}

async function _resolveFileId(
  mtprotoClient: TelegramClient,
  fromChatId: string | number,
  messageId: number,
): Promise<ResolvedMedia | null> {
  try {
    // Step 1 – drop webhook so getUpdates doesn't conflict
    await dropWebhook();

    // Step 2 – get bot's own id (forward target = bot's Saved Messages)
    // const me = await botApi<{ id: number }>("getMe");
    // const me = await botApi<{ id: number; username: string }>("getMe");
    // const botChatId = me.id;

    // 🧩 Resolve bot entity via MTProto so GramJS caches it in session
    // Use username (always available on bots) — avoids PeerUser cache miss
    // const botEntity = await mtprotoClient.getEntity(`@${me.username}`);
    const { entity: botEntity, id: botChatId } =
      await getBotEntity(mtprotoClient);

    // Step 3 – snapshot offset to ignore pre-existing pending updates
    let offset = await getNextOffset();

    // Step 4 – forward via MTProto
    const forwardedAt = Date.now();
    await mtprotoClient.invoke(
      new Api.messages.ForwardMessages({
        fromPeer: fromChatId,
        id: [messageId],
        toPeer: botEntity,
        randomId: [
          BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) as any,
        ],
        silent: true,
      }),
    );

    // Step 5 – poll until forwarded message arrives
    const deadline = Date.now() + RESOLVE_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const updates = await botApi<any[]>("getUpdates", {
        offset,
        limit: 10,
        timeout: 1,
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        const msg = update.message || update.channel_post;

        if (!msg) continue;

        // const isTarget =
        //   msg.chat?.id === botChatId &&
        //   msg.forward_from_message_id === messageId;
        const isTarget =
          //   msg.chat?.id === parseInt(process.env.TELEGRAM_OWNER_USER_ID!) &&
          !!(
            msg.audio ||
            msg.photo ||
            msg.video ||
            msg.document ||
            msg.voice ||
            msg.animation ||
            msg.video_note
          ) && msg.date * 1000 >= forwardedAt - 2000; // within 2s of forward

        if (isTarget) {
          const deleteChatId = msg.chat?.id ?? botChatId;
          await botApi("deleteMessage", {
            chat_id: deleteChatId,
            message_id: msg.message_id,
          }).catch(() => {
            consoleLog(
              "Failed to delete forwarded message, might be already deleted:",
              {
                chat_id: deleteChatId,
                message_id: msg.message_id,
              },
            );
          });

          // const fileId = extractFileId(msg);
          // consoleLog("Resolved fileId", { messageId, fileId });
          // return fileId;
          return extractResolvedMedia(msg);
        }
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Timed out waiting for forwarded message (msgId=${messageId})`,
    );
  } finally {
    // Step 6 – always restore webhook
    await restoreWebhook();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBotApiNetworkError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (!(err instanceof Error)) return false;

  const code = (err as Error & { code?: string; cause?: { code?: string } })
    .code;
  const causeCode = (err as Error & { cause?: { code?: string } }).cause?.code;

  return (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
    err.name === "AbortError"
  );
}
