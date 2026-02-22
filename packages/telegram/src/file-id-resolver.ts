// packages/telegram/src/file-id-resolver.ts
//
// Resolves a Bot API file_id for a media message by:
//   1. Temporarily deleting webhook so getUpdates works
//   2. Forwarding the message via MTProto to the bot's own chat
//   3. Long-polling getUpdates until the forwarded message arrives
//   4. Extracting the Bot API file_id
//   5. Restoring the webhook

import { Api, TelegramClient } from "telegram";

// ── Config ────────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BOT_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const RESOLVE_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 800;

// ── Bot API helper ────────────────────────────────────────────────────────────

async function botApi<T = any>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${BOT_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok)
    throw new Error(`Bot API ${method} failed: ${data.description}`);
  return data.result as T;
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

function extractFileId(msg: any): string | null {
  if (msg.photo) return msg.photo[msg.photo.length - 1].file_id;
  if (msg.video) return msg.video.file_id;
  if (msg.document) return msg.document.file_id;
  if (msg.audio) return msg.audio.file_id;
  if (msg.voice) return msg.voice.file_id;
  if (msg.video_note) return msg.video_note.file_id;
  if (msg.sticker) return msg.sticker.file_id;
  if (msg.animation) return msg.animation.file_id;
  return null;
}

// ── Main resolver ─────────────────────────────────────────────────────────────

export async function resolveFileId(
  mtprotoClient: TelegramClient,
  fromChatId: string | number,
  messageId: number,
): Promise<string | null> {
  // Step 1 – drop webhook so getUpdates doesn't conflict
  await dropWebhook();

  try {
    // Step 2 – get bot's own id (forward target = bot's Saved Messages)
    const me = await botApi<{ id: number }>("getMe");
    const botChatId = me.id;

    // Step 3 – snapshot offset to ignore pre-existing pending updates
    let offset = await getNextOffset();

    // Step 4 – forward via MTProto (works for private channels, no rate limit)
    await mtprotoClient.invoke(
      new Api.messages.ForwardMessages({
        fromPeer: fromChatId,
        id: [messageId],
        toPeer: botChatId,
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

        const isTarget =
          msg.chat?.id === botChatId &&
          msg.forward_from_message_id === messageId;

        if (isTarget) {
          // Clean up forwarded message from bot chat
          await botApi("deleteMessage", {
            chat_id: botChatId,
            message_id: msg.message_id,
          }).catch(() => {});

          return extractFileId(msg);
        }
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Timed out waiting for forwarded message (msgId=${messageId})`,
    );
  } finally {
    // Step 6 – always restore webhook whether resolution succeeded or failed
    await restoreWebhook();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
