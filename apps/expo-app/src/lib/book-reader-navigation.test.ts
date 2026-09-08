import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import {
  getSwipeBookDirection,
  createReaderSwipeTracker,
  resolveAdjacentPageAction,
} from "./book-reader-navigation";

describe("book reader navigation", () => {
  test("long-press selection reserves its entire touch sequence", () => {
    const swipe = createReaderSwipeTracker();
    swipe.begin("106", 200, 100);
    swipe.blockForSelection();
    expect(swipe.finish("106", 80, 100, true, false)).toBeNull();
    swipe.begin("106", 200, 100);
    expect(swipe.finish("106", 80, 100, true, false)).toBe("next");
  });

  test("selection-handle drags cannot navigate, and cancellation does not poison the next swipe", () => {
    const swipe = createReaderSwipeTracker();
    swipe.begin("106", 200, 100, true);
    expect(swipe.finish("106", 80, 100, true, false)).toBeNull();
    swipe.begin("106", 200, 100);
    swipe.blockForSelection();
    swipe.cancel();
    swipe.begin("106", 80, 100);
    expect(swipe.finish("106", 200, 100, true, false)).toBe("previous");
  });

  test("counts full Android swipe distance rather than post-activation translation", () => {
    const swipe = createReaderSwipeTracker();
    swipe.begin("106", 200, 100);
    // 80 total points, even if the pan's translation was reset after the first 42.
    expect(swipe.finish("106", 120, 100, true, false)).toBe("next");
    expect(swipe.finish("106", 120, 100, true, false)).toBeNull();
  });

  test("rejects cancellations, failed recognition, stale routes and short swipes", () => {
    const swipe = createReaderSwipeTracker();
    swipe.begin("106", 200, 100);
    expect(swipe.finish("106", 80, 100, false, false)).toBeNull();
    swipe.begin("106", 200, 100);
    swipe.cancel();
    expect(swipe.finish("106", 80, 100, true, false)).toBeNull();
    swipe.begin("106", 200, 100);
    expect(swipe.finish("107", 80, 100, true, false)).toBeNull();
    swipe.begin("107", 200, 100);
    expect(swipe.finish("107", 160, 100, true, false)).toBeNull();
  });

  test("repeats forward capture and reverse saved-page decisions after import", () => {
    const swipe = createReaderSwipeTracker();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      swipe.begin("106", 200, 100);
      expect(swipe.finish("106", 120, 100, true, false)).toBe("next");
      expect(resolveAdjacentPageAction({ shamelaUrl: "/book/23833/107", page: null }))
        .toEqual({ type: "capture", shamelaUrl: "/book/23833/107" });
      swipe.cancel();
      // After the WebView imports 107, its reader can swipe back to fetched 106.
      swipe.begin("107", 120, 100);
      expect(swipe.finish("107", 200, 100, true, false)).toBe("previous");
      expect(resolveAdjacentPageAction({ page: { id: 170, status: "fetched" } }))
        .toEqual({ type: "reader", pageId: 170 });
      swipe.cancel();
    }
  });

  test("completed swipes keep locale-aware direction", () => {
    const swipe = createReaderSwipeTracker();
    swipe.begin("106", 120, 100);
    expect(swipe.finish("106", 200, 100, true, true)).toBe("next");
    swipe.begin("107", 200, 100);
    expect(swipe.finish("107", 120, 100, true, true)).toBe("previous");
  });

  test("rejects a horizontal-start pan that turns vertical after activation", () => {
    const swipe = createReaderSwipeTracker();
    swipe.begin("106", 200, 500);
    // Native pan already activated horizontally, so it still reports success after turning.
    expect(swipe.finish("106", 80, 800, true, false)).toBeNull();
    expect(swipe.finish("106", 80, 500, true, false)).toBeNull();
    swipe.begin("106", 200, 500);
    expect(swipe.finish("106", 80, 200, true, false)).toBeNull();
  });

  test("requires strictly greater than 1.5x horizontal dominance from touch-down", () => {
    const swipe = createReaderSwipeTracker();
    for (const verticalSign of [-1, 1]) {
      swipe.begin("106", 200, 500);
      expect(swipe.finish("106", 80, 500 + verticalSign * 80, true, false)).toBeNull();
      swipe.begin("106", 200, 500);
      expect(swipe.finish("106", 79, 500 + verticalSign * 80, true, false)).toBe("next");
      swipe.begin("106", 200, 500);
      expect(swipe.finish("106", 321, 500 + verticalSign * 80, true, true)).toBe("next");
    }
  });

  test("rejects non-finite vertical coordinates", () => {
    const swipe = createReaderSwipeTracker();
    swipe.begin("106", 200, NaN);
    expect(swipe.finish("106", 80, 100, true, false)).toBeNull();
    swipe.begin("106", 200, 100);
    expect(swipe.finish("106", 80, Infinity, true, false)).toBeNull();
  });

  test("route changes remount the detector and its native ScrollView together", () => {
    const source = readFileSync(fileURLToPath(new URL("../screens/book-reader-screen.tsx", import.meta.url)), "utf8");
    expect(source).toMatch(/<GestureDetector key=\{readerRouteKey\} gesture=\{pageSwipeGesture\}>/);
    expect(source.match(/<ScrollView\b[^>]*>/)?.[0]).not.toContain("key={readerRouteKey}");
  });

  test("uses locale-aware swipe direction", () => {
    expect(getSwipeBookDirection(-80, false)).toBe("next");
    expect(getSwipeBookDirection(80, false)).toBe("previous");
    expect(getSwipeBookDirection(80, true)).toBe("next");
    expect(getSwipeBookDirection(-80, true)).toBe("previous");
    expect(getSwipeBookDirection(20, true)).toBeNull();
  });

  test("opens fetched pages directly", () => {
    expect(
      resolveAdjacentPageAction({
        shamelaPageNo: 2,
        shamelaUrl: "/book/21739/2",
        page: { id: 92, status: "fetched", shamelaUrl: "/book/21739/2" },
      }),
    ).toEqual({ type: "reader", pageId: 92 });
  });

  test("captures a missing page from the stored adjacent link", () => {
    expect(
      resolveAdjacentPageAction({
        shamelaPageNo: 2,
        shamelaUrl: "/book/21739/2",
        page: null,
      }),
    ).toEqual({ type: "capture", shamelaUrl: "/book/21739/2" });
  });

  test("returns a boundary action when there is no adjacent link", () => {
    expect(resolveAdjacentPageAction(null)).toEqual({ type: "boundary" });
  });
});
