export const TRANSCRIPT_TIMING_SOURCES = ["measured", "estimated"] as const;

export type TranscriptTimingSource = (typeof TRANSCRIPT_TIMING_SOURCES)[number];

export function normalizeTranscriptTimingSource(
	value: unknown,
	options?: {
		estimated?: boolean;
		fallback?: TranscriptTimingSource;
	},
): TranscriptTimingSource | undefined {
	if (value === "measured" || value === "estimated") return value;
	if (options?.estimated) return "estimated";
	return options?.fallback;
}
