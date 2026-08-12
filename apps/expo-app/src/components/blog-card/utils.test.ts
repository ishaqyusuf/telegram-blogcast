import { describe, expect, test } from "bun:test";

import {
  getBlogHref,
  getBlogPresentationType,
  getPrimaryImageSource,
} from "./media-card-behavior";

describe("blog card media behavior", () => {
  test("preserves video classification when opening a legacy media post", () => {
    expect(getBlogHref({ id: 17, type: "video" } as any)).toBe(
      "/blog-view/17?contentType=video",
    );
  });

  test("presents a generic preview-only Facebook post as readable text", () => {
    const post = {
      id: 20,
      type: "video",
      sourceUrl:
        "https://www.facebook.com/permalink.php?story_fbid=123&id=456",
      caption: "A long saved post caption",
      externalMedia: {
        externalUrl:
          "https://www.facebook.com/permalink.php?story_fbid=123&id=456",
      },
      video: null,
    } as any;

    expect(getBlogPresentationType(post)).toBe("text");
    expect(getBlogHref(post)).toBe("/blog-view-text/20");
  });

  test("keeps an explicit Facebook reel in video mode", () => {
    const post = {
      id: 21,
      type: "video",
      sourceUrl: "https://www.facebook.com/reel/123/",
      caption: "Video caption",
      externalMedia: { externalUrl: "https://www.facebook.com/reel/123/" },
      video: null,
    } as any;

    expect(getBlogPresentationType(post)).toBe("video");
    expect(getBlogHref(post)).toBe("/blog-view/21?contentType=video");
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
