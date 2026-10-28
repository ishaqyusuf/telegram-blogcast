/** Keep idle rows free to reflow as text, images, or transcripts change size. */
export function getSwipeDismissStyle(
	progress: number,
	measuredHeight: number,
	travel: number,
) {
	"worklet";
	const amount = Math.max(0, Math.min(1, progress));
	return {
		height: amount === 0 || measuredHeight <= 0
			? ("auto" as const)
			: measuredHeight * (1 - amount),
		opacity: 1 - amount,
		overflow: "hidden" as const,
		// An idle text surface needs no transform or scale layer.
		transform: amount === 0 ? [] : [{ translateX: -travel * amount }],
	};
}
