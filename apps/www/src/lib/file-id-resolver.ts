import { Api } from "telegram";
// lib/fileIdResolver.js
//
// Resolves a Bot API file_id for a media message by:
//   1. Forwarding the message from the source channel to the bot's own chat (via MTProto)
//   2. Long-polling getUpdates until the forwarded message arrives
//   3. Extracting and returning the Bot API file_id
//
// This is necessary because MTProto access hashes are NOT usable with the
// Bot API download endpoint (api.telegram.org/file/bot<token>/...).

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// How long to wait for the forwarded message to appear (ms)
const RESOLVE_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 800;

/**
 * Calls Bot API and returns parsed JSON, throwing on error.
 */
async function botApi(method, params = {}) {
    const res = await fetch(`${BOT_API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!data.ok)
        throw new Error(`Bot API ${method} failed: ${data.description}`);
    return data.result;
}

/**
 * Returns the Bot API file_id for a media message.
 *
 * @param {TelegramClient} mtprotoClient  – connected GramJS client
 * @param {string|number}  fromChatId     – source channel id (number or @username)
 * @param {number}         messageId      – message id in the source channel
 * @returns {Promise<string|null>}         – Bot API file_id, or null if no media
 */
export async function resolveFileId(mtprotoClient, fromChatId, messageId) {
    // Step 1 – get the bot's own user id (used as the target chat for forwarding)
    const me = await botApi("getMe");
    const botChatId = me.id; // forwarding to the bot itself = Saved Messages of the bot

    // Step 2 – grab the current update offset so we only watch NEW updates
    let offset = await getNextOffset();

    // Step 3 – forward the message via MTProto (avoids bot-forward rate limits
    //           and works even if the source channel is private)
    await mtprotoClient.invoke(
        new // await import("telegram/tl/functions/messages")
        Api.messages.ForwardMessages({
            fromPeer: fromChatId,
            id: [messageId],
            toPeer: botChatId,
            randomId: [
                BigInt(
                    Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
                ) as any,
            ],
            silent: true,
        }),
    );

    // Step 4 – poll getUpdates until we see the forwarded message arrive
    const deadline = Date.now() + RESOLVE_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const updates = await botApi("getUpdates", {
            offset,
            limit: 10,
            timeout: 1, // short-poll
        });

        for (const update of updates) {
            offset = update.update_id + 1; // advance cursor

            const msg = update.message || update.channel_post;
            if (!msg) continue;

            // Match: message in bot chat that is a forward of our target message
            const isTarget =
                msg.chat?.id === botChatId &&
                msg.forward_from_message_id === messageId;

            if (isTarget) {
                // Clean up – delete the forwarded message from the bot chat
                await botApi("deleteMessage", {
                    chat_id: botChatId,
                    message_id: msg.message_id,
                }).catch(() => {}); // non-critical

                return extractFileId(msg);
            }
        }

        await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
        `Timed out waiting for forwarded message (msgId=${messageId})`,
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Gets the next update_id offset by peeking at pending updates.
 * We use limit=1 and skip everything so we start fresh after forwarding.
 */
async function getNextOffset() {
    const updates = await botApi("getUpdates", { limit: 1, offset: -1 });
    if (updates.length === 0) return 0;
    return updates[updates.length - 1].update_id + 1;
}

/**
 * Extracts the highest-quality file_id from a Bot API message object.
 */
function extractFileId(msg) {
    if (msg.photo) {
        // photo is an array sorted by size; last = largest
        return msg.photo[msg.photo.length - 1].file_id;
    }
    if (msg.video) return msg.video.file_id;
    if (msg.document) return msg.document.file_id;
    if (msg.audio) return msg.audio.file_id;
    if (msg.voice) return msg.voice.file_id;
    if (msg.video_note) return msg.video_note.file_id;
    if (msg.sticker) return msg.sticker.file_id;
    if (msg.animation) return msg.animation.file_id;
    return null;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

