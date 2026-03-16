export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "hashtag"; value: string }
  | { type: "timestamp"; value: string }
  | { type: "link"; value: string };

// Matches (in order of priority):
//   1. URLs: http(s)://...
//   2. Bracketed timestamps: [1:23] [01:23:45]
//   3. Bare timestamps at word boundary: 1:23 or 01:23:45
//   4. Hashtags: #word (Unicode-aware)
const PATTERN =
  /(https?:\/\/[^\s]+)|(\[\d{1,2}:\d{2}(?::\d{2})?\])|((?<!\S)\d{1,2}:\d{2}(?::\d{2})?(?!\S))|(#[\p{L}\p{N}_\u0600-\u06FF]+)/gsu;

export function parseBlogContent(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  PATTERN.lastIndex = 0;
  while ((match = PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      segments.push({ type: "link", value: match[1] });
    } else if (match[2]) {
      segments.push({ type: "timestamp", value: match[2] });
    } else if (match[3]) {
      segments.push({ type: "timestamp", value: match[3] });
    } else if (match[4]) {
      segments.push({ type: "hashtag", value: match[4] });
    }
    lastIndex = PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

export const SEGMENT_COLORS = {
  hashtag: "#1DB954",   // green — matches the app's primary accent
  link: "#60a5fa",      // blue
  timestamp: "#f59e0b", // amber
  text: undefined,      // inherit default foreground
} as const;
