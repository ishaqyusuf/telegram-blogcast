import { useCallback, useEffect, useState } from "react";
import { useLocalServicesSession } from "@/components/local-services";
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
  if (
    job.status === "completed" ||
    job.status === "duplicate" ||
    job.status === "already_transcribed"
  ) {
    return 100;
  }
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
  const {
    isEnabled: localServicesEnabled,
    requestSetup: requestLocalServicesSetup,
  } = useLocalServicesSession();
  const autoLoad = options.autoLoad ?? true;
  const reloadOnEnqueue = options.reloadOnEnqueue ?? true;
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const reload = useCallback(async () => {
    if (!localServicesEnabled) {
      setJobs([]);
      return;
    }
    const rows = await vanillaTrpc.blog.getTranscriptionJobs.query({
      mediaId,
    });
    setJobs(rows);
  }, [localServicesEnabled, mediaId]);

  const enqueue = useCallback(
    async (input: QueueInput) => {
      if (!localServicesEnabled) {
        requestLocalServicesSetup();
        throw new Error("Enable local services before queueing transcription.");
      }
      const audioUrl = getReachableAudioUrl(input.audioUrl);
      const fromSec = input.fromSec ?? null;
      const toSec = input.toSec ?? null;
      if (!audioUrl && !input.telegramFileId) {
        throw new Error(
          "Queued transcription requires a reachable audio URL or Telegram file ID.",
        );
      }

      const job = await vanillaTrpc.blog.enqueueTranscriptionJob.mutate({
        mediaId: input.mediaId,
        telegramFileId: input.telegramFileId ?? null,
        audioUrl,
        fromSec,
        toSec,
        language: input.language ?? "ar",
        transcriberUrl: input.transcriberUrl ?? null,
      });

      if (reloadOnEnqueue) {
        await reload();
      } else {
        setJobs((current) => {
          const withoutMatchingFailed = current.filter(
            (currentJob) =>
              !(
                currentJob.status === "failed" &&
                currentJob.mediaId === input.mediaId &&
                (currentJob.fromSec ?? null) === fromSec &&
                (currentJob.toSec ?? null) === toSec
              ),
          );

          return withoutMatchingFailed.some(
            (currentJob) => currentJob.id === job.id,
          )
            ? withoutMatchingFailed.map((currentJob) =>
                currentJob.id === job.id ? job : currentJob,
              )
            : [job, ...withoutMatchingFailed];
        });
      }

      return job;
    },
    [
      localServicesEnabled,
      reload,
      reloadOnEnqueue,
      requestLocalServicesSetup,
    ],
  );

  const deleteJob = useCallback(async (id: number) => {
    if (!localServicesEnabled) {
      requestLocalServicesSetup();
      throw new Error("Enable local services to manage transcription jobs.");
    }
    await vanillaTrpc.blog.deleteTranscriptionJob.mutate({ id });
    setJobs((current) => current.filter((job) => job.id !== id));
  }, [localServicesEnabled, requestLocalServicesSetup]);

  const runQueued = useCallback(async () => {
    if (!localServicesEnabled) {
      requestLocalServicesSetup();
      return;
    }
    setIsRunning(true);
    try {
      await reload();
    } finally {
      setIsRunning(false);
    }
  }, [localServicesEnabled, reload, requestLocalServicesSetup]);

  useEffect(() => {
    if (!autoLoad || !localServicesEnabled) return;
    reload().catch((error) =>
      console.warn("[TranscriptionQueue] load failed", error),
    );
  }, [autoLoad, localServicesEnabled, reload]);

  useEffect(() => {
    if (!autoLoad || !localServicesEnabled) return;
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
  }, [autoLoad, jobs, localServicesEnabled, reload]);

  return {
    jobs,
    queuedCount: jobs.filter(
      (job) => job.status === "queued" || job.status === "failed",
    ).length,
    isRunning,
    enqueue,
    deleteJob,
    runQueued,
    reload,
  };
}
