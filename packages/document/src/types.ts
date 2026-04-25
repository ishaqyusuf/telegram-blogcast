export type RichBlockType = "paragraph" | "heading" | "blockquote";

export type RichMarkType =
  | "bold"
  | "italic"
  | "underline"
  | "highlight"
  | "link"
  | "hashtag"
  | "timestamp";

export type RichMark = {
  type: RichMarkType;
  attrs?: Record<string, string | number | boolean | null | undefined>;
};

export type RichTextNode = {
  type: "text";
  text: string;
  marks?: RichMark[];
};

export type RichBlock = {
  id: string;
  type: RichBlockType;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  content: RichTextNode[];
};

export type RichDocument = {
  type: "doc";
  version: 1;
  blocks: RichBlock[];
};

export type RangeAnnotation = {
  id: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  kind: "highlight";
  color?: string | null;
  note?: string | null;
  quoteText?: string | null;
};

export type TelegramSegment =
  | { type: "text"; value: string }
  | { type: "hashtag"; value: string }
  | { type: "timestamp"; value: string }
  | { type: "link"; value: string };

export type RenderRun = {
  key: string;
  text: string;
  marks: RichMark[];
};

export type RenderBlock = {
  id: string;
  type: RichBlockType;
  text: string;
  runs: RenderRun[];
};
