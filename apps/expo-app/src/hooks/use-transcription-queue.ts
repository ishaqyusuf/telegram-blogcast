import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalServicesSession } from "@/components/local-services";
import { shouldApplyLocalApiResult } from "@/lib/local-api-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";

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

export type TranscriptionJob =
  RouterOutputs["blog"]["getTranscriptionJobs"][number];

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
    activeIp,
    connectionStatus,
    isEnabled: localServicesEnabled,
    localApiClient,
    requestSetup: requestLocalServicesSetup,
  } = useLocalServicesSession();
  const autoLoad = options.autoLoad ?? true;
  const reloadOnEnqueue = options.reloadOnEnqueue ?? true;
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const activeIpRef = useRef(activeIp);
  activeIpRef.current = activeIp;

  useEffect(() => {
    setJobs([]);
  }, [activeIp]);

  const reload = useCallback(async () => {
    if (!localServicesEnabled) {
      setJobs([]);
      return;
    }
    if (!localApiClient || connectionStatus !== "online") {
      setJobs([]);
      return;
    }
    const requestIp = activeIp;
    const rows = await localApiClient.blog.getTranscriptionJobs.query({
      mediaId,
    });
    if (!shouldApplyLocalApiResult(requestIp, activeIpRef.current)) return;
    setJobs(rows);
  }, [
    activeIp,
    connectionStatus,
    localApiClient,
    localServicesEnabled,
    mediaId,
  ]);

  const enqueue = useCallback(
    async (input: QueueInput) => {
      if (!localServicesEnabled) {
        requestLocalServicesSetup();
        throw new Error("Enable local services before queueing transcription.");
      }
      if (!localApiClient || connectionStatus !== "online") {
        throw new Error("The selected local API is offline.");
      }
      const audioUrl = getReachableAudioUrl(input.audioUrl);
      const fromSec = input.fromSec ?? null;
      const toSec = input.toSec ?? null;
      if (!audioUrl && !input.telegramFileId) {
        throw new Error(
          "Queued transcription requires a reachable audio URL or Telegram file ID.",
        );
      }

      const requestIp = activeIp;
      const job = await localApiClient.blog.enqueueTranscriptionJob.mutate({
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
      } else if (shouldApplyLocalApiResult(requestIp, activeIpRef.current)) {
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
      activeIp,
      connectionStatus,
      localApiClient,
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
    if (!localApiClient || connectionStatus !== "online") {
      throw new Error("The selected local API is offline.");
    }
    const requestIp = activeIp;
    await localApiClient.blog.deleteTranscriptionJob.mutate({ id });
    if (shouldApplyLocalApiResult(requestIp, activeIpRef.current)) {
      setJobs((current) => current.filter((job) => job.id !== id));
    }
  }, [
    activeIp,
    connectionStatus,
    localApiClient,
    localServicesEnabled,
    requestLocalServicesSetup,
  ]);

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
