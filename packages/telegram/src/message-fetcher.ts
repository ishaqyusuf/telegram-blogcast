// packages/telegram/src/message-fetcher.ts
//
// Singleton background loop. Moved from apps/www into packages/telegram so it
// can be imported by apps/api (tRPC) rather than running in the Next.js process.
//
// Flow per channel:
//   1. Fetch without cursor → compare against DB lastMessageId to find gap
//   2. Resume from lastMessageId and keep it updated after every batch
//   3. After each batch emits → caller (tRPC mutation) persists to Blog table

import { EventEmitter } from "events";
import { fetchMessages } from "./message-service";
import type { FetchedMessage } from "./message-service";

export type { FetchedMessage };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FetcherState {
  status: "idle" | "running" | "retrying" | "stopped";
  channelUsername: string;
  channelId: number;
  lastMessageId: number | null;
  totalFetched: number;
  error: string | null;
  retryCount: number;
}

export type FetcherEvent =
  | { type: "messages"; messages: FetchedMessage[] }
  | { type: "state"; state: FetcherState }
  | { type: "error"; error: string; retryIn: number };

export interface StartFetcherInput {
  channelId: number;
  channelUsername: string;
  /** Cursor from DB (channel.lastMessageId). Fetcher uses minId to get newer msgs. */
  lastMessageId: number | null;
  resolveFiles?: boolean;
}

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 20;
const POLL_INTERVAL_MS = 3_000;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

// ── Singleton guard ───────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __messageFetcher: MessageFetcher | undefined;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

class MessageFetcher extends EventEmitter {
  private state: FetcherState = {
    status: "idle",
    channelUsername: "",
    channelId: 0,
    lastMessageId: null,
    totalFetched: 0,
    error: null,
    retryCount: 0,
  };

  private abortController: AbortController | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  start(input: StartFetcherInput): void {
    this.stop();

    this.state = {
      status: "running",
      channelUsername: input.channelUsername,
      channelId: input.channelId,
      lastMessageId: input.lastMessageId,
      totalFetched: 0,
      error: null,
      retryCount: 0,
    };

    this.abortController = new AbortController();
    this.emitState();
    this.loop(this.abortController.signal, input.resolveFiles ?? false);
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

  // ── Loop ────────────────────────────────────────────────────────────────────

  private async loop(
    signal: AbortSignal,
    resolveFiles: boolean,
  ): Promise<void> {
    let retryDelay = RETRY_BASE_MS;

    while (!signal.aborted) {
      try {
        await this.poll(signal, resolveFiles);

        retryDelay = RETRY_BASE_MS;
        this.setState({ error: null, retryCount: 0, status: "running" });
        await this.sleep(POLL_INTERVAL_MS, signal);
      } catch (err: unknown) {
        if (signal.aborted) break;

        const error = err instanceof Error ? err.message : String(err);
        const retryCount = this.state.retryCount + 1;

        console.error(`[MessageFetcher] Error (attempt ${retryCount}):`, error);

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

  // ── Poll ─────────────────────────────────────────────────────────────────────
  // Step 1: if no lastMessageId yet, do a probe fetch (no minId) to get the
  //         latest messageId from Telegram, then compare with DB cursor.
  // Step 2: fetch with minId = lastMessageId to only get newer messages.

  private async poll(
    signal: AbortSignal,
    resolveFiles: boolean,
  ): Promise<void> {
    const { channelUsername, lastMessageId } = this.state;

    // Step 1 – probe when no cursor exists
    if (lastMessageId === null) {
      const probe = await fetchMessages(channelUsername, {
        limit: 1,
        resolveFiles: false,
      });
      if (signal.aborted || probe.messages.length === 0) return;

      // Seed the cursor without emitting (no new content yet to persist)
      this.setState({ lastMessageId: probe.messages?.[0]?.id ?? null });
      return;
    }

    // Step 2 – fetch only messages newer than cursor
    const { messages } = await fetchMessages(channelUsername, {
      limit: BATCH_SIZE,
      minId: lastMessageId,
      resolveFiles,
    });

    if (signal.aborted || messages.length === 0) return;

    // messages are sorted ascending by message-service
    const newLastId = messages[messages.length - 1]?.id ?? null;
    this.setState({
      lastMessageId: newLastId,
      totalFetched: this.state.totalFetched + messages.length,
    });

    // Emit batch — the tRPC subscription / SSE listener will persist to DB
    this.emit("event", { type: "messages", messages } satisfies FetcherEvent);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Singleton export ──────────────────────────────────────────────────────────

function getMessageFetcher(): MessageFetcher {
  if (!global.__messageFetcher) {
    global.__messageFetcher = new MessageFetcher();
  }
  return global.__messageFetcher;
}

export const messageFetcher = getMessageFetcher();
// messageFetcher.start
