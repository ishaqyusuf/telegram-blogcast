import { expect, test } from "bun:test";
import { readBookPageRecord } from "./book-page-reader";

test("continuously changing content fails after bounded snapshot retries", async () => {
  let reads = 0;
  const empty = { findMany: async () => [] };
  const db: any = {
    bookPage: { findFirstOrThrow: async () => ({ id: 1, bookId: 3, rawJson: { contentVersion: ++reads } }) },
    bookPageParagraph: empty, bookPageFootnote: empty, bookPageHighlight: empty,
    mediaBookPageReference: empty, bookPageComment: empty,
    book: { findUniqueOrThrow: async () => ({ id: 3 }) },
  };
  await expect(readBookPageRecord(db, 1, () => null)).rejects.toMatchObject({ code: "CONFLICT" });
  expect(reads).toBe(6);
});

test("page relations start concurrently and preserve reader metadata and filters", async () => {
  const calls: Record<string, any> = {};
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const relation = (name: string, result: unknown) => async (args: any) => {
    calls[name] = args;
    if (Object.keys(calls).length === 8) release();
    await gate;
    return result;
  };
  const db: any = {
    bookPage: {
      findFirstOrThrow: async (args: any) => { expect(args.where).toEqual({ id: 170, deletedAt: null }); return { id: 170, bookId: 3, volumeId: 2, previousShamelaPageNo: 105, nextShamelaUrl: "/book/23833/107", rawJson: { contentVersion: 4 } }; },
      findMany: relation("adjacent", [{ id: 171, shamelaPageNo: 107, status: "fetched" }]),
    },
    bookPageParagraph: { findMany: relation("paragraphs", [{ id: 1, pid: 1, text: "Text", sourceMarks: [{ kind: "c5" }] }]) },
    bookPageFootnote: { findMany: relation("footnotes", [{ id: 2, content: "Note" }]) },
    bookPageHighlight: { findMany: relation("highlights", [{ id: 3, color: "#FFD700" }]) },
    mediaBookPageReference: { findMany: relation("audio", [{ id: 4, media: { id: 5 } }]) },
    bookPageComment: { findMany: relation("comments", [{ id: 6, content: "Comment" }]) },
    bookVolume: { findUnique: relation("volume", { id: 2, number: 1 }) },
    book: { findUniqueOrThrow: relation("book", { id: 3, shamelaId: 23833 }) },
  };
  const page = await readBookPageRecord(db, 170, (url) => { expect(url).toBe("/book/23833/107"); return 107; });
  expect(page.adjacentPages.previous).toMatchObject({ shamelaPageNo: 105, page: null });
  expect(page.adjacentPages.next.page?.id).toBe(171);
  expect(calls.adjacent.where).toEqual({ bookId: 3, shamelaPageNo: { in: [105, 107] }, deletedAt: null });
  expect(page.rawJson).toEqual({ contentVersion: 4 });
  expect(page.paragraphs[0]?.sourceMarks).toEqual([{ kind: "c5" }]);
  expect(page.footnotes).toHaveLength(1);
  expect(page.highlights).toHaveLength(1);
  expect(page.audioReferences).toHaveLength(1);
  expect(page.comments).toHaveLength(1);
  expect(page.volume?.id).toBe(2);
  expect(calls.comments.where).toEqual({ pageId: 170, deletedAt: null });
  expect(calls.audio.where).toEqual({ pageId: 170, deletedAt: null });
  expect(calls.paragraphs.orderBy).toEqual({ pid: "asc" });
  expect(calls.audio.include.media.select.file.select.duration).toBe(true);
});
