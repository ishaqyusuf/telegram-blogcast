// lib/messageService.ts
//
// Single source of truth for fetching Telegram messages.
// Used by:
//   - app/api/telegram/channels/[channelId]/messages/route.ts  (one-shot HTTP)
//   - lib/messageFetcher.ts                                     (background loop)

import { getClient } from "@/lib/telegram-client";
import { resolveFileId } from "@/lib/file-id-resolver";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FetchedMessage {
    id: number;
    text: string | null;
    fileId: string | null; // Bot API file_id, null if no media or not resolved
    date: string; // ISO-8601 UTC
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

    /**
     * Continuation cursor for the background fetcher.
     * Returns messages with id GREATER THAN minId (i.e. newer).
     * Uses GramJS `minId` internally.
     */
    minId?: number;

    /** When true, resolves Bot API file_ids for media messages (adds latency). */
    resolveFiles?: boolean;
}

export interface FetchMessagesResult {
    messages: FetchedMessage[];
    /**
     * For one-shot/paginated use: id of the oldest message in this batch.
     * Pass as `startId` in the next request. Null when no more pages.
     */
    nextStartId: number | null;
}

// ── Core function ─────────────────────────────────────────────────────────────

export async function fetchMessages(
    channelId: string,
    options: FetchMessagesOptions = {},
): Promise<FetchMessagesResult> {
    const {
        limit: rawLimit = 20,
        startId,
        minId,
        resolveFiles = false,
    } = options;

    const limit = Math.min(rawLimit, 100);
    const client = await getClient();

    // Build GramJS getMessages options
    const getOptions: Record<string, unknown> = { limit };

    if (minId !== undefined) {
        // Fetcher mode: only messages newer than this id
        getOptions.minId = minId;
    } else if (startId !== undefined) {
        // Pagination mode: messages older than this id
        getOptions.offsetId = startId;
    }

    const rawMessages = await client.getMessages(channelId, getOptions);

    // Sort ascending (oldest first) so cursors advance correctly
    rawMessages.sort((a, b) => a.id - b.id);

    const messages: FetchedMessage[] = await Promise.all(
        rawMessages.map(async (msg) => {
            let fileId: string | null = null;

            if (resolveFiles && msg.media) {
                try {
                    fileId = await resolveFileId(client, channelId, msg.id);
                } catch (err) {
                    console.warn(
                        `[messageService] fileId resolution failed for msg ${msg.id}:`,
                        err,
                    );
                }
            }

            return {
                id: msg.id,
                text: msg.text ?? null,
                fileId,
                date: new Date(msg.date * 1000).toISOString(),
            };
        }),
    );

    // nextStartId: for paginated HTTP use — oldest id in this batch (or null if done)
    const nextStartId = messages.length === limit ? messages[0].id : null;

    return { messages, nextStartId };
}

