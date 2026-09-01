import { describe, expect, test } from "bun:test";

import {
  getSwipeBookDirection,
  resolveAdjacentPageAction,
} from "./book-reader-navigation";

describe("book reader navigation", () => {
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
