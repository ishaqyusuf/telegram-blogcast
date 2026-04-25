import { parseTelegramText } from "./telegram";
import type {
  RangeAnnotation,
  RenderBlock,
  RenderRun,
  RichBlock,
  RichDocument,
  RichMark,
} from "./types";

type FlatRun = {
  start: number;
  end: number;
  text: string;
  marks: RichMark[];
};

function dedupeMarks(marks: RichMark[]): RichMark[] {
  const seen = new Set<string>();
  const result: RichMark[] = [];

  for (const mark of marks) {
    const key = `${mark.type}:${JSON.stringify(mark.attrs ?? {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(mark);
  }

  return result;
}

function flattenBlock(block: RichBlock): { text: string; runs: FlatRun[] } {
  const runs: FlatRun[] = [];
  let cursor = 0;

  for (const node of block.content) {
    const start = cursor;
    const end = start + node.text.length;
    runs.push({
      start,
      end,
      text: node.text,
      marks: [...(node.marks ?? [])],
    });
    cursor = end;
  }

  return {
    text: block.content.map((node) => node.text).join(""),
    runs,
  };
}

function splitAtBoundaries(runs: FlatRun[], boundaries: number[]): FlatRun[] {
  const sorted = [...new Set(boundaries)].sort((a, b) => a - b);
  const result: FlatRun[] = [];

  for (const run of runs) {
    let cursor = run.start;
    const localBoundaries = sorted.filter((boundary) => boundary > run.start && boundary < run.end);

    if (localBoundaries.length === 0) {
      result.push(run);
      continue;
    }

    for (const boundary of localBoundaries) {
      result.push({
        start: cursor,
        end: boundary,
        text: run.text.slice(cursor - run.start, boundary - run.start),
        marks: [...run.marks],
      });
      cursor = boundary;
    }

    result.push({
      start: cursor,
      end: run.end,
      text: run.text.slice(cursor - run.start),
      marks: [...run.marks],
    });
  }

  return result.filter((run) => run.start < run.end && run.text.length > 0);
}

function applyAnnotations(runs: FlatRun[], annotations: RangeAnnotation[]): FlatRun[] {
  return runs.map((run) => {
    const overlapping = annotations.filter(
      (annotation) =>
        annotation.kind === "highlight" &&
        annotation.startOffset <= run.start &&
        annotation.endOffset >= run.end,
    );

    if (overlapping.length === 0) return run;

    const marks = [...run.marks];
    for (const annotation of overlapping) {
      marks.push({
        type: "highlight",
        attrs: { color: annotation.color ?? "#FFD700" },
      });
    }

    return {
      ...run,
      marks: dedupeMarks(marks),
    };
  });
}

function applyTelegramMarks(runs: FlatRun[]): FlatRun[] {
  const result: FlatRun[] = [];

  for (const run of runs) {
    const segments = parseTelegramText(run.text);
    let cursor = run.start;

    for (const segment of segments) {
      const nextEnd = cursor + segment.value.length;
      const marks = [...run.marks];

      if (segment.type === "link") {
        marks.push({ type: "link", attrs: { href: segment.value } });
      } else if (segment.type === "hashtag") {
        marks.push({ type: "hashtag", attrs: { tag: segment.value.slice(1) } });
      } else if (segment.type === "timestamp") {
        marks.push({ type: "timestamp", attrs: { value: segment.value } });
      }

      result.push({
        start: cursor,
        end: nextEnd,
        text: segment.value,
        marks: dedupeMarks(marks),
      });
      cursor = nextEnd;
    }
  }

  return result.filter((run) => run.text.length > 0);
}

export function buildRenderBlock(
  block: RichBlock,
  options?: {
    annotations?: RangeAnnotation[];
    enableTelegramParsing?: boolean;
  },
): RenderBlock {
  const { text, runs } = flattenBlock(block);
  const annotations = (options?.annotations ?? []).filter((annotation) => annotation.blockId === block.id);
  const boundaries = [
    0,
    text.length,
    ...runs.flatMap((run) => [run.start, run.end]),
    ...annotations.flatMap((annotation) => [annotation.startOffset, annotation.endOffset]),
  ];

  const segmentedRuns = splitAtBoundaries(runs, boundaries);
  const annotatedRuns = applyAnnotations(segmentedRuns, annotations);
  const finalRuns = options?.enableTelegramParsing === false
    ? annotatedRuns
    : applyTelegramMarks(annotatedRuns);

  return {
    id: block.id,
    type: block.type,
    text,
    runs: finalRuns.map((run, index): RenderRun => ({
      key: `${block.id}:${index}:${run.start}:${run.end}`,
      text: run.text,
      marks: run.marks,
    })),
  };
}

export function buildRenderBlocks(
  document: RichDocument,
  options?: {
    annotations?: RangeAnnotation[];
    enableTelegramParsing?: boolean;
  },
): RenderBlock[] {
  return document.blocks.map((block) => buildRenderBlock(block, options));
}
