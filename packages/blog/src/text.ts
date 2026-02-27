export type TextSegment = {
  type: "text" | "link";
  text: string;
  href?: string;
};

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s]+)/gi;

export function isArabicLine(text: string) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

export function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

export function splitLineWithLinks(line: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  const re = new RegExp(URL_PATTERN);

  let match = re.exec(line);
  while (match) {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;

    if (start > cursor) {
      segments.push({
        type: "text",
        text: line.slice(cursor, start),
      });
    }

    segments.push({
      type: "link",
      text: raw,
      href: normalizeExternalUrl(raw) ?? undefined,
    });

    cursor = end;
    match = re.exec(line);
  }

  if (cursor < line.length) {
    segments.push({
      type: "text",
      text: line.slice(cursor),
    });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", text: line });
  }

  return segments;
}

export function splitTextLinesWithLinks(content: string) {
  return content.split("\n").map((line) => splitLineWithLinks(line));
}
