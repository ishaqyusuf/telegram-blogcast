import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { PrismaClient } from "@acme/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { bookChapterRoutes } from "./book-chapter.routes";

const testUrl = process.env.CHAPTER_IMPORT_TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/alghurobaa_chapter_test") {
    throw new Error("Requires the dedicated localhost chapter test database.");
  }
}
const db = testUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) })
  : null;
afterAll(async () => { await db?.$disconnect(); });

describe.skipIf(!testUrl)("chapter capture PostgreSQL transaction", () => {
  test("acquires its advisory lock and reuses a completed capture", async () => {
    const html = "<div class='betaka-index'><ul><li>Test</li></ul></div>";
    const book = await db!.book.create({ data: {
      shamelaId: 23833, blog: { create: { type: "book" } },
    } });
    const page = await db!.bookPage.create({ data: {
      bookId: book.id, shamelaPageNo: 106, status: "fetched",
      shamelaUrl: "/book/23833/106",
    } });
    // A terminal import avoids dispatching an external job from this local test.
    const job = await db!.bookChapterImport.create({ data: {
      bookId: book.id, returnPageId: page.id, ownerHash: "local-test-owner",
      rawHtml: html, captureHash: createHash("sha256").update(html).digest("hex"),
      status: "complete",
    } });
    const caller = bookChapterRoutes.createCaller({
      db: db!, bookImportOwnerHash: "local-test-owner",
    });
    const input = { bookId: book.id, pageId: page.id,
      finalUrl: "https://shamela.ws/book/23833", html };
    expect((await caller.capture(input)).id).toBe(job.id);
    expect((await caller.capture(input)).id).toBe(job.id);
    expect(await db!.bookChapterImport.count({ where: { bookId: book.id } })).toBe(1);
  });
});
