import { describe, expect, test } from "bun:test";

import { resolveBookTextSegments } from "./reader";

describe("book reader text segments", () => {
  test("keeps Shamela foreground color underneath a user highlight", () => {
    expect(
      resolveBookTextSegments({
        text: "abcdef",
        sourceMarks: [{ kind: "c5", start: 1, end: 5 }],
        highlights: [{ start: 3, end: 6, color: "#facc15" }],
      }),
    ).toEqual([
      {
        start: 0,
        end: 1,
        text: "a",
        foregroundColor: null,
        backgroundColor: null,
      },
      {
        start: 1,
        end: 3,
        text: "bc",
        foregroundColor: "#005c81",
        backgroundColor: null,
      },
      {
        start: 3,
        end: 5,
        text: "de",
        foregroundColor: "#005c81",
        backgroundColor: "#facc15",
      },
      {
        start: 5,
        end: 6,
        text: "f",
        foregroundColor: null,
        backgroundColor: "#facc15",
      },
    ]);
  });

  test("ignores invalid source and highlight ranges", () => {
    expect(
      resolveBookTextSegments({
        text: "abc",
        sourceMarks: [{ kind: "c5", start: -1, end: 9 }],
        highlights: [{ start: 2, end: 2, color: "#fff" }],
      }),
    ).toEqual([
      {
        start: 0,
        end: 3,
        text: "abc",
        foregroundColor: null,
        backgroundColor: null,
      },
    ]);
  });
});
