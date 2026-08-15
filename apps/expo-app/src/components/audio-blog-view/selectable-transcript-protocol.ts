import { buildTranscriptDisplayRuns } from "@/components/audio-blog-view/transcript-display-runs";
import type {
	TranscriptDocument,
	TranscriptTextSelection,
} from "@/components/audio-blog-view/transcript-timing";

export type TranscriptSelectionAction = "copy" | "comment" | "share";

export type TranscriptSurfaceSelection = Pick<
	TranscriptTextSelection,
	"startOffset" | "endOffset" | "dragStartOffset"
>;

export type TranscriptHydrateMessage = {
	type: "hydrate";
	documentKey: string;
	segments: ReturnType<typeof buildTranscriptDisplayRuns>;
	activeSegmentIndex: number;
	activeWordIndex: number;
	follow: boolean;
	initial: boolean;
	fontScale: number;
	selection: TranscriptSurfaceSelection | null;
};

export type TranscriptSyncMessage = {
	type: "sync";
	activeSegmentIndex: number;
	activeWordIndex: number;
	follow: boolean;
	behavior: "instant" | "smooth";
	scrollToActive: boolean;
};

export type TranscriptToSurfaceMessage =
	| TranscriptHydrateMessage
	| TranscriptSyncMessage
	| { type: "font-scale"; fontScale: number }
	| { type: "clear-selection" };

export type TranscriptFromSurfaceMessage =
	| { type: "ready" }
	| {
			type: "selection";
			startOffset: number;
			endOffset: number;
			dragStartOffset: number;
	  }
	| { type: "selection-cleared" }
	| { type: "manual-scroll" }
	| { type: "edge"; edge: "start" | "end" }
	| { type: "press-segment"; index: number; shouldPlay: boolean };

function hashTranscriptText(text: string) {
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

export function getTranscriptDocumentKey(document: TranscriptDocument) {
	const first = document.segmentRanges[0]?.segment;
	const last = document.segmentRanges.at(-1)?.segment;
	return `${first?.id ?? first?.startSec ?? "empty"}:${last?.id ?? last?.endSec ?? "empty"}:${document.fullText.length}:${hashTranscriptText(document.fullText)}`;
}

export function createTranscriptHydrateMessage({
	document,
	activeSegmentIndex,
	activeWordIndex,
	follow,
	initial,
	fontScale = 1,
	selection,
}: {
	document: TranscriptDocument;
	activeSegmentIndex: number;
	activeWordIndex: number;
	follow: boolean;
	initial: boolean;
	fontScale?: number;
	selection: TranscriptTextSelection | null;
}): TranscriptHydrateMessage {
	return {
		type: "hydrate",
		documentKey: getTranscriptDocumentKey(document),
		segments: buildTranscriptDisplayRuns(document),
		activeSegmentIndex,
		activeWordIndex,
		follow,
		initial,
		fontScale,
		selection: selection
			? {
					startOffset: selection.startOffset,
					endOffset: selection.endOffset,
					dragStartOffset: selection.dragStartOffset,
				}
			: null,
	};
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isOffset(value: unknown): value is number {
	return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

export function parseTranscriptSurfaceMessage(
	raw: string,
): TranscriptFromSurfaceMessage | null {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!value || typeof value !== "object") return null;
	const message = value as Record<string, unknown>;

	switch (message.type) {
		case "ready":
		case "selection-cleared":
		case "manual-scroll":
			return { type: message.type };
		case "selection":
			return isOffset(message.startOffset) &&
				isOffset(message.endOffset) &&
				isOffset(message.dragStartOffset)
				? {
						type: "selection",
						startOffset: message.startOffset,
						endOffset: message.endOffset,
						dragStartOffset: message.dragStartOffset,
					}
				: null;
		case "edge":
			return message.edge === "start" || message.edge === "end"
				? { type: "edge", edge: message.edge }
				: null;
		case "press-segment":
			return isOffset(message.index) && typeof message.shouldPlay === "boolean"
				? {
						type: "press-segment",
						index: message.index,
						shouldPlay: message.shouldPlay,
					}
				: null;
		default:
			return null;
	}
}
