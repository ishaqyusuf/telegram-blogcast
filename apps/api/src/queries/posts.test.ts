import { describe, expect, test } from "bun:test";

import { isVisibleMainBlogRecord } from "./posts";

describe("post visibility", () => {
  test("excludes Facebook posts without Telegram media", () => {
    expect(
      isVisibleMainBlogRecord({
        source: "facebook",
        medias: [],
      }),
    ).toBe(false);
  });

  test("includes Facebook posts with Telegram media", () => {
    expect(
      isVisibleMainBlogRecord({
        source: "facebook",
        medias: [{ fileId: 123, file: { fileId: "telegram-file-id" } }],
      }),
    ).toBe(true);
  });

  test("includes non-Facebook text posts", () => {
    expect(
      isVisibleMainBlogRecord({
        source: null,
        medias: [],
      }),
    ).toBe(true);
  });
});
