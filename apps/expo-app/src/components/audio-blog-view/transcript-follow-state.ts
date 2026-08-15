export type TranscriptScrollBehavior = "instant" | "smooth";

export function resolveTranscriptScrollBehavior({
	hasPositioned,
	follow,
	activeSegmentIndex,
	previousActiveSegmentIndex,
}: {
	hasPositioned: boolean;
	follow: boolean;
	activeSegmentIndex: number;
	previousActiveSegmentIndex: number;
}): TranscriptScrollBehavior | null {
	if (activeSegmentIndex < 0) return null;
	if (!hasPositioned) return "instant";
	if (!follow || activeSegmentIndex === previousActiveSegmentIndex) return null;
	return "smooth";
}
