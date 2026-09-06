import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../screens/book-fetch-browser-screen.tsx", import.meta.url),
  "utf8",
);
const script = source.match(/const EXPAND_TOC_SCRIPT = `([\s\S]*?)`;/)![1]!;

async function expand(
  mode: "loaded" | "nested" | "missing" | "timeout" | "limit",
) {
  const messages: any[] = [];
  let clicks = 0;
  const buttons: any[] = [];
  const list = { tagName: "UL", querySelector: () => ({}) };
  const addButton = () => {
    const button = {
      dataset: { id: String(buttons.length) },
      parentElement: { children: [] as any[] },
      click: () => {
        clicks++;
        if (mode === "timeout") return;
        button.parentElement.children.push(list);
        if ((mode === "nested" && clicks === 1) || mode === "limit")
          addButton();
      },
    };
    buttons.push(button);
    return button;
  };
  const first = addButton();
  if (mode === "loaded") first.parentElement.children.push(list);
  const index = { querySelector: () => ({}), querySelectorAll: () => buttons };
  let clock = 0;
  const window = {
    ReactNativeWebView: {
      postMessage: (value: string) => messages.push(JSON.parse(value)),
    },
  };
  runInNewContext(script, {
    window,
    document: { querySelector: () => (mode === "missing" ? null : index) },
    Date: { now: () => (clock += 13000) },
    setInterval: (callback: () => void) => {
      queueMicrotask(callback);
      return 1;
    },
    clearInterval: () => {},
  });
  // Allow the injected asynchronous branch loop to settle.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { messages, clicks, window };
}

test("chapter capture expands newly discovered descendants exactly once", async () => {
  const result = await expand("nested");
  expect(result.clicks).toBe(2);
  expect(result.messages.at(-1)).toMatchObject({
    type: "toc-complete",
    remaining: 0,
  });
});

test("already-loaded hidden lists are not clicked again", async () => {
  const result = await expand("loaded");
  expect(result.clicks).toBe(0);
  expect(result.messages.at(-1).type).toBe("toc-complete");
});

for (const mode of ["missing", "timeout", "limit"] as const) {
  test(`${mode} never reports chapter success and releases the expansion lock`, async () => {
    const result = await expand(mode);
    expect(result.messages.at(-1).type).toBe("toc-error");
    expect(
      result.messages.some((message) => message.type === "toc-complete"),
    ).toBe(false);
    expect((result.window as any).__alGhurobaaTocExpanding).toBe(false);
  });
}

test("the capture screen never combines style and className", () => {
  const file = ts.createSourceFile(
    "capture.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const mixed: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const names = node.attributes.properties
        .filter(ts.isJsxAttribute)
        .map((attribute) => attribute.name.getText(file));
      if (names.includes("style") && names.includes("className"))
        mixed.push(node.tagName.getText(file));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  expect(mixed).toEqual([]);
});
