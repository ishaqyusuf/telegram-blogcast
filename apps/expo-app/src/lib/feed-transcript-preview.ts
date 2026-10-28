export type FeedTranscriptSegment = {
	startSec: number;
	endSec: number;
	text: string;
};

export function getFeedTranscriptText(
	postId: number,
	segments: readonly FeedTranscriptSegment[],
	state: { blog?: { id: number } | null; isPlaying: boolean; position: number },
): string | null {
	if (state.blog?.id !== postId || !state.isPlaying) return null;
	const seconds = state.position / 1000;
	return (segments.find((segment) => seconds >= segment.startSec && seconds < segment.endSec)
		?? segments.find((segment) => segment.text?.trim()))?.text ?? null;
}
