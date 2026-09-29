import { describe, expect, test } from "bun:test";
import { getAudioRenameErrorMessage } from "./audio-rename-error";

describe("audio rename errors", () => {
  test("explains a deployed API that lacks the mutation", () => {
    expect(getAudioRenameErrorMessage(new Error('No procedure found on path "blog.updateMediaTitleOverride"'))).toContain("not available on the API yet");
  });

  test("shows a useful connection error", () => {
    expect(getAudioRenameErrorMessage(new Error("Network request failed"))).toContain("Could not reach the API");
  });

  test("does not expose database diagnostics in the form", () => {
    const text = getAudioRenameErrorMessage(new Error("Invalid prisma.media.update() invocation: Unknown argument titleOverride"));
    expect(text).toContain("Could not save the new name");
    expect(text).not.toContain("prisma");
  });
});
