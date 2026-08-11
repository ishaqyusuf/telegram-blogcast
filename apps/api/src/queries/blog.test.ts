import { describe, expect, test } from "bun:test";

import {
  getOrTranscribeTranscriptChunk,
  getTranscriptWindow,
  persistTranscribedSegments,
  replaceTranscriptSegments,
  resolveTranscriptWindowRange,
} from "./blog";

function createTransactionHarness<T extends object>(
  transactionClient: T,
  rootClient: T = transactionClient,
) {
  let calls = 0;
  let options: unknown;
  const db = {
    ...rootClient,
    $transaction: async (
      callback: (tx: T) => Promise<unknown>,
      transactionOptions?: unknown,
    ) => {
      calls += 1;
      options = transactionOptions;
      return callback(transactionClient);
    },
  };

  return {
    db,
    calls: () => calls,
    options: () => options,
  };
}

describe("transcript window helpers", () => {
  test("snaps an anchor to a stable transcript window", () => {
    expect(
      resolveTranscriptWindowRange({
        anchorSec: 83.4,
        windowDurationSec: 60,
      }),
    ).toEqual({
      windowDurationSec: 60,
      windowStartSec: 60,
      windowEndSec: 120,
    });
  });

  test("normalizes explicit starts to window boundaries", () => {
    expect(
      resolveTranscriptWindowRange({
        windowStartSec: 121,
        windowDurationSec: 60,
      }),
    ).toEqual({
      windowDurationSec: 60,
      windowStartSec: 120,
      windowEndSec: 180,
    });
  });

  test("clamps invalid starts and durations", () => {
    expect(
      resolveTranscriptWindowRange({
        windowStartSec: -20,
        windowDurationSec: 600,
      }),
    ).toEqual({
      windowDurationSec: 300,
      windowStartSec: 0,
      windowEndSec: 300,
    });
  });

  test("does not advertise a next cursor when no saved transcript exists", async () => {
    const transactionClient = {
      transcript: {
        findUnique: async () => null,
      },
    };
    const harness = createTransactionHarness(transactionClient, {
      transcript: {
        findUnique: async () => {
          throw new Error("transcript read escaped transaction");
        },
      },
    });
    const result = await getTranscriptWindow(
      { db: harness.db } as unknown as Parameters<typeof getTranscriptWindow>[0],
      {
        mediaId: 123,
        windowStartSec: 0,
        windowDurationSec: 60,
      },
    );

    expect(result.hasNext).toBe(false);
    expect(result.nextWindowStartSec).toBeNull();
    expect(result.hasPrevious).toBe(false);
    expect(result.previousWindowStartSec).toBeNull();
    expect(result.transcriptUpdatedAt).toBeNull();
    expect(result.segments).toEqual([]);
    expect(harness.calls()).toBe(1);
    expect(harness.options()).toEqual({ isolationLevel: "RepeatableRead" });
  });

  test("returns the saved transcript updatedAt as a window freshness token", async () => {
    const updatedAt = new Date("2026-08-11T12:34:56.000Z");
    const transactionClient = {
      transcript: {
        findUnique: async () => ({
          id: 456,
          status: "done",
          updatedAt,
          media: { file: { duration: 240 } },
          segments: [],
        }),
      },
      transcriptSegment: {
        count: async () => 4,
        findFirst: async () => ({ endSec: 180 }),
      },
    };
    const harness = createTransactionHarness(transactionClient, {
      transcript: {
        findUnique: async () => {
          throw new Error("transcript read escaped transaction");
        },
      },
      transcriptSegment: {
        count: async () => {
          throw new Error("segment count escaped transaction");
        },
        findFirst: async () => {
          throw new Error("segment max escaped transaction");
        },
      },
    });
    const result = await getTranscriptWindow(
      { db: harness.db } as unknown as Parameters<typeof getTranscriptWindow>[0],
      {
        mediaId: 456,
        windowStartSec: 60,
        windowDurationSec: 60,
      },
    );

    expect(result.transcriptUpdatedAt).toBe(updatedAt);
    expect(result.transcriptId).toBe(456);
    expect(result.segmentCount).toBe(4);
    expect(harness.calls()).toBe(1);
    expect(harness.options()).toEqual({ isolationLevel: "RepeatableRead" });
  });

  test("replaces persisted segments and updates the transcript in one transaction", async () => {
    const operations: string[] = [];
    let upsertArgs: unknown;
    const transactionClient = {
      transcript: {
        upsert: async (args: unknown) => {
          operations.push("transcript.upsert");
          upsertArgs = args;
          return { id: 789, status: "done", updatedAt: new Date() };
        },
      },
      transcriptSegment: {
        deleteMany: async () => {
          operations.push("transcriptSegment.deleteMany");
        },
        createMany: async () => {
          operations.push("transcriptSegment.createMany");
        },
      },
    };
    const harness = createTransactionHarness(transactionClient, {
      transcript: {
        upsert: async () => {
          throw new Error("transcript write escaped transaction");
        },
      },
      transcriptSegment: {
        deleteMany: async () => {
          throw new Error("segment delete escaped transaction");
        },
        createMany: async () => {
          throw new Error("segment insert escaped transaction");
        },
      },
    });

    await persistTranscribedSegments({
      ctx: { db: harness.db } as unknown as Parameters<
        typeof persistTranscribedSegments
      >[0]["ctx"],
      mediaId: 789,
      fromSec: 0,
      toSec: 60,
      segments: [
        {
          id: "segment-1",
          from: 0,
          to: 10,
          text: "hello",
          words: [],
        },
      ],
      model: "whisper-local",
    });

    expect(harness.calls()).toBe(1);
    expect(harness.options()).toBeUndefined();
    expect(upsertArgs).toMatchObject({
      update: {
        status: "done",
        updatedAt: expect.any(Date),
      },
    });
    expect(operations).toEqual([
      "transcript.upsert",
      "transcriptSegment.deleteMany",
      "transcriptSegment.createMany",
    ]);
  });

  test("saveTranscript-style full replacement keeps all writes in one transaction", async () => {
    const operations: string[] = [];
    let upsertArgs: unknown;
    let deleteArgs: unknown;
    let createManyArgs: unknown;
    const transactionClient = {
      transcript: {
        upsert: async (args: unknown) => {
          operations.push("transcript.upsert");
          upsertArgs = args;
          return { id: 654, status: "done", updatedAt: new Date() };
        },
      },
      transcriptSegment: {
        deleteMany: async (args: unknown) => {
          operations.push("transcriptSegment.deleteMany");
          deleteArgs = args;
        },
        createMany: async (args: unknown) => {
          operations.push("transcriptSegment.createMany");
          createManyArgs = args;
        },
      },
    };
    const harness = createTransactionHarness(transactionClient, {
      transcript: {
        upsert: async () => {
          throw new Error("transcript write escaped transaction");
        },
      },
      transcriptSegment: {
        deleteMany: async () => {
          throw new Error("segment delete escaped transaction");
        },
        createMany: async () => {
          throw new Error("segment insert escaped transaction");
        },
      },
    });

    await replaceTranscriptSegments({
      ctx: { db: harness.db } as unknown as Parameters<
        typeof replaceTranscriptSegments
      >[0]["ctx"],
      mediaId: 654,
      status: "done",
      segments: [{ startSec: 0, endSec: 5, text: "saved" }],
    });

    expect(harness.calls()).toBe(1);
    expect(upsertArgs).toMatchObject({
      where: { mediaId: 654 },
      update: {
        status: "done",
        updatedAt: expect.any(Date),
      },
    });
    expect(deleteArgs).toEqual({ where: { transcriptId: 654 } });
    expect(createManyArgs).toEqual({
      data: [
        {
          transcriptId: 654,
          startSec: 0,
          endSec: 5,
          text: "saved",
        },
      ],
    });
    expect(operations).toEqual([
      "transcript.upsert",
      "transcriptSegment.deleteMany",
      "transcriptSegment.createMany",
    ]);
  });

  test("failed chunk replacement keeps the failed revision and segment atomic", async () => {
    const operations: string[] = [];
    let upsertArgs: unknown;
    let deleteArgs: unknown;
    let createManyArgs: unknown;
    const transactionClient = {
      transcript: {
        upsert: async (
          args: unknown,
        ): Promise<{ id: number; status: string; updatedAt: Date }> => {
          operations.push("transaction.transcript.upsert");
          upsertArgs = args;
          return { id: 321, status: "failed", updatedAt: new Date() };
        },
        update: async (_args: unknown): Promise<unknown> => undefined,
      },
      transcriptSegment: {
        findMany: async (_args: unknown): Promise<unknown[]> => [],
        deleteMany: async (args: unknown): Promise<unknown> => {
          operations.push("transaction.transcriptSegment.deleteMany");
          deleteArgs = args;
          return undefined;
        },
        createMany: async (args: unknown): Promise<unknown> => {
          operations.push("transaction.transcriptSegment.createMany");
          createManyArgs = args;
          return undefined;
        },
        create: async (_args: unknown): Promise<unknown> => {
          throw new Error("single segment create escaped transaction");
        },
      },
    };
    const harness = createTransactionHarness(transactionClient, {
      transcript: {
        upsert: async (_args: unknown) => {
          operations.push("root.transcript.upsert");
          return { id: 321, status: "pending", updatedAt: new Date() };
        },
        update: async (_args: unknown): Promise<unknown> => {
          operations.push("root.transcript.update");
          return undefined;
        },
      },
      transcriptSegment: {
        findMany: async (_args: unknown): Promise<unknown[]> => {
          operations.push("root.transcriptSegment.findMany");
          return [];
        },
        deleteMany: async (_args: unknown): Promise<unknown> => {
          throw new Error("failed segment delete escaped transaction");
        },
        createMany: async (_args: unknown): Promise<unknown> => {
          throw new Error("failed segment insert escaped transaction");
        },
        create: async (_args: unknown): Promise<unknown> => {
          throw new Error("failed segment create escaped transaction");
        },
      },
    });

    const previousToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = "";
    let error: unknown;
    try {
      await getOrTranscribeTranscriptChunk(
        { db: harness.db } as unknown as Parameters<
          typeof getOrTranscribeTranscriptChunk
        >[0],
        {
          mediaId: 321,
          fileId: "file-321",
          chunkStartSec: 30,
          chunkDurationSec: 30,
          model: "whisper-local",
        },
      );
    } catch (caught) {
      error = caught;
    } finally {
      if (previousToken === undefined) {
        process.env.TELEGRAM_BOT_TOKEN = "";
      } else {
        process.env.TELEGRAM_BOT_TOKEN = previousToken;
      }
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "TELEGRAM_BOT_TOKEN is not configured",
    );
    expect(harness.calls()).toBe(1);
    expect(upsertArgs).toMatchObject({
      where: { mediaId: 321 },
      update: {
        status: "failed",
        updatedAt: expect.any(Date),
      },
    });
    expect(deleteArgs).toEqual({
      where: {
        transcriptId: 321,
        startSec: { gte: 30 },
        endSec: { lte: 60 },
      },
    });
    expect(createManyArgs).toEqual({
      data: [
        {
          transcriptId: 321,
          startSec: 30,
          endSec: 60,
          text: "",
          chunkStartSec: 30,
          chunkEndSec: 60,
          status: "failed",
          model: "whisper-local",
          error: "TELEGRAM_BOT_TOKEN is not configured",
        },
      ],
    });
    expect(operations).toEqual([
      "root.transcript.upsert",
      "root.transcriptSegment.findMany",
      "root.transcript.update",
      "transaction.transcript.upsert",
      "transaction.transcriptSegment.deleteMany",
      "transaction.transcriptSegment.createMany",
    ]);
  });
});
