import { describe, expect, test } from "bun:test";
import { getAudioRenameErrorMessage } from "./audio-rename-error";

describe("audio rename errors", () => {
  test("explains a deployed API that lacks the mutation", () => {
    expect(getAudioRenameErrorMessage(new Error('No procedure found on path "blog.updateMediaTitleOverride"'))).toContain("not available on the API yet");
  });

  test("shows a useful connection error", () => {
    expect(getAudioRenameErrorMessage(new Error("Network request failed"))).toContain("Could not reach the API");
  });
});
