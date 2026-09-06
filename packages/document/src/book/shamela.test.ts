import { describe, expect, test } from "bun:test";

import {
  extractShamelaTocTree,
  hydrateShamelaTocHtml,
  parseShamelaOpenPage,
} from "./shamela";

const PAGE_URL = "https://shamela.ws/book/21739/1";

function pageHtml(toc: string) {
  return `
    <html><head><title>ج1 - ص9 - كتاب بداية المجتهد</title></head><body>
      <h1><a href="https://shamela.ws/book/21739">كتاب بداية المجتهد</a></h1>
      <div class="s-nav">
        <div class="s-nav-head"><h4>فصول الكتاب</h4></div>
        <ul>${toc}</ul>
      </div></div><div class="col-md-8">
        <div class="nass" data-page-id="1" data-page-num="9">
          <p><span id="p1" class="anchor"></span>مقدمة طويلة للاختبار <span class="c5">نص أزرق من المصدر</span> ونهاية الفقرة.</p>
        </div><div id="appended_pages"></div>
        <button id="bu_load_next" data-next-id="2" data-book-id="21739">التالي</button>
        <a href="https://shamela.ws/book/21739/2#p1">&gt;</a>
        <a href="https://shamela.ws/book/21739/945#p1">&gt;&gt;</a>
        <input id="fld_part_top" value="1" />
        <input id="fld_goto_top" value="9" />
      </div>
    </body></html>`;
}

