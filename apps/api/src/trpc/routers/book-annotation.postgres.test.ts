import { expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@acme/db";
import { bookAnnotationRoutes } from "./book-annotation.routes";

function requireLocalDatabase() {
  const url = new URL(process.env.POSTGRES_URL ?? "");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("Annotation integration tests require an isolated local PostgreSQL database.");
}

test.skipIf(process.env.BOOK_ANNOTATION_POSTGRES_TEST !== "1")("private annotation SQL retries and tombstones work in a rolled-back PostgreSQL transaction", async () => {
  requireLocalDatabase();
  const page = await db.bookPage.findFirstOrThrow({ where: { deletedAt: null, status: "fetched", book: { shamelaId: 23833, deletedAt: null } }, select: { id: true, bookId: true } });
  const owner = createHash("sha256").update(randomUUID()).digest("hex");
  const localId = `smoke-${randomUUID()}`;
  const rollback = new Error("ROLLBACK_ANNOTATION_SMOKE_TEST");
  try {
    await db.$transaction(async (tx) => {
      // Route transactions run inside this enclosing transaction so the whole smoke test is rolled back.
      const scopedDb = new Proxy(tx, { get(target, key) { return key === "$transaction" ? (work: (client: typeof tx) => unknown) => work(tx) : Reflect.get(target, key); } });
      const caller = bookAnnotationRoutes.createCaller({ db: scopedDb as any, bookImportOwnerHash: owner });
      const annotation = { localId, pageId: page.id, revision: 1, deleted: false, payload: { kind: "comment" as const, paragraphId: null, paragraphPid: null, quoteText: null, content: "Rollback-only private annotation verification" } };
      const input = { bookId: page.bookId, scope: "guest", items: [annotation] };
      await caller.sync(input);
      await caller.sync(input);
      expect(await tx.bookDeviceAnnotation.count({ where: { ownerHash: owner } })).toBe(1);
      await caller.sync({ ...input, items: [{ ...annotation, revision: 2, deleted: true }] });
      const replay = await caller.sync(input);
      expect(replay[0]).toMatchObject({ revision: 2, deleted: true, pageId: page.id });
      const other = bookAnnotationRoutes.createCaller({ db: scopedDb as any, bookImportOwnerHash: createHash("sha256").update(randomUUID()).digest("hex") });
      expect((await other.list({ bookId: page.bookId, scope: "guest" })).items).toEqual([]);
      throw rollback;
    }, { timeout: 30_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  expect(await db.bookDeviceAnnotation.count({ where: { ownerHash: owner } })).toBe(0);
}, 45_000);

test.skipIf(process.env.BOOK_ANNOTATION_POSTGRES_TEST !== "1")("a mixed annotation conflict rolls back every row through the real route transaction", async () => {
  requireLocalDatabase();
  const page = await db.bookPage.findFirstOrThrow({ where: { deletedAt: null, status: "fetched", book: { shamelaId: 23833, deletedAt: null } }, select: { id: true, bookId: true } });
  const owner = createHash("sha256").update(randomUUID()).digest("hex");
  const caller = bookAnnotationRoutes.createCaller({ db, bookImportOwnerHash: owner });
  const annotation = { localId: `conflict-${randomUUID()}`, pageId: page.id, revision: 1, deleted: false, payload: { kind: "comment" as const, paragraphId: null, paragraphPid: null, quoteText: null, content: "Original local fixture" } };
  try {
    await caller.sync({ bookId: page.bookId, scope: "guest", items: [annotation] });
    await expect(caller.sync({ bookId: page.bookId, scope: "guest", items: [
      { ...annotation, localId: `new-${randomUUID()}` },
      { ...annotation, payload: { ...annotation.payload, content: "Conflicting revision" } },
    ] })).rejects.toMatchObject({ code: "CONFLICT" });
    const rows = await db.bookDeviceAnnotation.findMany({ where: { ownerHash: owner } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ localId: annotation.localId, revision: 1, payload: annotation.payload });
  } finally {
    await db.bookDeviceAnnotation.deleteMany({ where: { ownerHash: owner } });
  }
}, 45_000);
