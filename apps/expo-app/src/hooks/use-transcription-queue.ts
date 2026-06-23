import { useCallback, useEffect, useState } from "react";
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
  const progress =
    typeof job.progressPercent === "number" ? job.progressPercent : 0;
  if (job.status === "running") return Math.max(1, Math.min(progress, 99));
  if (job.status === "failed") return Math.min(progress, 99);
  return 0;
}

function isReachableAudioUrl(value?: string | null) {
  return Boolean(value?.startsWith("http://") || value?.startsWith("https://"));
}

function getReachableAudioUrl(value?: string | null) {
  return isReachableAudioUrl(value) ? value ?? null : null;
}

export function useTranscriptionQueue(
  mediaId?: number,
  options: TranscriptionQueueOptions = {},
) {
  const autoLoad = options.autoLoad ?? true;
  const reloadOnEnqueue = options.reloadOnEnqueue ?? true;
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);

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
      await reload();
    } finally {
      setIsRunning(false);
    }
  }, [reload]);

  useEffect(() => {
    if (!autoLoad) return;
    reload().catch((error) =>
      console.warn("[TranscriptionQueue] load failed", error),
    );
  }, [autoLoad, reload]);

  useEffect(() => {
    if (!autoLoad) return;
    const hasActiveJobs = jobs.some(
      (job) => job.status === "queued" || job.status === "running",
    );
    if (!hasActiveJobs) return;

    const timer = setInterval(() => {
      reload().catch((error) =>
        console.warn("[TranscriptionQueue] poll failed", error),
      );
    }, 3000);
    return () => clearInterval(timer);
  }, [autoLoad, jobs, reload]);

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
