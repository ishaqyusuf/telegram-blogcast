// lib/messageFetcher.ts
//
// Background singleton loop that continuously fetches new messages from a
// Telegram channel and pushes them via EventEmitter.
// Delegates all fetch logic to messageService — no GramJS calls here.
//
// Features:
//   - Automatic retry with exponential backoff on any failure
//   - Cursor-based polling (only fetches messages newer than last seen)
//   - Survives Next.js HMR via global singleton

import { EventEmitter } from "events";
import { fetchMessages } from "@/lib/message-service";
import type { FetchedMessage } from "@/lib/message-service";

// Re-export so consumers can import everything from one place
export type { FetchedMessage };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FetcherState {
    status: "idle" | "running" | "retrying" | "stopped";
    channelId: string;
    lastMessageId: number | null; // cursor — newest id successfully processed
    totalFetched: number;
    error: string | null;
    retryCount: number;
}

export type FetcherEvent =
    | { type: "messages"; messages: FetchedMessage[] }
    | { type: "state"; state: FetcherState }
    | { type: "error"; error: string; retryIn: number };

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 20;
const POLL_INTERVAL_MS = 2_000;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;
const RESOLVE_FILES = true;

// ── Singleton guard (survives Next.js HMR) ────────────────────────────────────

declare global {
    // eslint-disable-next-line no-var
    var __messageFetcher: MessageFetcher | undefined;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

class MessageFetcher extends EventEmitter {
    private state: FetcherState = {
        status: "idle",
        channelId: "",
        lastMessageId: null,
        totalFetched: 0,
        error: null,
        retryCount: 0,
    };

    private abortController: AbortController | null = null;

    // ── Public API ──────────────────────────────────────────────────────────────

    /**
     * Start (or restart) the background loop.
     *
     * @param channelId  Channel id or @username to poll
     * @param startId    Resume cursor — only messages with id > startId are fetched
     */
    start(channelId: string, startId?: number): void {
        this.stop();

        this.state = {
            status: "running",
            channelId,
            lastMessageId: startId ?? null,
            totalFetched: 0,
            error: null,
            retryCount: 0,
        };

        this.abortController = new AbortController();
        this.emitState();
        this.loop(this.abortController.signal);
    }

    stop(): void {
        this.abortController?.abort();
        this.abortController = null;
        if (this.state.status !== "idle") {
            this.setState({ status: "stopped" });
        }
    }

    getState(): FetcherState {
        return { ...this.state };
    }

    // ── Internal loop ───────────────────────────────────────────────────────────

    private async loop(signal: AbortSignal): Promise<void> {
        let retryDelay = RETRY_BASE_MS;

        while (!signal.aborted) {
            try {
                await this.poll(signal);

                retryDelay = RETRY_BASE_MS;
                this.setState({
                    error: null,
                    retryCount: 0,
                    status: "running",
                });
                await this.sleep(POLL_INTERVAL_MS, signal);
            } catch (err: unknown) {
                if (signal.aborted) break;

                const error = err instanceof Error ? err.message : String(err);
                const retryCount = this.state.retryCount + 1;

                console.error(
                    `[MessageFetcher] Error (attempt ${retryCount}):`,
                    error,
                );

                this.setState({ status: "retrying", error, retryCount });
                this.emit("event", {
                    type: "error",
                    error,
                    retryIn: retryDelay,
                } satisfies FetcherEvent);

                await this.sleep(retryDelay, signal);
                retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);

                if (!signal.aborted) this.setState({ status: "running" });
            }
        }
    }

    /** One poll tick — delegates to messageService */
    private async poll(signal: AbortSignal): Promise<void> {
        const { channelId, lastMessageId } = this.state;

        const { messages } = await fetchMessages(channelId, {
            limit: BATCH_SIZE,
            minId: lastMessageId ?? undefined, // only newer messages
            resolveFiles: RESOLVE_FILES,
        });

        if (signal.aborted || messages.length === 0) return;

        // messages are sorted ascending by messageService
        const newLastId = messages[messages.length - 1].id;
        this.setState({
            lastMessageId: newLastId,
            totalFetched: this.state.totalFetched + messages.length,
        });

        this.emit("event", {
            type: "messages",
            messages,
        } satisfies FetcherEvent);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private setState(patch: Partial<FetcherState>): void {
        this.state = { ...this.state, ...patch };
        this.emitState();
    }

    private emitState(): void {
        this.emit("event", {
            type: "state",
            state: this.getState(),
        } satisfies FetcherEvent);
    }

    private sleep(ms: number, signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, ms);
            signal.addEventListener(
                "abort",
                () => {
                    clearTimeout(timer);
                    reject(new DOMException("Aborted", "AbortError"));
                },
                { once: true },
            );
        });
    }
}

// ── Export singleton ──────────────────────────────────────────────────────────

function getMessageFetcher(): MessageFetcher {
    if (!global.__messageFetcher) {
        global.__messageFetcher = new MessageFetcher();
    }
    return global.__messageFetcher;
}

export const messageFetcher = getMessageFetcher();

