import { describe, expect, test } from "bun:test";
import { bookAnnotationRoutes } from "./book-annotation.routes";

const ownerA = "a".repeat(64);
const ownerB = "b".repeat(64);
const item = (localId = "hl-12", revision = 1, deleted = false) => ({ localId, pageId: 12, revision, deleted, payload: { kind: "highlight" as const, paragraphId: 19, paragraphPid: 1, quoteText: "Text", startOffset: 0, endOffset: 4, color: "#ffff00", note: null } });

function fixture() {
  let records = new Map<string, any>();
  let statements = 0;
  const delegate = {
    async findMany({ where, take }: any) {
      return [...records.values()].filter((row) => row.ownerHash === where.ownerHash && row.scope === where.scope && (where.bookId === undefined || row.bookId === where.bookId) && (!where.localId?.in || where.localId.in.includes(row.localId)) && (!where.localId?.gt || row.localId > where.localId.gt))
        .sort((a, b) => a.localId.localeCompare(b.localId)).slice(0, take)
        .map(({ ownerHash, scope, ...row }) => row);
    },
  };
  const tx = {
    bookPage: { findMany: async ({ where }: any) => where.bookId === 3 ? where.id.in.filter((id: number) => id === 12 || id === 13).map((id: number) => ({ id })) : [] },
    bookDeviceAnnotation: delegate,
    async $executeRaw(_sql: TemplateStringsArray, json: string) {
      statements++;
      for (const row of JSON.parse(json)) {
        const key = `${row.ownerHash}:${row.scope}:${row.localId}`;
        const previous = records.get(key);
        if (!previous || (previous.bookId === row.bookId && previous.pageId === row.pageId && previous.kind === row.kind && previous.revision < row.revision)) records.set(key, { ...row, updatedAt: new Date() });
      }
    },
  };
  const db = { ...tx, async $transaction(work: any) {
    const before = new Map(records);
    try { return await work(tx); } catch (error) { records = before; throw error; }
  } };
  return { caller: (owner = ownerA) => bookAnnotationRoutes.createCaller({ db: db as any, bookImportOwnerHash: owner }), count: () => records.size, statements: () => statements };
}

describe("private device annotation protocol", () => {
  test("rejects missing or malformed device capabilities", async () => {
    const f = fixture();
    await expect(f.caller("").capabilities()).rejects.toThrow("private device capability");
    await expect(f.caller("user:1").list({ bookId: 3, scope: "guest" })).rejects.toThrow();
    expect(f.count()).toBe(0);
  });

  test("batch writes are owner-scoped and never expose the capability hash", async () => {
    const f = fixture();
    const a = f.caller();
    const saved = await a.sync({ bookId: 3, scope: "guest", items: [item(), item("hl-13")] });
    expect(f.statements()).toBe(1);
    expect(saved).toHaveLength(2);
    expect(JSON.stringify(saved)).not.toContain(ownerA);
    expect((await f.caller(ownerB).list({ bookId: 3, scope: "guest" })).items).toEqual([]);
    expect((await a.list({ bookId: 3, scope: "user:1" })).items).toEqual([]);
    await f.caller(ownerB).sync({ bookId: 3, scope: "guest", items: [item()] });
    expect(f.count()).toBe(3);
  });

  test("retries do not duplicate rows and stale creates cannot resurrect deleted annotations", async () => {
    const f = fixture();
    const a = f.caller();
    for (let n = 0; n < 2; n++) await a.sync({ bookId: 3, scope: "guest", items: [item()] });
    expect(f.count()).toBe(1);
    await a.sync({ bookId: 3, scope: "guest", items: [item("hl-12", 2, true)] });
    const retried = await a.sync({ bookId: 3, scope: "guest", items: [item()] });
    expect(retried[0]).toMatchObject({ revision: 2, deleted: true });
    expect(f.count()).toBe(1);
  });

  test("conflicting revisions and identity changes abort the entire batch", async () => {
    const f = fixture();
    const a = f.caller();
    await a.sync({ bookId: 3, scope: "guest", items: [item()] });
    await expect(a.sync({ bookId: 3, scope: "guest", items: [item("new"), { ...item(), payload: { ...item().payload, color: "#ff0000" } }] })).rejects.toThrow("revision was reused");
    expect(f.count()).toBe(1);
    await expect(a.sync({ bookId: 3, scope: "guest", items: [{ ...item("hl-12", 2), pageId: 13 }] })).rejects.toThrow("cannot change");
    await expect(a.sync({ bookId: 3, scope: "guest", items: [{ ...item(), pageId: 999 }] })).rejects.toThrow("does not belong");
    expect(f.count()).toBe(1);
  });

  test("validates batch size, duplicate keys, payload shape and range", async () => {
    const a = fixture().caller();
    await expect(a.sync({ bookId: 3, scope: "guest", items: Array.from({ length: 21 }, (_, i) => item(`hl-${i}`)) })).rejects.toThrow();
    await expect(a.sync({ bookId: 3, scope: "guest", items: [item(), item()] })).rejects.toThrow("Duplicate");
    await expect(a.sync({ bookId: 3, scope: "guest", items: [{ ...item(), payload: { ...item().payload, startOffset: 10 } }] })).rejects.toThrow("Invalid highlight range");
  });

  test("paginated pulls include deletion records", async () => {
    const a = fixture().caller();
    await a.sync({ bookId: 3, scope: "guest", items: [item("a", 2, true), item("b")] });
    const first = await a.list({ bookId: 3, scope: "guest", limit: 1 });
    expect(first.nextCursor).toBe("a");
    expect(first.items[0]?.deleted).toBe(true);
    const last = await a.list({ bookId: 3, scope: "guest", afterId: first.nextCursor!, limit: 1 });
    expect(last.items[0]?.localId).toBe("b");
    expect(last.nextCursor).toBeNull();
  });
});
