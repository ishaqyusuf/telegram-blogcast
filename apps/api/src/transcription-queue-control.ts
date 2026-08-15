let transcriptionQueuePaused = false;

export function getTranscriptionQueueControlState() {
	return { isPaused: transcriptionQueuePaused };
}

export function setTranscriptionQueuePaused(isPaused: boolean) {
	transcriptionQueuePaused = isPaused;
	return getTranscriptionQueueControlState();
}
