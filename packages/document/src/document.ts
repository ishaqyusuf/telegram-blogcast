import type { RichBlock, RichBlockType, RichDocument, RichTextNode } from "./types";

export function createTextNode(text: string, marks: RichTextNode["marks"] = []): RichTextNode {
  return {
    type: "text",
    text,
    marks,
  };
}

export function createBlock(input: {
  id: string;
  text: string;
  type?: RichBlockType;
  attrs?: RichBlock["attrs"];
}): RichBlock {
  return {
    id: input.id,
    type: input.type ?? "paragraph",
    attrs: input.attrs,
    content: [createTextNode(input.text)],
  };
}

export function createDocumentFromBlocks(blocks: RichBlock[]): RichDocument {
  return {
    type: "doc",
    version: 1,
    blocks,
  };
}

export function createDocumentFromPlainText(text: string): RichDocument {
  const blocks = text
    .split(/\n\s*\n|\r\n\s*\r\n/g)
    .map((blockText, index) => blockText.trim())
    .filter(Boolean)
    .map((blockText, index) =>
      createBlock({
        id: `block-${index + 1}`,
        text: blockText,
      }),
    );

  return createDocumentFromBlocks(blocks);
}

export function createDocumentFromParagraphs(
  paragraphs: Array<{
    id: string | number;
    text: string;
    type?: RichBlockType;
    attrs?: RichBlock["attrs"];
  }>,
): RichDocument {
  return createDocumentFromBlocks(
    paragraphs.map((paragraph) =>
      createBlock({
        id: String(paragraph.id),
        text: paragraph.text,
        type: paragraph.type,
        attrs: paragraph.attrs,
      }),
    ),
  );
}

export function getBlockText(block: RichBlock): string {
  return block.content.map((node) => node.text).join("");
}

export function getDocumentPlainText(document: RichDocument): string {
  return document.blocks.map(getBlockText).join("\n\n");
}
