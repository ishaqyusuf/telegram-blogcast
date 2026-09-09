import { expect, test } from "bun:test";
import { bookRoutes } from "./book.routes";

test("page reimport advances the content version instead of resetting edited content to zero", async () => {
  let page: any = { id: 12, bookId: 3, shamelaPageNo: 106, rawJson: { contentVersion: 7, contentDocument: { stale: true } }, paragraphs: [] };
  let upsert: any;
  let locked = false;
  const db: any = {
    $transaction: async (work: any) => { locked = false; return work(db); },
    $queryRaw: async (_sql: unknown, bookId: number, pageNo: number) => {
      expect([bookId, pageNo]).toEqual([3, 106]);
      locked = true;
      return [];
    },
    book: { findFirstOrThrow: async () => ({ id: 3, editable: true, sourceType: "user" }), update: async () => ({}) },
    bookPage: {
      findFirst: async () => page,
      upsert: async (args: any) => { expect(locked).toBe(true); upsert = args; page = { ...page, ...args.update }; return page; },
    },
    bookPageImportHistory: { create: async () => ({ id: 1 }), update: async () => ({}) },
    bookPageParagraph: { deleteMany: async () => ({}), createMany: async () => ({}), findMany: async () => [] },
    bookPageFootnote: { deleteMany: async () => ({}) },
    bookPageHighlight: { findMany: async () => [] },
    bookPageComment: { findMany: async () => [] },
    bookTocNode: { updateMany: async () => ({}) },
  };
  const caller = bookRoutes.createCaller({ db });
  await caller.importBookPageManually({ bookId: 3, shamelaPageNo: 106, pageText: "Replacement content" });
  expect(upsert.update.rawJson.contentVersion).toBe(8);
  expect(upsert.update.rawJson.contentUpdatedAt).toEqual(expect.any(String));
  expect(upsert.update.rawJson).not.toHaveProperty("contentDocument");
  await caller.importBookPageManually({ bookId: 3, shamelaPageNo: 106, pageText: "Next replacement" });
  expect(upsert.update.rawJson.contentVersion).toBe(9);
});
