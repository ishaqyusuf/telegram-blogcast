export const SHAMELA_C5_COLOR = "#005c81";

export type BookSourceMark = {
  kind: "c5";
  start: number;
  end: number;
};

export type BookHighlightRange = {
  start: number;
  end: number;
  color: string;
};

function validRange(range: { start: number; end: number }, textLength: number) {
  return range.start >= 0 && range.end > range.start && range.end <= textLength;
}

export function resolveBookTextSegments(input: {
  text: string;
  sourceMarks?: BookSourceMark[] | null;
  highlights?: BookHighlightRange[] | null;
}) {
  const sourceMarks = (input.sourceMarks ?? []).filter((mark) =>
    validRange(mark, input.text.length),
  );
  const highlights = (input.highlights ?? []).filter((highlight) =>
    validRange(highlight, input.text.length),
  );
  const boundaries = [
    0,
    input.text.length,
    ...sourceMarks.flatMap((mark) => [mark.start, mark.end]),
    ...highlights.flatMap((highlight) => [highlight.start, highlight.end]),
  ];
  const sorted = [...new Set(boundaries)].sort((a, b) => a - b);

  return sorted.slice(0, -1).flatMap((start, index) => {
    const end = sorted[index + 1] ?? start;
    if (end <= start) return [];
    const sourceMark = sourceMarks
      .filter((mark) => mark.start <= start && mark.end >= end)
      .at(-1);
    const highlight = highlights
      .filter((item) => item.start <= start && item.end >= end)
      .at(-1);

    return [
      {
        start,
        end,
        text: input.text.slice(start, end),
        foregroundColor: sourceMark?.kind === "c5" ? SHAMELA_C5_COLOR : null,
        backgroundColor: highlight?.color ?? null,
      },
    ];
  });
}
