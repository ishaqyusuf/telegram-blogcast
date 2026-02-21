// hooks/useTelegram.js
// Includes useChannels, useMessages (with optional eager file resolution),
// and useFileId (lazy per-message resolution on demand).
"use client";
import { useState, useCallback } from "react";

// ── Fetch channel list ────────────────────────────────────────────────────────

export function useChannels() {
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchChannels = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/telegram/channels");
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setChannels(data.channels);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    return { channels, loading, error, fetchChannels };
}

// ── Fetch messages with pagination ───────────────────────────────────────────

export function useMessages(channelId) {
    const [messages, setMessages] = useState([]);
    const [nextStartId, setNextStartId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    /**
     * fetchMessages – call with no args for first page, or pass startId to resume.
     * Pass reset=true to clear existing messages (e.g. when switching channel).
     */
    const fetchMessages = useCallback(
        async ({ startId = undefined, limit = 20, reset = false } = {}) => {
            if (!channelId) return;
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({ limit: limit.toString() });
                if (!!startId) params.set("startId", startId);

                const res = await fetch(
                    `/api/telegram/channels/${channelId}/messages?${params}`,
                );
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();

                setMessages((prev) =>
                    reset ? data.messages : [...prev, ...data.messages],
                );
                setNextStartId(data.nextStartId);
                setHasMore(data.nextStartId !== null);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        },
        [channelId],
    );

    /** Convenience: load the next page using the cursor from the last fetch */
    const fetchNextPage = useCallback(() => {
        if (nextStartId) fetchMessages({ startId: nextStartId });
    }, [fetchMessages, nextStartId]);

    return { messages, loading, error, hasMore, fetchMessages, fetchNextPage };
}

// ── Lazy file_id resolution ───────────────────────────────────────────────────

/**
 * useFileId – resolves a single Bot API file_id on demand.
 *
 * Usage:
 *   const { fileId, loading, resolve } = useFileId();
 *   <button onClick={() => resolve(channelId, messageId)}>Get file</button>
 */
export function useFileId() {
    const [fileId, setFileId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const resolve = useCallback(async (channelId, messageId) => {
        setLoading(true);
        setFileId(null);
        setError(null);
        try {
            const res = await fetch("/api/telegram/resolve-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId, messageId }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setFileId(data.fileId);
            return data.fileId;
        } catch (e) {
            setError(e.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return { fileId, loading, error, resolve };
}

