export type TranscriptJobStatusSnapshot = {
	id: number;
	status: string;
};

export function getCompletedTranscriptJobTransitions(
	previousStatuses: ReadonlyMap<number, string>,
	currentJobs: readonly TranscriptJobStatusSnapshot[],
	initialized: boolean,
) {
	const completedJobIds = initialized
		? currentJobs
				.filter((job) => job.status === "completed")
				.filter((job) => previousStatuses.get(job.id) !== "completed")
				.map((job) => job.id)
		: [];
	const nextStatuses = new Map<number, string>();

	for (const job of currentJobs) {
		nextStatuses.set(job.id, job.status);
	}

	return { completedJobIds, nextStatuses };
}
