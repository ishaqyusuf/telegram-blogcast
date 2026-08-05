export type LocalMediaStatus =
	| { state: "unavailable"; progress: 0 }
	| { state: "fetchable"; progress: 0 }
	| { state: "preparing"; progress: number }
	| { state: "error"; progress: 0; error: string }
	| {
			state: "ready";
			progress: 1;
			size: number;
			fileName: string;
			mimeType: string;
	  };

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function validProgress(value: unknown) {
	return typeof value === "number" && value >= 0 && value <= 1;
}

export function parseLocalMediaStatus(value: unknown): LocalMediaStatus {
	const status = asRecord(value);
	switch (status.state) {
		case "unavailable":
		case "fetchable":
			if (status.progress === 0) return status as LocalMediaStatus;
			break;
		case "preparing":
			if (validProgress(status.progress)) return status as LocalMediaStatus;
			break;
		case "error":
			if (status.progress === 0 && typeof status.error === "string") {
				return status as LocalMediaStatus;
			}
			break;
		case "ready":
			if (
				status.progress === 1 &&
				typeof status.size === "number" &&
				status.size > 0 &&
				typeof status.fileName === "string" &&
				typeof status.mimeType === "string"
			) {
				return status as LocalMediaStatus;
			}
			break;
	}
	throw new Error("The local media gateway returned an invalid status.");
}

export function parseLocalMediaTicket(value: unknown) {
	const response = asRecord(value);
	if (
		typeof response.mediaId !== "number" ||
		!Number.isInteger(response.mediaId) ||
		typeof response.ticket !== "string" ||
		!response.ticket
	) {
		throw new Error("The media gateway returned an invalid playback ticket.");
	}
	return { mediaId: response.mediaId, ticket: response.ticket };
}
