import type { TelegramSegment } from "./types";

export const TELEGRAM_PATTERN =
  /(https?:\/\/[^\s]+)|(\[\d{1,2}:\d{2}(?::\d{2})?\])|((?<!\S)\d{1,2}:\d{2}(?::\d{2})?(?!\S))|(#[\p{L}\p{N}_\u0600-\u06FF]+)/gsu;

export const TELEGRAM_COLORS = {
  hashtag: "#1e40af",
  link: "#2563eb",
  timestamp: "#f59e0b",
  text: undefined,
} as const;

export function parseTelegramText(text: string): TelegramSegment[] {
  const segments: TelegramSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TELEGRAM_PATTERN.lastIndex = 0;
  while ((match = TELEGRAM_PATTERN.exec(text)) !== null) {
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

    lastIndex = TELEGRAM_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
