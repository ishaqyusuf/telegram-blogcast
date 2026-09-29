import { describe, expect, test } from "bun:test";
import { getAudioDisplayTitle } from "./audio-title";

describe("audio display title", () => {
  test("a renamed title replaces the caption and source filename", () => {
    expect(getAudioDisplayTitle({
      content: "Original caption",
      audio: { titleOverride: "New name", fileName: "original.mp3" },
    })).toBe("New name");
  });

  test("clearing the override restores the existing fallback", () => {
    expect(getAudioDisplayTitle({
      content: "Original caption",
      audio: { titleOverride: null, fileName: "original.mp3" },
    })).toBe("Original caption - original.mp3");
  });
});
