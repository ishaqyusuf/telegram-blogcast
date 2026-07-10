import { describe, expect, test } from "bun:test";

import { getTranscriptWindow, resolveTranscriptWindowRange } from "./blog";

describe("transcript window helpers", () => {
  test("snaps an anchor to a stable transcript window", () => {
    expect(
      resolveTranscriptWindowRange({
        anchorSec: 83.4,
        windowDurationSec: 60,
      }),
    ).toEqual({
      windowDurationSec: 60,
      windowStartSec: 60,
      windowEndSec: 120,
    });
  });

  test("normalizes explicit starts to window boundaries", () => {
    expect(
      resolveTranscriptWindowRange({
        windowStartSec: 121,
        windowDurationSec: 60,
      }),
    ).toEqual({
      windowDurationSec: 60,
      windowStartSec: 120,
      windowEndSec: 180,
    });
  });

  test("clamps invalid starts and durations", () => {
    expect(
      resolveTranscriptWindowRange({
        windowStartSec: -20,
        windowDurationSec: 600,
      }),
    ).toEqual({
      windowDurationSec: 300,
      windowStartSec: 0,
      windowEndSec: 300,
    });
  });

  test("does not advertise a next cursor when no saved transcript exists", async () => {
    const result = await getTranscriptWindow(
      {
        db: {
          transcript: {
            findUnique: async () => null,
          },
        },
      } as any,
      {
        mediaId: 123,
        windowStartSec: 0,
        windowDurationSec: 60,
      },
    );

    expect(result.hasNext).toBe(false);
    expect(result.nextWindowStartSec).toBeNull();
    expect(result.hasPrevious).toBe(false);
    expect(result.previousWindowStartSec).toBeNull();
    expect(result.segments).toEqual([]);
  });
});
