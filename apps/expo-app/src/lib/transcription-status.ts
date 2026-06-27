type SegmentLike = {
	endSec?: number | null;
	to?: number | null;
};

type TranscriptionStatusInput = {
	isTranscribed?: boolean | null;
	transcriptStatus?: string | null;
	transcriptionJobStatus?: string | null;
	transcript?: {
		status?: string | null;
		segments?: SegmentLike[] | null;
	} | null;
	transcriptionJobs?: { status?: string | null }[] | null;
	duration?: number | null;
	file?: { duration?: number | null } | null;
};

export type TranscriptionBadgeTone = "success" | "warn" | "muted" | "primary";

export function getTranscriptionBadgeState(
	input?: TranscriptionStatusInput | null,
) {
	const transcriptStatus =
		input?.transcriptStatus ?? input?.transcript?.status ?? null;
	const transcriptionJobStatus =
		input?.transcriptionJobStatus ??
		input?.transcriptionJobs?.[0]?.status ??
		null;
	const duration = input?.duration ?? input?.file?.duration ?? null;
	const segments = input?.transcript?.segments ?? [];
	const maxEndSec = segments.reduce((max, segment) => {
		const endSec = segment.endSec ?? segment.to ?? null;
		return typeof endSec === "number" && Number.isFinite(endSec)
			? Math.max(max, endSec)
			: max;
	}, 0);
	const isQueued = transcriptionJobStatus === "queued";
	const isRunning = transcriptionJobStatus === "running";
	const isFullyTranscribed =
		Boolean(input?.isTranscribed) ||
		(transcriptStatus === "done" &&
			typeof duration === "number" &&
			duration > 0 &&
			maxEndSec >= duration - 3);
	const isPartlyTranscribed =
		!isFullyTranscribed &&
		(transcriptStatus === "processing" || transcriptStatus === "done");
	const show =
		isFullyTranscribed || isPartlyTranscribed || isQueued || isRunning;
	const tone: TranscriptionBadgeTone = isFullyTranscribed
		? "success"
		: isPartlyTranscribed
			? "warn"
			: isQueued
				? "muted"
				: "primary";

	return {
		isFullyTranscribed,
		isPartlyTranscribed,
		isQueued,
		isRunning,
		show,
		tone,
		label: isFullyTranscribed
			? "Transcribed"
			: isPartlyTranscribed
				? "Partial transcript"
				: isQueued
					? "Queued for transcription"
					: "Transcribing",
	};
}
