import { expect, test } from "bun:test";
import { randomInt } from "node:crypto";
import { db } from "@acme/db";
import { bookRoutes } from "./book.routes";
import { readBookPageRecord } from "./book-page-reader";

test.skipIf(process.env.BOOK_PAGE_POSTGRES_TEST !== "1")("page writes serialize versions and roll back failed replacements in PostgreSQL", async () => {
  const url = new URL(process.env.POSTGRES_URL ?? "");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("Page write integration requires isolated localhost PostgreSQL.");
  const bookId = randomInt(1_000_000_000, 2_000_000_000);
  const blog = await db.blog.create({ data: { published: false } });
  try {
    await db.book.create({ data: { id: bookId, blogId: blog.id, editable: true, sourceType: "user" } });
    const caller = bookRoutes.createCaller({ db });
    await Promise.all(["First", "Second"].map((pageText) => caller.importBookPageManually({ bookId, shamelaPageNo: 1, pageText })));
    const page = await db.bookPage.findUniqueOrThrow({ where: { bookId_shamelaPageNo: { bookId, shamelaPageNo: 1 } }, include: { paragraphs: true } });
    expect(page.rawJson).toMatchObject({ contentVersion: 2 });
    expect(page.paragraphs).toHaveLength(1);
    expect(await db.bookPage.count({ where: { bookId } })).toBe(1);

    const failingDb = db.$extends({ query: { bookPageParagraph: { async createMany() { throw new Error("Injected paragraph write failure"); } } } });
    await expect(bookRoutes.createCaller({ db: failingDb as typeof db }).importBookPageManually({ bookId, shamelaPageNo: 1, pageText: "Must roll back" })).rejects.toThrow();
    const retained = await db.bookPage.findUniqueOrThrow({ where: { id: page.id }, include: { paragraphs: true } });
    expect(retained.rawJson).toEqual(page.rawJson);
    expect(retained.paragraphs).toEqual(page.paragraphs);
    expect(await db.bookPageImportHistory.count({ where: { bookId, status: "failed" } })).toBe(1);

    const document = { type: "doc", version: 1, blocks: [] };
    const results = await Promise.allSettled(["Editor one", "Editor two"].map((plainText) => caller.savePageDocument({ pageId: page.id, baseVersion: 2, document, plainText })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({ code: "CONFLICT" });
    expect((await db.bookPage.findUniqueOrThrow({ where: { id: page.id } })).rawJson).toMatchObject({ contentVersion: 3 });

    let interleaved = false;
    const racingReader = db.$extends({ query: { bookPage: { async findFirstOrThrow({ args, query }) {
      const result = await query(args);
      if (!interleaved) {
        interleaved = true;
        await caller.importBookPageManually({ bookId, shamelaPageNo: 1, pageText: "Consistent replacement" });
      }
      return result;
    } } } });
    const snapshot = await readBookPageRecord(racingReader as typeof db, page.id, () => null);
    expect(snapshot.rawJson).toMatchObject({ contentVersion: 4 });
    expect(snapshot.paragraphs.map((paragraph) => paragraph.text)).toEqual(["Consistent replacement"]);
  } finally {
    await db.bookPageImportHistory.deleteMany({ where: { bookId } });
    await db.bookPageParagraph.deleteMany({ where: { page: { bookId } } });
    await db.bookPageFootnote.deleteMany({ where: { page: { bookId } } });
    await db.bookPage.deleteMany({ where: { bookId } });
    await db.book.deleteMany({ where: { id: bookId } });
    await db.blog.delete({ where: { id: blog.id } });
  }
}, 45_000);
