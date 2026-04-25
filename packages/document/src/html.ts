import { createBlock, createDocumentFromBlocks, createTextNode } from "./document";
import type { RichBlock, RichBlockType, RichDocument, RichMark, RichTextNode } from "./types";

type Token =
  | { type: "text"; value: string }
  | {
      type: "tag";
      name: string;
      closing: boolean;
      selfClosing: boolean;
      attrs: Record<string, string>;
    };

type BlockDraft = {
  type: RichBlockType;
  attrs?: RichBlock["attrs"];
  content: RichTextNode[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;

  for (const match of raw.matchAll(attrRegex)) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attrs[name] = decodeHtml(match[3] ?? match[4] ?? match[5] ?? "");
  }

  return attrs;
}

function tokenizeHtml(html: string): Token[] {
  const tokens: Token[] = [];
  const regex = /<[^>]+>|[^<]+/g;

  for (const match of html.match(regex) ?? []) {
    if (match.startsWith("<")) {
      const tagMatch = match.match(/^<\s*(\/)?\s*([a-zA-Z0-9-]+)([^>]*)>/);
      if (!tagMatch) continue;
      const closing = Boolean(tagMatch[1]);
      const name = tagMatch[2]?.toLowerCase() ?? "";
      const rest = tagMatch[3] ?? "";
      const selfClosing = /\/\s*>$/.test(match) || name === "br";
      tokens.push({
        type: "tag",
        name,
        closing,
        selfClosing,
        attrs: parseAttributes(rest),
      });
      continue;
    }

    tokens.push({
      type: "text",
      value: decodeHtml(match),
    });
  }

  return tokens;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function marksEqual(left: RichMark[] = [], right: RichMark[] = []): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pushTextNode(block: BlockDraft, text: string, marks: RichMark[]) {
  if (!text) return;
  const previous = block.content[block.content.length - 1];
  if (previous && marksEqual(previous.marks ?? [], marks)) {
    previous.text += text;
    return;
  }

  block.content.push(
    createTextNode(text, marks.length > 0 ? marks.map((mark) => ({ ...mark })) : []),
  );
}

function createEmptyBlock(type: RichBlockType = "paragraph", attrs?: RichBlock["attrs"]): BlockDraft {
  return {
    type,
    attrs,
    content: [],
  };
}

function coerceStyleMarks(style: string): RichMark[] {
  const lower = style.toLowerCase();
  const marks: RichMark[] = [];

  if (/font-weight\s*:\s*(bold|[5-9]00)/.test(lower)) {
    marks.push({ type: "bold" });
  }
  if (/font-style\s*:\s*italic/.test(lower)) {
    marks.push({ type: "italic" });
  }
  if (/text-decoration[^;]*underline/.test(lower)) {
    marks.push({ type: "underline" });
  }

  const backgroundMatch = lower.match(/background(?:-color)?\s*:\s*([^;]+)/);
  if (backgroundMatch?.[1]) {
    marks.push({
      type: "highlight",
      attrs: { color: backgroundMatch[1].trim() },
    });
  }

  return marks;
}

function getTagMarks(name: string, attrs: Record<string, string>): RichMark[] {
  if (name === "strong" || name === "b") return [{ type: "bold" }];
  if (name === "em" || name === "i") return [{ type: "italic" }];
  if (name === "u") return [{ type: "underline" }];
  if (name === "mark") return [{ type: "highlight" }];
  if (name === "a" && attrs.href) {
    return [{ type: "link", attrs: { href: attrs.href } }];
  }
  if (name === "span" && attrs.style) {
    return coerceStyleMarks(attrs.style);
  }

  return [];
}

function finalizeBlock(blocks: RichBlock[], current: BlockDraft | null, index: number): BlockDraft | null {
  if (!current) return null;

  const hasContent = current.content.some((node) => node.text.trim().length > 0);
  if (!hasContent) return null;

  blocks.push({
    id: `block-${index + 1}`,
    type: current.type,
    attrs: current.attrs,
    content: current.content,
  });

  return null;
}

export function createDocumentFromHtml(html: string): RichDocument {
  const tokens = tokenizeHtml(html);
  const blocks: RichBlock[] = [];
  let current: BlockDraft | null = null;
  const markStack: RichMark[] = [];
  let blockIndex = 0;
  let listDepth = 0;

  const ensureBlock = (type: RichBlockType = "paragraph", attrs?: RichBlock["attrs"]) => {
    if (!current) {
      current = createEmptyBlock(type, attrs);
    }
    return current;
  };

  const flushBlock = () => {
    current = finalizeBlock(blocks, current, blockIndex);
    if (blocks.length > blockIndex) {
      blockIndex = blocks.length;
    }
  };

  for (const token of tokens) {
    if (token.type === "text") {
      const text = normalizeWhitespace(token.value);
      if (!text) continue;
      pushTextNode(ensureBlock(), text, markStack);
      continue;
    }

    const { name, closing, selfClosing, attrs } = token;

    if (!closing && (name === "p" || name === "div" || name === "blockquote" || name === "li")) {
      flushBlock();
      const type: RichBlockType = name === "blockquote" ? "blockquote" : "paragraph";
      const blockAttrs =
        name === "li"
          ? ({ list: listDepth > 0 ? "bullet" : "plain" } as RichBlock["attrs"])
          : undefined;
      current = createEmptyBlock(type, blockAttrs);
      continue;
    }

    if (closing && (name === "p" || name === "div" || name === "blockquote" || name === "li")) {
      flushBlock();
      continue;
    }

    if (name === "ul") {
      listDepth += closing ? -1 : 1;
      if (listDepth < 0) listDepth = 0;
      continue;
    }

    if (name === "br") {
      pushTextNode(ensureBlock(), "\n", markStack);
      continue;
    }

    const tagMarks = getTagMarks(name, attrs);
    if (tagMarks.length > 0) {
      if (closing) {
        for (let index = tagMarks.length - 1; index >= 0; index -= 1) {
          const target = JSON.stringify(tagMarks[index]);
          const stackIndex = [...markStack]
            .reverse()
            .findIndex((mark) => JSON.stringify(mark) === target);
          if (stackIndex >= 0) {
            markStack.splice(markStack.length - 1 - stackIndex, 1);
          }
        }
      } else {
        markStack.push(...tagMarks);
      }
    }

    if (selfClosing && tagMarks.length > 0) {
      markStack.splice(markStack.length - tagMarks.length, tagMarks.length);
    }
  }

  flushBlock();

  if (blocks.length === 0) {
    return createDocumentFromBlocks([
      createBlock({
        id: "block-1",
        text: "",
      }),
    ]);
  }

  return createDocumentFromBlocks(blocks);
}

function renderInlineNode(node: RichTextNode): string {
  let value = escapeHtml(node.text).replace(/\n/g, "<br/>");

  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") value = `<strong>${value}</strong>`;
    if (mark.type === "italic") value = `<em>${value}</em>`;
    if (mark.type === "underline") value = `<u>${value}</u>`;
    if (mark.type === "highlight") {
      const color = typeof mark.attrs?.color === "string" ? mark.attrs.color : "rgba(245, 158, 11, 0.35)";
      value = `<mark style="background:${escapeHtml(color)};">${value}</mark>`;
    }
    if (mark.type === "link") {
      const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "#";
      value = `<a href="${escapeHtml(href)}">${value}</a>`;
    }
  }

  return value;
}

function renderBlock(block: RichBlock): string {
  const content = block.content.map(renderInlineNode).join("");

  if (block.type === "blockquote") {
    return `<blockquote>${content || "<br/>"}</blockquote>`;
  }

  if (block.attrs?.list === "bullet") {
    return `<ul><li>${content || "<br/>"}</li></ul>`;
  }

  return `<p>${content || "<br/>"}</p>`;
}

export function serializeDocumentToHtml(document: RichDocument): string {
  const html = document.blocks.map(renderBlock).join("");
  return html || "<p><br/></p>";
}
