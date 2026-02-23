// packages/telegram/src/message-fetcher.ts
// 🧩 Rewritten: two-phase fetch logic
//
// Phase 1 — Recent sweep (runs every poll tick):
//   Fetch latest batch (no cursor) → compare against DB channelMessageIds
//   If NO messages exist in DB → new content found, walk backwards via offsetId
//   until we hit known territory (some message exists in DB)
//
// Phase 2 — Historical backfill (runs if channel.allFetched = false):
//   Resume from channel.lastMessageId going backwards (older messages)
//   When batch is empty → set allFetched = true on channel
//
// Each batch is emitted immediately → wired to saveBatch() in startFetch()

import { EventEmitter } from "events";
import { fetchMessages } from "./message-service";
import type { FetchedMessage } from "./message-service";
import { consoleLog } from "@acme/utils";

export type { FetchedMessage };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FetcherState {
  status: "idle" | "running" | "retrying" | "stopped";
  channelUsername: string;
  channelId: number;
  phase: "recent" | "backfill" | "idle";
  lastMessageId: number | null; // DB cursor (oldest fetched so far)
  allFetched: boolean;
  totalFetched: number;
  error: string | null;
  retryCount: number;
}

export type FetcherEvent =
  | {
      type: "messages";
      messages: FetchedMessage[];
      phase: FetcherState["phase"];
    }
  | { type: "state"; state: FetcherState }
  | { type: "allFetched" } // signal to set allFetched=true in DB
  | { type: "error"; error: string; retryIn: number };

