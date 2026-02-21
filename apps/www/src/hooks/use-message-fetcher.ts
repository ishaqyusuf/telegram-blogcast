// hooks/useMessageFetcher.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
    FetchedMessage,
    FetcherState,
    FetcherEvent,
} from "@/lib/message-fetcher";

export type { FetchedMessage, FetcherState };

interface UseMessageFetcherReturn {
    /** All messages received so far (newest last) */
    messages: FetchedMessage[];
    /** Live fetcher state from the server */
    state: FetcherState | null;
    /** True while the SSE connection itself is being established */
    connecting: boolean;
    /** Start the fetcher for a channel, optionally from a cursor */
    start: (channelId: string, startId?: number) => Promise<void>;
    /** Stop the fetcher */
    stop: () => Promise<void>;
    /** Clear the local message buffer */
    clearMessages: () => void;
}

export function useMessageFetcher(): UseMessageFetcherReturn {
    const [messages, setMessages] = useState<FetchedMessage[]>([]);
    const [state, setState] = useState<FetcherState | null>(null);
    const [connecting, setConnecting] = useState(true);

    const eventSourceRef = useRef<EventSource | null>(null);

    // ── SSE connection ──────────────────────────────────────────────────────────

    useEffect(() => {
        const es = new EventSource("/api/telegram/fetcher/stream");
        eventSourceRef.current = es;
        setConnecting(true);

        es.onopen = () => setConnecting(false);

        es.onmessage = (e) => {
            const event = JSON.parse(e.data) as FetcherEvent;

            if (event.type === "state") {
                setState(event.state);
            } else if (event.type === "messages") {
                setMessages((prev) => [...prev, ...event.messages]);
            } else if (event.type === "error") {
                console.warn(
                    "[useMessageFetcher] Server error:",
                    event.error,
                    `retrying in ${event.retryIn}ms`,
                );
            }
        };

        es.onerror = () => {
            // EventSource auto-reconnects; just mark connecting again
            setConnecting(true);
        };

        return () => {
            es.close();
            eventSourceRef.current = null;
        };
    }, []);

    // ── Control helpers ─────────────────────────────────────────────────────────

    const start = useCallback(async (channelId: string, startId?: number) => {
        setMessages([]); // clear buffer on new start
        await fetch("/api/telegram/fetcher", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId, startId }),
        });
    }, []);

    const stop = useCallback(async () => {
        await fetch("/api/telegram/fetcher", { method: "DELETE" });
    }, []);

    const clearMessages = useCallback(() => setMessages([]), []);

    return { messages, state, connecting, start, stop, clearMessages };
}