describe("Shamela open-page parser", () => {
  test("parses the retained root index without changing its container", async () => {
    const html = await Bun.file(
      new URL("./fixtures/shamela-23833-betaka-index.html", import.meta.url),
    ).text();
    const toc = extractShamelaTocTree(html);
    const flatten = (nodes: typeof toc.nodes): typeof toc.nodes =>
      nodes.flatMap((node) => [node, ...flatten(node.children)]);
    expect(toc.complete).toBe(true);
    expect(toc.nodes).toHaveLength(222);
    expect(flatten(toc.nodes)).toHaveLength(2405);
    expect(Math.max(...flatten(toc.nodes).map((node) => node.depth))).toBe(4);
  });

  test("reads hidden children and prefers the book-root index over the sidebar", () => {
    const toc =
      extractShamelaTocTree(`<div class="s-nav"><ul><li><a href="/book/21739/1">Sidebar</a></li></ul></div>
      <div class="betaka-index"><ul><li><a class="exp_bu" data-id="5" href="javascript:;">+</a><a href="/book/21739/5">Parent</a>
      <ul style="display: none;"><li><a href="/book/21739/7">Child</a></li></ul></li></ul></div>`);
    expect(toc.complete).toBe(true);
    expect(toc.nodes[0]?.title).toBe("Parent");
    expect(toc.nodes[0]?.children[0]?.parentTreePath).toBe("5");
  });

  test("does not mistake missing or empty lazy branches for success", () => {
    expect(extractShamelaTocTree("<html>Verification</html>").complete).toBe(
      false,
    );
    for (const children of ["", "<ul style='display:none'></ul>"]) {
      const toc = extractShamelaTocTree(
        `<div class="betaka-index"><ul><li><a class="exp_bu" data-id="5" href="javascript:;">+</a><a href="/book/21739/5">Parent</a>${children}</li></ul></div>`,
      );
      expect(toc.complete).toBe(false);
      expect(toc.unexpandedNodeIds).toEqual(["5"]);
    }
  });
  test("hydrates every lazy Shamela chapter branch before parsing", async () => {
    const requested: string[] = [];
    const html = await hydrateShamelaTocHtml({
      html: pageHtml(`
        <li>
          <a href="javascript:;" data-id="2" data-book-id="21739" class="exp_bu">[+]</a>
          <a href="/book/21739/5">كتاب الطهارة</a>
        </li>`),
      fetchChildren: async ({ nodeId }) => {
        requested.push(nodeId);
        return nodeId === "2"
          ? `<ul><li><a href="javascript:;" data-id="3" data-book-id="21739" class="exp_bu">[+]</a><a href="/book/21739/5">كتاب الوضوء</a></li></ul>`
          : `<ul><li>-<a href="/book/21739/7">الباب الثاني</a></li></ul>`;
      },
    });

    const parsed = parseShamelaOpenPage({
      html,
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
    });
    expect(requested).toEqual(["2", "3"]);
    expect(parsed.facts.toc.complete).toBe(true);
    expect(parsed.facts.toc.linkCount).toBe(3);
    expect(parsed.facts.toc.nodes[0]?.title).toBe("كتاب الطهارة");
  });

  test("preserves an arbitrarily deep expanded chapter tree", () => {
    const parsed = parseShamelaOpenPage({
      html: pageHtml(`
        <li>
          <a href="javascript:;" data-id="2" data-book-id="21739" class="exp_bu">[+]</a>
          <a href="/book/21739/5">كتاب الطهارة</a>
          <ul><li>
            <a href="javascript:;" data-id="3" data-book-id="21739" class="exp_bu">[+]</a>
            <a href="/book/21739/5">كتاب الوضوء</a>
            <ul><li>-<a href="/book/21739/7">الباب الثاني</a></li></ul>
          </li></ul>
        </li>`),
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
    });

    expect(parsed.facts.toc.complete).toBe(true);
    expect(parsed.facts.toc.topLevelCount).toBe(1);
    expect(parsed.facts.toc.linkCount).toBe(3);
    expect(parsed.facts.toc.nodes[0]).toMatchObject({
      kind: "section",
      title: "كتاب الطهارة",
      sourceNodeId: "2",
      treePath: "2",
      children: [
        {
          kind: "chapter",
          title: "كتاب الوضوء",
          sourceNodeId: "3",
          treePath: "2.3",
          children: [
            {
              kind: "topic",
              title: "الباب الثاني",
              shamelaPageNo: 7,
              treePath: "2.3.page-7-1",
            },
          ],
        },
      ],
    });
  });

  test("reports a collapsed expandable branch as incomplete", () => {
    const parsed = parseShamelaOpenPage({
      html: pageHtml(`
        <li>
          <a href="javascript:;" data-id="2" data-book-id="21739" class="exp_bu">[+]</a>
          <a href="/book/21739/5">كتاب الطهارة</a>
        </li>`),
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
    });

    expect(parsed.facts.toc.complete).toBe(false);
    expect(parsed.facts.toc.unexpandedNodeIds).toEqual(["2"]);
  });

  test("extracts adjacent links and source-colored text ranges", () => {
    const parsed = parseShamelaOpenPage({
      html: pageHtml('<li>-<a href="/book/21739/1">مقدمة المؤلف</a></li>'),
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
    });

    expect(parsed.document.meta).toMatchObject({
      shamelaPageNo: 1,
      printedPageNo: 9,
      volumeNumber: 1,
      previousShamelaPageNo: null,
      nextShamelaPageNo: 2,
    });
    const paragraph = parsed.document.content.find(
      (block) => block.type === "paragraph",
    );
    expect(paragraph).toMatchObject({
      type: "paragraph",
      marks: [
        {
          type: "style",
          kind: "c5",
          start: 21,
          end: 38,
        },
      ],
    });
  });

  test("decodes decimal and hexadecimal entities returned to server imports", () => {
    const parsed = parseShamelaOpenPage({
      html: pageHtml(
        '<li>-<a href="/book/21739/1">&#x645;&#x642;&#x62F;&#x645;&#x629;</a></li>',
      ).replace("مقدمة طويلة", "&#1605;&#1602;&#1583;&#1605;&#1577; طويلة"),
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
    });

    expect(parsed.facts.toc.nodes[0]?.title).toBe("مقدمة");
    expect(
      parsed.document.content.find((block) => block.type === "paragraph"),
    ).toMatchObject({ text: expect.stringContaining("مقدمة طويلة") });
  });
});
