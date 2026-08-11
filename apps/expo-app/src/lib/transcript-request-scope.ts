export type TranscriptRequestScope = {
	mediaId: number;
	epoch: number;
};

export type CurrentTranscriptRequestScope = {
	mediaId?: number;
	epoch: number;
};

export type ScopedTranscriptRequestOutcome =
	| { status: "applied" }
	| { status: "cancelled" }
	| { status: "error"; error: unknown };

export function isTranscriptRequestCurrent(
	requestScope: TranscriptRequestScope,
	currentScope: CurrentTranscriptRequestScope,
) {
	return (
		requestScope.mediaId === currentScope.mediaId &&
		requestScope.epoch === currentScope.epoch
	);
}

export async function runScopedTranscriptRequest<T>(
	requestScope: TranscriptRequestScope,
	getCurrentScope: () => CurrentTranscriptRequestScope,
	request: () => Promise<T>,
	onSuccess: (value: T) => void,
	onError: (error: unknown) => void,
): Promise<ScopedTranscriptRequestOutcome> {
	try {
		const value = await request();
		if (!isTranscriptRequestCurrent(requestScope, getCurrentScope())) {
			return { status: "cancelled" };
		}
		onSuccess(value);
		return { status: "applied" };
	} catch (error) {
		if (!isTranscriptRequestCurrent(requestScope, getCurrentScope())) {
			return { status: "cancelled" };
		}
		onError(error);
		return { status: "error", error };
	}
}
