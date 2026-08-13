import { describe, expect, test } from "bun:test";

import { loadOptionalPdfComponent } from "../lib/optional-pdf-component";

const pdfScreenSource = await Bun.file(
  `${import.meta.dir}/../screens/pdf-blog-screen.tsx`,
).text();

describe("PDF route native boundary", () => {
  test("does not load the native PDF renderer while Expo Router discovers routes", () => {
    expect(pdfScreenSource).not.toContain('import Pdf from "react-native-pdf"');
    expect(pdfScreenSource).toContain("loadOptionalPdfComponent");
  });

  test("turns a missing native PDF module into an unavailable result", () => {
    const nativeLinkError = new TypeError("undefined is not a function");
    const result = loadOptionalPdfComponent(
      () => {
        throw nativeLinkError;
      },
      () => true,
    );

    expect(result).toEqual({ Component: null, error: nativeLinkError });
  });

  test("does not import PDF JavaScript when its native dependencies are absent", () => {
    let importCalled = false;
    const result = loadOptionalPdfComponent(
      () => {
        importCalled = true;
        return { default: (() => null) as never };
      },
      () => false,
    );

    expect(importCalled).toBe(false);
    expect(result.Component).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });
});
