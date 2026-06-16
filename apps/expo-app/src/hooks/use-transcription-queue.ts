import { useCallback, useEffect, useState } from "react";
import { and, asc, eq, inArray } from "drizzle-orm";
import { initLocalDb, localDb, withLocalDbRetry } from "@/db/local-db";
import {
  localTranscriptionJobs,
  type LocalTranscriptionJob,
} from "@/db/local-schema";
import { transcribeAudio, type TranscribeResponse } from "@/lib/transcribe";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { vanillaTrpc } from "@/trpc/vanilla-client";

type QueueInput = {
  mediaId: number;
  telegramFileId?: string | null;
  audioUrl?: string | null;
  fromSec?: number | null;
  toSec?: number | null;
  language?: string;
  transcriberUrl?: string | null;
};

function makeLocalId() {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isReachableAudioUrl(value?: string | null) {
  return Boolean(value?.startsWith("http://") || value?.startsWith("https://"));
}

async function saveTranscript(mediaId: number, result: TranscribeResponse) {
  if (!result.segments?.length) return;
  await vanillaTrpc.blog.saveTranscript.mutate({
    mediaId,
    segments: result.segments.map((segment) => ({
      startSec: segment.start,
      endSec: segment.end,
      text: segment.text,
    })),
  });
}

async function runJob(job: LocalTranscriptionJob) {
  let audioUrl = job.audioUrl;
  if (!audioUrl && job.telegramFileId) {
    const resolved = await getTelegramFileUrl(job.telegramFileId);
    audioUrl = resolved?.url ?? null;
  }

  if (!isReachableAudioUrl(audioUrl)) {
    throw new Error(
      "Queued transcription requires a reachable audio URL or Telegram file ID.",
    );
  }

  const result = await transcribeAudio(
    {
      audioUrl,
      from: job.fromSec ?? undefined,
      to: job.toSec ?? undefined,
      language: job.language || "ar",
    },
    job.transcriberUrl ?? undefined,
  );
  await saveTranscript(job.mediaId, result);
  return result;
}

export function useTranscriptionQueue(mediaId?: number) {
  const [jobs, setJobs] = useState<LocalTranscriptionJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const reload = useCallback(async () => {
    await initLocalDb();
    const rows = await withLocalDbRetry(() =>
      mediaId
        ? localDb
            .select()
            .from(localTranscriptionJobs)
            .where(eq(localTranscriptionJobs.mediaId, mediaId))
            .orderBy(asc(localTranscriptionJobs.createdAt))
        : localDb
            .select()
            .from(localTranscriptionJobs)
            .orderBy(asc(localTranscriptionJobs.createdAt)),
    );
    setJobs(rows);
  }, [mediaId]);

  const enqueue = useCallback(async (input: QueueInput) => {
    const audioUrl = isReachableAudioUrl(input.audioUrl) ? input.audioUrl : null;
    if (!audioUrl && !input.telegramFileId) {
      throw new Error(
        "Queued transcription requires a reachable audio URL or Telegram file ID.",
      );
    }

    await initLocalDb();
    const now = new Date();
    const job: LocalTranscriptionJob = {
      localId: makeLocalId(),
      mediaId: input.mediaId,
      telegramFileId: input.telegramFileId ?? null,
      audioUrl,
      fromSec: input.fromSec ?? null,
      toSec: input.toSec ?? null,
      language: input.language ?? "ar",
      transcriberUrl: input.transcriberUrl ?? null,
      status: "queued",
      retryCount: 0,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    await withLocalDbRetry(() => localDb.insert(localTranscriptionJobs).values(job));
    await reload();
    return job;
  }, [reload]);

  const runQueued = useCallback(async () => {
    setIsRunning(true);
    try {
      await initLocalDb();
      const queued = await withLocalDbRetry(() =>
        localDb
          .select()
          .from(localTranscriptionJobs)
          .where(
            mediaId
              ? and(
                  eq(localTranscriptionJobs.mediaId, mediaId),
                  inArray(localTranscriptionJobs.status, ["queued", "failed"]),
                )
              : inArray(localTranscriptionJobs.status, ["queued", "failed"]),
          )
          .orderBy(asc(localTranscriptionJobs.createdAt)),
      );

      for (const job of queued) {
        const now = new Date();
        await withLocalDbRetry(() =>
          localDb
            .update(localTranscriptionJobs)
            .set({ status: "running", updatedAt: now, errorMessage: null })
            .where(eq(localTranscriptionJobs.localId, job.localId)),
        );

        try {
          await runJob(job);
          await withLocalDbRetry(() =>
            localDb
              .update(localTranscriptionJobs)
              .set({
                status: "completed",
                updatedAt: new Date(),
                completedAt: new Date(),
                errorMessage: null,
              })
              .where(eq(localTranscriptionJobs.localId, job.localId)),
          );
        } catch (error) {
          await withLocalDbRetry(() =>
            localDb
              .update(localTranscriptionJobs)
              .set({
                status: "failed",
                retryCount: job.retryCount + 1,
                updatedAt: new Date(),
                errorMessage:
                  error instanceof Error ? error.message : "Transcription failed.",
              })
              .where(eq(localTranscriptionJobs.localId, job.localId)),
          );
        }
      }
    } finally {
      setIsRunning(false);
      await reload();
    }
  }, [mediaId, reload]);

  useEffect(() => {
    reload().catch((error) => console.warn("[TranscriptionQueue] load failed", error));
  }, [reload]);

  return {
    jobs,
    queuedCount: jobs.filter((job) => job.status === "queued" || job.status === "failed").length,
    isRunning,
    enqueue,
    runQueued,
    reload,
  };
}
