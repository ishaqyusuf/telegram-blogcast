export type TranscriptionQueueLoadKeyInput = {
	activeGatewayUrl?: string | null;
	mediaId?: number;
	localServicesEnabled: boolean;
	connectionStatus: string;
	autoLoad: boolean;
};

export function getTranscriptionQueueLoadKey(
	input: TranscriptionQueueLoadKeyInput,
) {
	return JSON.stringify([
		input.activeGatewayUrl ?? null,
		input.mediaId ?? null,
		input.localServicesEnabled,
		input.connectionStatus,
		input.autoLoad,
	]);
}

export function isTranscriptionQueueInitialLoadComplete(
	loadedQueueKey: string | null,
	currentQueueKey: string,
) {
	return loadedQueueKey === currentQueueKey;
}

export type TranscriptionQueuePollState = {
	autoLoad: boolean;
	localServicesEnabled: boolean;
	connectionStatus: string;
	initialLoadComplete: boolean;
	hasActiveJobs: boolean;
	pollWhenIdle: boolean;
};

export function shouldPollTranscriptionQueue(
	state: TranscriptionQueuePollState,
) {
	return (
		state.autoLoad &&
		state.localServicesEnabled &&
		state.connectionStatus === "online" &&
		state.initialLoadComplete &&
		(state.pollWhenIdle || state.hasActiveJobs)
	);
}
