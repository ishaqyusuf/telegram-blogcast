import { useCallback, useEffect, useState } from "react";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { transcribeAudio, type TranscribeResponse } from "@/lib/transcribe";
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

type TranscriptionQueueOptions = {
  autoLoad?: boolean;
  reloadOnEnqueue?: boolean;
};

export type TranscriptionJob = Awaited<
  ReturnType<typeof vanillaTrpc.blog.getTranscriptionJobs.query>
>[number];

export function getTranscriptionJobProgress(job: TranscriptionJob) {
  if (job.status === "completed") return 100;
  if (job.status === "running") return 50;
  return 0;
}

function isReachableAudioUrl(value?: string | null) {
  return Boolean(value?.startsWith("http://") || value?.startsWith("https://"));
}

function getReachableAudioUrl(value?: string | null) {
  return isReachableAudioUrl(value) ? value ?? null : null;
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

async function runJob(job: TranscriptionJob) {
  let audioUrl = getReachableAudioUrl(job.audioUrl);
  if (!audioUrl && job.telegramFileId) {
    const resolved = await getTelegramFileUrl(job.telegramFileId);
    audioUrl = getReachableAudioUrl(resolved?.url);
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

export function useTranscriptionQueue(
  mediaId?: number,
  options: TranscriptionQueueOptions = {},
) {
  const autoLoad = options.autoLoad ?? true;
  const reloadOnEnqueue = options.reloadOnEnqueue ?? true;
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateLocalJob = useCallback(
    (id: number, patch: Partial<TranscriptionJob>) => {
      setJobs((current) =>
        current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
      );
    },
    [],
  );

  const reload = useCallback(async () => {
    const rows = await vanillaTrpc.blog.getTranscriptionJobs.query({
      mediaId,
    });
    setJobs(rows);
  }, [mediaId]);

  const enqueue = useCallback(
    async (input: QueueInput) => {
      const audioUrl = getReachableAudioUrl(input.audioUrl);
      if (!audioUrl && !input.telegramFileId) {
        throw new Error(
          "Queued transcription requires a reachable audio URL or Telegram file ID.",
        );
      }

      const job = await vanillaTrpc.blog.enqueueTranscriptionJob.mutate({
        mediaId: input.mediaId,
        telegramFileId: input.telegramFileId ?? null,
        audioUrl,
        fromSec: input.fromSec ?? null,
        toSec: input.toSec ?? null,
        language: input.language ?? "ar",
        transcriberUrl: input.transcriberUrl ?? null,
      });

      if (reloadOnEnqueue) {
        await reload();
      } else {
        setJobs((current) =>
          current.some((currentJob) => currentJob.id === job.id)
            ? current.map((currentJob) =>
                currentJob.id === job.id ? job : currentJob,
              )
            : [job, ...current],
        );
      }

      return job;
    },
    [reload, reloadOnEnqueue],
  );

  const runQueued = useCallback(async () => {
    setIsRunning(true);
    try {
      const queued = await vanillaTrpc.blog.getTranscriptionJobs.query({
        mediaId,
        statuses: ["queued", "failed"],
      });

      for (const job of queued) {
        const now = new Date();
        await vanillaTrpc.blog.updateTranscriptionJob.mutate({
          id: job.id,
          status: "running",
        });
        updateLocalJob(job.id, {
          status: "running",
          updatedAt: now,
          errorMessage: null,
        });

        try {
          await runJob(job);
          const completedAt = new Date();
          await vanillaTrpc.blog.updateTranscriptionJob.mutate({
            id: job.id,
            status: "completed",
          });
          updateLocalJob(job.id, {
            status: "completed",
            updatedAt: completedAt,
            completedAt,
            errorMessage: null,
          });
        } catch (error) {
          const failedAt = new Date();
          const errorMessage =
            error instanceof Error ? error.message : "Transcription failed.";
          await vanillaTrpc.blog.updateTranscriptionJob.mutate({
            id: job.id,
            status: "failed",
            errorMessage,
          });
          updateLocalJob(job.id, {
            status: "failed",
            retryCount: job.retryCount + 1,
            updatedAt: failedAt,
            errorMessage,
          });
        }
      }
    } finally {
      setIsRunning(false);
      await reload();
    }
  }, [mediaId, reload, updateLocalJob]);

  useEffect(() => {
    if (!autoLoad) return;
    reload().catch((error) =>
      console.warn("[TranscriptionQueue] load failed", error),
    );
  }, [autoLoad, reload]);

  return {
    jobs,
    queuedCount: jobs.filter(
      (job) => job.status === "queued" || job.status === "failed",
    ).length,
    isRunning,
    enqueue,
    runQueued,
    reload,
  };
}
