import { describe, expect, test } from "bun:test";

import { toggleBookmarkedPageId } from "./bookmarks";

describe("book reader bookmarks", () => {
  test("adds a page once and removes it on the next toggle", () => {
    expect(toggleBookmarkedPageId([4, 2], 7)).toEqual([7, 4, 2]);
    expect(toggleBookmarkedPageId([7, 4, 2], 7)).toEqual([4, 2]);
  });

  test("normalizes duplicate and invalid persisted ids", () => {
    expect(toggleBookmarkedPageId([7, 7, -1, 3.5, 4], 9)).toEqual([9, 7, 4]);
  });
});
