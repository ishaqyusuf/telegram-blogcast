import { describe, expect, test } from "bun:test";

const modalSource = await Bun.file(`${import.meta.dir}/modal.tsx`).text();
const floatingSheetSource = await Bun.file(
  `${import.meta.dir}/floating-bottom-sheet.tsx`,
).text();
const footnotesSheetSource = await Bun.file(
  `${import.meta.dir}/../book/footnotes-sheet.tsx`,
).text();
const globalAudioBarSource = await Bun.file(
  `${import.meta.dir}/../global-audio-bar/index.tsx`,
).text();

describe("bottom-sheet player layering", () => {
  test("registers every bottom-sheet primitive with the shared suppression lifecycle", () => {
    for (const source of [
      modalSource,
      floatingSheetSource,
      footnotesSheetSource,
    ]) {
      expect(source).toContain("useFloatingBottomSheetRegistration");
      expect(source).toContain("markSheetPresented");
      expect(source).toContain("markSheetDismissed");
    }
  });

  test("keeps the global audio bar hidden while a sheet is registered", () => {
    expect(globalAudioBarSource).toContain("hasOpenFloatingSheet");
    expect(globalAudioBarSource).toContain("!hasOpenFloatingSheet");
  });
});
