import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalServicesSession } from "@/components/local-services";
import { shouldApplyLocalApiResult } from "@/lib/local-api-query";
import {
	getTranscriptionQueueLoadKey,
	isTranscriptionQueueInitialLoadComplete,
	shouldPollTranscriptionQueue,
} from "@/lib/transcription-queue-state";
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
	pollWhenIdle?: boolean;
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
    activeGatewayUrl,
    connectionStatus,
    isEnabled: localServicesEnabled,
    localApiClient,
    requestSetup: requestLocalServicesSetup,
  } = useLocalServicesSession();
	const autoLoad = options.autoLoad ?? true;
	const reloadOnEnqueue = options.reloadOnEnqueue ?? true;
	const pollWhenIdle = options.pollWhenIdle ?? false;
	const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isPauseUpdating, setIsPauseUpdating] = useState(false);
	const queueLoadKey = getTranscriptionQueueLoadKey({
		activeGatewayUrl,
		mediaId,
		localServicesEnabled,
		connectionStatus,
		autoLoad,
	});
	const [loadedQueueKey, setLoadedQueueKey] = useState<string | null>(null);
	const activeGatewayUrlRef = useRef(activeGatewayUrl);
	const queueLoadKeyRef = useRef(queueLoadKey);
	activeGatewayUrlRef.current = activeGatewayUrl;
	queueLoadKeyRef.current = queueLoadKey;
	const isInitialLoadComplete = isTranscriptionQueueInitialLoadComplete(
		loadedQueueKey,
		queueLoadKey,
	);

	useEffect(() => {
		setJobs([]);
		setIsPaused(false);
		setLoadedQueueKey(null);
	}, [queueLoadKey]);

	const reload = useCallback(async () => {
    if (!localServicesEnabled) {
      setJobs([]);
      return;
    }
		if (!localApiClient || connectionStatus !== "online") {
			setJobs([]);
			return;
		}
		const requestQueueLoadKey = queueLoadKey;
		const requestGatewayUrl = activeGatewayUrl;
		const [rows, queueState] = await Promise.all([
			localApiClient.blog.getTranscriptionJobs.query({ mediaId }),
			localApiClient.blog.getTranscriptionQueueState.query(),
		]);
    if (
      !shouldApplyLocalApiResult(
        requestGatewayUrl,
        activeGatewayUrlRef.current,
			)
		)
			return;
		if (queueLoadKeyRef.current !== requestQueueLoadKey) return;
		setJobs(rows);
		setIsPaused(queueState.isPaused);
		setLoadedQueueKey(requestQueueLoadKey);
	}, [
    activeGatewayUrl,
    connectionStatus,
		localApiClient,
		localServicesEnabled,
		mediaId,
		queueLoadKey,
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

      const requestGatewayUrl = activeGatewayUrl;
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
      } else if (
        shouldApplyLocalApiResult(
          requestGatewayUrl,
          activeGatewayUrlRef.current,
        )
      ) {
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
      activeGatewayUrl,
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
    const requestGatewayUrl = activeGatewayUrl;
    await localApiClient.blog.deleteTranscriptionJob.mutate({ id });
    if (
      shouldApplyLocalApiResult(
        requestGatewayUrl,
        activeGatewayUrlRef.current,
      )
    ) {
      setJobs((current) => current.filter((job) => job.id !== id));
    }
  }, [
    activeGatewayUrl,
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

	const setPaused = useCallback(
		async (nextIsPaused: boolean) => {
			if (!localServicesEnabled) {
				requestLocalServicesSetup();
				throw new Error("Enable local services to manage the transcription queue.");
			}
			if (!localApiClient || connectionStatus !== "online") {
				throw new Error("The selected local API is offline.");
			}

			const requestGatewayUrl = activeGatewayUrl;
			setIsPauseUpdating(true);
			try {
				const queueState =
					await localApiClient.blog.setTranscriptionQueuePaused.mutate({
						isPaused: nextIsPaused,
					});
				if (
					shouldApplyLocalApiResult(
						requestGatewayUrl,
						activeGatewayUrlRef.current,
					)
				) {
					setIsPaused(queueState.isPaused);
				}
				return queueState;
			} finally {
				setIsPauseUpdating(false);
			}
		},
		[
			activeGatewayUrl,
			connectionStatus,
			localApiClient,
			localServicesEnabled,
			requestLocalServicesSetup,
		],
	);

	useEffect(() => {
		if (!autoLoad || !localServicesEnabled) return;
		reload().catch((error) =>
      console.warn("[TranscriptionQueue] load failed", error),
    );
  }, [autoLoad, localServicesEnabled, reload]);

	useEffect(() => {
		const hasActiveJobs = jobs.some(
			(job) => job.status === "queued" || job.status === "running",
		);
		if (
			!shouldPollTranscriptionQueue({
				autoLoad,
				localServicesEnabled,
				connectionStatus,
				initialLoadComplete: isInitialLoadComplete,
				hasActiveJobs,
				pollWhenIdle,
			})
		)
			return;

		const timer = setInterval(() => {
      reload().catch((error) =>
        console.warn("[TranscriptionQueue] poll failed", error),
      );
		}, 3000);
		return () => clearInterval(timer);
	}, [
		autoLoad,
		connectionStatus,
		isInitialLoadComplete,
		jobs,
		localServicesEnabled,
		pollWhenIdle,
		reload,
	]);

  return {
    jobs,
    queuedCount: jobs.filter(
      (job) => job.status === "queued" || job.status === "failed",
    ).length,
		isRunning,
		isPaused,
		isPauseUpdating,
		isInitialLoadComplete,
		enqueue,
    deleteJob,
		setPaused,
    runQueued,
    reload,
  };
}
