import { describe, expect, test } from "bun:test";
import type { TRPCContext } from "../init";
import { bookRoutes } from "./book.routes";

const rootUrl = "https://shamela.ws/book/23833";
const treeHtml = `<div class="betaka-index"><ul><li>
  <a class="exp_bu" data-id="10" href="javascript:;">+</a><a href="/book/23833/106">Parent</a>
  <ul style="display:none"><li><a href="/book/23833/106">Child</a></li></ul>
  </li></ul></div>`;
const pageHtml = `<html><head><title>Book</title></head><body>
  <h1><a href="/book/23833">Book</a></h1>
  <div class="nass"><p>Saved <span class="c5">formatted</span> content.</p></div>
  <div id="appended_pages"></div></body></html>`;

function database(existing = true, tocStatus = "pending") {
  let book: any = existing ? { id: 1, shamelaId: 23833, tocStatus } : null;
  const pages = new Map<number, any>();
  const nodes = new Map<string, any>();
  const calls: string[] = [];
  let failNode = false;
  const staged: any = {
    id: 1,
    status: "staged",
    bookId: null,
    createdAt: new Date(),
    rawPage: {
      id: 1,
      html: pageHtml,
      requestedUrl: `${rootUrl}/106`,
      finalUrl: `${rootUrl}/106`,
      title: "Book",
    },
  };
  const db: any = {
    book: {
      findFirst: async () => book,
      findFirstOrThrow: async () => {
        if (!book) throw new Error("No book");
        return book;
      },
      create: async ({ data }: any) =>
        (book = { id: 1, tocStatus: "pending", ...data }),
      update: async ({ data }: any) => {
        Object.assign(book, data);
        return book;
      },
    },
    blog: { create: async () => ({ id: 1 }) },
    bookPage: {
      findFirst: async () => pages.get(106) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const key = where.bookId_shamelaPageNo.shamelaPageNo;
        const page = pages.get(key);
        if (page) Object.assign(page, update);
        else pages.set(key, { id: key, paragraphs: [], ...create });
        return pages.get(key);
      },
      update: async ({ where, data }: any) => {
        Object.assign(pages.get(where.id), data);
        return pages.get(where.id);
      },
    },
    bookTocNode: {
      upsert: async ({ where, create, update }: any) => {
        calls.push("node");
        if (failNode) throw new Error("Tree write failed");
        const key = where.bookId_treePath.treePath;
        if (nodes.has(key)) Object.assign(nodes.get(key), update);
        else nodes.set(key, { id: nodes.size + 1, ...create });
        return nodes.get(key);
      },
      updateMany: async () => ({ count: 0 }),
    },
    shamelaStagedPageParse: {
      findFirstOrThrow: async () => staged,
      update: async ({ data }: any) => Object.assign(staged, data),
    },
    bookPageImportHistory: {
      create: async () => ({ id: 1 }),
      update: async () => ({ id: 1 }),
    },
    bookPageParagraph: {
      deleteMany: async () => calls.push("paragraphs"),
      createMany: async () => {},
      findMany: async () => [],
    },
    bookPageFootnote: {
      deleteMany: async () => {},
      createMany: async () => {},
    },
    bookPageHighlight: { findMany: async () => [] },
    bookPageComment: { findMany: async () => [] },
    $transaction: async (work: (tx: any) => Promise<unknown>) => {
      calls.push("transaction");
      const snapshot = structuredClone({ book, pages, nodes });
      try {
        return await work(db);
      } catch (error) {
        book = snapshot.book;
        pages.clear();
        snapshot.pages.forEach((v, k) => pages.set(k, v));
        nodes.clear();
        snapshot.nodes.forEach((v, k) => nodes.set(k, v));
        throw error;
      }
    },
  };
  return {
    caller: bookRoutes.createCaller({ db } as TRPCContext),
    pages,
    nodes,
    calls,
    staged,
    book: () => book,
    failNodes: () => {
      failNode = true;
    },
  };
}

describe("separate Shamela capture", () => {
  for (const state of ["new", "pending", "complete"]) {
    test(`saves formatted page before chapters for ${state} books`, async () => {
      const fixture = database(state !== "new", state);
      const result = await fixture.caller.promoteStagedShamelaPageParse({
        stagedParseId: 1,
      });
      expect(result.page.id).toBe(106);
      expect(result.requiresFullToc).toBe(state !== "complete");
      expect(result.shamelaBookId).toBe(23833);
      expect(fixture.nodes.size).toBe(0);
      expect(
        fixture.pages
          .get(106)
          .documentJson.content.find((block: any) => block.type === "paragraph")
          .marks.length,
      ).toBeGreaterThan(0);
      const retry = await fixture.caller.promoteStagedShamelaPageParse({
        stagedParseId: 1,
      });
      expect(retry.page.id).toBe(result.page.id);
      expect(
        fixture.calls.filter((call) => call === "paragraphs"),
      ).toHaveLength(1);
    });
  }

  test("chapter retries preserve page metadata and annotations with stable hierarchy IDs", async () => {
    const fixture = database();
    const page = {
      id: 106,
      bookId: 1,
      documentJson: { content: "formatted" },
      printedPageNo: 9,
      highlights: [{ id: 20 }],
      comments: [{ id: 30 }],
      chapterTitle: "Existing title",
    };
    fixture.pages.set(106, structuredClone(page));
    const input = { bookId: 1, finalUrl: rootUrl, html: treeHtml };
    await fixture.caller.captureShamelaChapters(input);
    const ids = [...fixture.nodes.values()].map((node) => node.id);
    await fixture.caller.captureShamelaChapters(input);
    expect(fixture.pages.get(106)).toEqual(page);
    expect(fixture.pages.size).toBe(1);
    expect(fixture.nodes.size).toBe(2);
    expect([...fixture.nodes.values()].map((node) => node.id)).toEqual(ids);
    expect(fixture.nodes.get("10.page-106-1").parentId).toBe(
      fixture.nodes.get("10").id,
    );
    expect(fixture.book().tocStatus).toBe("complete");
    expect(fixture.calls).not.toContain("paragraphs");
  });

  test("rejects non-root, wrong-book, missing, unloaded and foreign-link trees before writing", async () => {
    for (const [finalUrl, html] of [
      [`${rootUrl}/106`, treeHtml],
      ["https://shamela.ws/book/99", treeHtml],
      ["https://example.com/book/23833", treeHtml],
      [rootUrl, "<html>Cloudflare</html>"],
      [rootUrl, treeHtml.replace(/<ul style="display:none">.*?<\/ul>/s, "")],
      [rootUrl, treeHtml.replaceAll("/book/23833/106", "/book/99/106")],
    ]) {
      const fixture = database();
      await expect(
        fixture.caller.captureShamelaChapters({
          bookId: 1,
          finalUrl: finalUrl!,
          html: html!,
        }),
      ).rejects.toThrow();
      expect(fixture.calls).toEqual([]);
      expect(fixture.book().tocStatus).toBe("pending");
    }
  });

  test("a failed transaction leaves the saved page and previous tree status intact", async () => {
    const fixture = database(true, "complete");
    fixture.pages.set(106, { id: 106, documentJson: { content: "saved" } });
    fixture.failNodes();
    await expect(
      fixture.caller.captureShamelaChapters({
        bookId: 1,
        finalUrl: rootUrl,
        html: treeHtml,
      }),
    ).rejects.toThrow("Tree write failed");
    expect(fixture.book().tocStatus).toBe("complete");
    expect(fixture.pages.get(106).documentJson.content).toBe("saved");
    expect(fixture.nodes.size).toBe(0);
  });
});
