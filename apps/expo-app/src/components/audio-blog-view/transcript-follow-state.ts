export type TranscriptScrollBehavior = "instant" | "smooth";

export function resolveTranscriptScrollBehavior({
	hasPositioned,
	wasFollowing,
	follow,
	activeSegmentIndex,
	previousActiveSegmentIndex,
}: {
	hasPositioned: boolean;
	wasFollowing: boolean;
	follow: boolean;
	activeSegmentIndex: number;
	previousActiveSegmentIndex: number;
}): TranscriptScrollBehavior | null {
	if (activeSegmentIndex < 0) return null;
	if (!hasPositioned) return "instant";
	if (!follow) return null;
	if (!wasFollowing) return "instant";
	if (activeSegmentIndex === previousActiveSegmentIndex) return null;
	return "smooth";
}
