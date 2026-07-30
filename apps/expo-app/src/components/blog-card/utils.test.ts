import { describe, expect, test } from "bun:test";

import {
  getBlogHref,
  getPrimaryImageSource,
} from "./media-card-behavior";

describe("blog card media behavior", () => {
  test("preserves video classification when opening a legacy media post", () => {
    expect(getBlogHref({ id: 17, type: "video" } as any)).toBe(
      "/blog-view/17?contentType=video",
    );
  });

  test("preserves PDF classification when opening a legacy document post", () => {
    expect(getBlogHref({ id: 18, type: "pdf" } as any)).toBe(
      "/blog-view/18?contentType=pdf",
    );
  });

  test("uses an external video's Telegram thumbnail metadata", () => {
    const imageSource = getPrimaryImageSource({
      id: 19,
      type: "video",
      externalMedia: { thumbnailFileId: "video-thumb-file-id" },
    } as any);

    expect(imageSource.telegramFileId).toBe("video-thumb-file-id");
  });
});