export interface StartFetcherInput {
  channelId: number;
  channelUsername: string;
  lastMessageId: number | null; // from channel.lastMessageId in DB
  allFetched: boolean; // from channel.allFetched in DB
  channelMessageIds: number[]; // existing telegramMessageIds for this channel
  resolveFiles?: boolean;
  maxTotalFetch?: number | null;
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
    phase: "idle",
    lastMessageId: null,
    allFetched: false,
    totalFetched: 0,
    error: null,
    retryCount: 0,
  };

  private abortController: AbortController | null = null;
  private channelMessageIds: Set<number> = new Set();
  private resolveFiles: boolean = false;
  private maxTotalFetch: number | null | undefined;

  // ── Public API ──────────────────────────────────────────────────────────────
  public addKnownIds(ids: number[]): void {
    ids.forEach((id) => this.channelMessageIds.add(id));
  }
  start(input: StartFetcherInput): void {
    this.stop();

    this.channelMessageIds = new Set(input.channelMessageIds);
    this.resolveFiles = input.resolveFiles ?? false;
    this.maxTotalFetch = input.maxTotalFetch;
    // consoleLog("Channel Message IDs", Array.from(this.channelMessageIds));
    this.state = {
      status: "running",
      channelUsername: input.channelUsername,
      channelId: input.channelId,
      phase: "recent",
      lastMessageId: input.lastMessageId,
      allFetched: false,
      // allFetched: input.allFetched,
      totalFetched: 0,
      error: null,
      retryCount: 0,
    };

    if (this.shouldStopForLimit()) {
      this.setState({ status: "stopped", phase: "idle" });
      return;
    }

    this.abortController = new AbortController();
    this.emitState();
    this.loop(this.abortController.signal);
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    if (this.state.status !== "idle") {
      this.setState({ status: "stopped", phase: "idle" });
    }
  }

  getState(): FetcherState {
    return { ...this.state };
  }

  // ── Main loop ───────────────────────────────────────────────────────────────

  private async loop(signal: AbortSignal): Promise<void> {
    let retryDelay = RETRY_BASE_MS;

    while (!signal.aborted) {
      try {
        if (this.shouldStopForLimit()) {
          this.stop();
          break;
        }

        // Phase 1: always check for recent messages first
        await this.recentSweep(signal);
        if (signal.aborted) break;

        // Phase 2: backfill if not fully fetched
        if (!this.state.allFetched) {
          await this.backfill(signal);
          if (signal.aborted) break;
        }

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

  // ── Phase 1: Recent sweep ────────────────────────────────────────────────────
  // Fetch latest messages (no cursor). Walk backwards via offsetId until we hit
  // a message already in DB. Emit each new batch as we go.

  private async recentSweep(signal: AbortSignal): Promise<void> {
    this.setState({ phase: "recent" });

    let offsetId: number | undefined = undefined; // undefined = fetch
    while (!signal.aborted) {
      const limit = this.limit;
      if (limit === null || limit === 0) {
        this.stop();
        return;
      }

      const { messages } = await fetchMessages(this.state.channelUsername, {
        limit,
        startId: offsetId, // undefined on first call = latest; then walk backwards
        resolveFiles: this.resolveFiles,
      });

      if (signal.aborted) return;

      // No messages at all — channel is empty or private
      if (messages.length === 0) return;

      // Check how many of this batch already exist in DB
      const newMessages = messages.filter(
        (m) => !this.channelMessageIds.has(m.id),
      );
      const hasKnown = messages.some((m) => this.channelMessageIds.has(m.id));

      // Emit only the genuinely new ones
      if (newMessages.length > 0) {
        await this.emitBatch(newMessages, "recent");
        if (signal.aborted) return;
        // Add to local set so we don't re-emit on next sweep
        newMessages.forEach((m) => this.channelMessageIds.add(m.id));
      }

      // If we hit a known message — we've caught up to existing territory
      if (hasKnown) return;

      // All messages in this batch are new — there might be more newer ones
      // Walk backwards: use the oldest id in this batch as next offsetId
      const oldestInBatch = messages[0]?.id!; // sorted ascending by message-service
      offsetId = oldestInBatch;

      // Safety: if we've reached or passed the DB cursor, stop Phase 1
      if (
        this.state.lastMessageId !== null &&
        oldestInBatch <= this.state.lastMessageId
      )
        return;
      if (this.shouldStopForLimit()) {
        this.stop();
        return;
      }
    }
  }

  // ── Phase 2: Historical backfill ─────────────────────────────────────────────
  // Resume from channel.lastMessageId going backwards (older messages).
  // Runs one batch per loop iteration to interleave with recent sweeps.
  // Sets allFetched=true when batch is empty (hit the beginning).
  get limit(): number | null {
    if (this.maxTotalFetch === null) return null;
    if (this.maxTotalFetch === undefined) return BATCH_SIZE;

    const lm = Math.min(
      BATCH_SIZE,
      this.maxTotalFetch - this.state.totalFetched,
    );
    return Math.max(lm, 0);
  }
  private async backfill(signal: AbortSignal): Promise<void> {
    this.setState({ phase: "backfill" });

    const limit = this.limit;
    if (limit === null || limit === 0) {
      this.stop();
      return;
    }

    const { messages } = await fetchMessages(this.state.channelUsername, {
      limit,
      // offsetId here means "get messages older than this id"
      startId: this.state.lastMessageId! ?? undefined,
      resolveFiles: this.resolveFiles,
    });

    if (signal.aborted) return;

    // Empty batch = we've reached the very first message in the channel
    if (messages.length === 0 && this.state.lastMessageId !== null) {
      this.setState({ allFetched: true });
      this.emit("event", { type: "allFetched" } satisfies FetcherEvent);
      return;
    }

    const newMessages = messages.filter(
      (m) => !this.channelMessageIds.has(m.id),
    );

    if (newMessages.length > 0) {
      await this.emitBatch(newMessages, "backfill");
      newMessages.forEach((m) => this.channelMessageIds.add(m.id));
    }

    // Advance DB cursor to the oldest message in this batch
    const oldestId = messages[0]?.id!; // sorted ascending
    this.setState({ lastMessageId: oldestId });
  }

  // ── Emit batch + check maxTotalFetch ─────────────────────────────────────────

  private async emitBatch(
    messages: FetchedMessage[],
    phase: FetcherState["phase"],
  ): Promise<void> {
    this.setState({ totalFetched: this.state.totalFetched + messages.length });
    consoleLog("State", this.getState());
    this.emit("event", {
      type: "messages",
      messages,
      phase,
    } satisfies FetcherEvent);

    // Auto-stop when maxTotalFetch is reached
    if (
      this.maxTotalFetch !== undefined &&
      this.maxTotalFetch !== null &&
      this.state.totalFetched >= this.maxTotalFetch
    ) {
      this.stop();
    }
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

  private shouldStopForLimit(): boolean {
    const limit = this.limit;
    return limit === null || limit === 0;
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
