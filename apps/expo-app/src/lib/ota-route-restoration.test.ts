import { describe, expect, test } from "bun:test";

import {
  OTA_ROUTE_SNAPSHOT_MAX_LENGTH,
  OTA_ROUTE_SNAPSHOT_MAX_AGE_MS,
  areOtaRoutesEqual,
  createPendingOtaRouteSnapshot,
  fingerprintOtaLaunchUrl,
  getRestorableRouteFromNavigationState,
  hasNewExternalLaunchUrl,
  hasOtaUpdateIdentityChanged,
  normalizeOtaRouteParams,
  parsePendingOtaRouteSnapshot,
  runOtaUpdateReload,
} from "./ota-route-restoration";

describe("OTA route restoration", () => {
  test("captures the focused dynamic route and serializable parameters", () => {
    expect(
      getRestorableRouteFromNavigationState({
        index: 1,
        routes: [
          { name: "home" },
          {
            name: "albums/[albumId]",
            params: {
              albumId: 42,
              tab: "books",
              selected: [1, "2"],
              ignored: { nested: true },
            },
          },
        ],
      }),
    ).toEqual({
      pathname: "/albums/[albumId]",
      params: {
        albumId: "42",
        tab: "books",
        selected: ["1", "2"],
      },
    });
  });

  test("falls back from a transient route to the previous stable screen", () => {
    for (const transientRoute of [
      "blog-form",
      "blog-import",
      "facebook-import",
      "book-fetch",
      "book-fetch-browser",
      "book-fetch-preview",
      "books/library/new",
      "books/library/[itemId]/edit",
      "blog-image-view",
    ]) {
      expect(
        getRestorableRouteFromNavigationState({
          index: 2,
          routes: [
            { name: "home" },
            {
              name: "blog-view-text/[blogId]/index",
              params: { blogId: "7" },
            },
            { name: transientRoute, params: { draft: "unsaved" } },
          ],
        }),
      ).toEqual({
        pathname: "/blog-view-text/[blogId]",
        params: { blogId: "7" },
      });
    }
  });

  test("finds the focused leaf inside nested navigation state", () => {
    expect(
      getRestorableRouteFromNavigationState({
        index: 0,
        routes: [
          {
            name: "(root)",
            state: {
              index: 1,
              routes: [
                { name: "home" },
                { name: "books/[bookId]", params: { bookId: "12" } },
              ],
            },
          },
        ],
      }),
    ).toEqual({
      pathname: "/books/[bookId]",
      params: { bookId: "12" },
    });
  });

  test("allows stable chapter routes", () => {
    expect(
      getRestorableRouteFromNavigationState({
        routes: [
          {
            name: "books/[bookId]/chapters",
            params: { bookId: "12" },
          },
        ],
      }),
    ).toEqual({
      pathname: "/books/[bookId]/chapters",
      params: { bookId: "12" },
    });
  });

  test("normalizes only JSON-safe route parameter values", () => {
    expect(
      normalizeOtaRouteParams({
        string: "value",
        number: 5,
        boolean: false,
        array: ["one", 2, true, null, { ignored: true }],
        accessToken: "do-not-save",
        nullValue: null,
      }),
    ).toEqual({
      string: "value",
      number: "5",
      boolean: "false",
      array: ["one", "2", "true"],
    });
  });

  test("accepts a recent versioned snapshot and rejects stale data", () => {
    const now = 1_000_000;
    const snapshot = createPendingOtaRouteSnapshot({
      route: { pathname: "/albums/[albumId]", params: { albumId: "42" } },
      identity: { updateId: "old-update", isEmbeddedLaunch: false },
      reloadSource: "automatic",
      initialUrl: "alghurobaa://albums/42?token=never-store-this",
      capturedAt: now,
    });

    expect(JSON.stringify(snapshot)).not.toContain("never-store-this");
    expect(snapshot.sourceInitialUrlFingerprint).toBe(
      fingerprintOtaLaunchUrl(
        "alghurobaa://albums/42?token=never-store-this",
      ),
    );
    expect(parsePendingOtaRouteSnapshot(JSON.stringify(snapshot), now)).toEqual(
      snapshot,
    );
    expect(
      parsePendingOtaRouteSnapshot(
        JSON.stringify(snapshot),
        now + OTA_ROUTE_SNAPSHOT_MAX_AGE_MS + 1,
      ),
    ).toBeNull();
    expect(parsePendingOtaRouteSnapshot("not-json", now)).toBeNull();
    expect(
      parsePendingOtaRouteSnapshot(
        JSON.stringify({
          ...snapshot,
          route: { pathname: "/removed-by-update", params: {} },
        }),
        now,
      ),
    ).toBeNull();
    expect(
      parsePendingOtaRouteSnapshot(
        JSON.stringify({
          ...snapshot,
          padding: "x".repeat(OTA_ROUTE_SNAPSHOT_MAX_LENGTH),
        }),
        now,
      ),
    ).toBeNull();
  });

  test("restores only after the running update identity changes", () => {
    const snapshot = createPendingOtaRouteSnapshot({
      route: { pathname: "/settings", params: {} },
      identity: { updateId: "old-update", isEmbeddedLaunch: false },
      reloadSource: "manual",
    });

    expect(
      hasOtaUpdateIdentityChanged(snapshot, {
        updateId: "old-update",
        isEmbeddedLaunch: false,
      }),
    ).toBe(false);
    expect(
      hasOtaUpdateIdentityChanged(snapshot, {
        updateId: "new-update",
        isEmbeddedLaunch: false,
      }),
    ).toBe(true);
    expect(
      hasOtaUpdateIdentityChanged(snapshot, {
        updateId: null,
        isEmbeddedLaunch: true,
      }),
    ).toBe(true);
  });

  test("lets a new external launch URL take precedence after reload", () => {
    const snapshot = createPendingOtaRouteSnapshot({
      route: { pathname: "/albums/[albumId]", params: { albumId: "42" } },
      identity: { updateId: "old-update", isEmbeddedLaunch: false },
      reloadSource: "automatic",
      initialUrl: "alghurobaa://albums/42",
    });

    expect(
      hasNewExternalLaunchUrl(snapshot, "alghurobaa://albums/42"),
    ).toBe(false);
    expect(hasNewExternalLaunchUrl(snapshot, null)).toBe(false);
    expect(
      hasNewExternalLaunchUrl(snapshot, "alghurobaa://books/9"),
    ).toBe(true);
    expect(
      hasNewExternalLaunchUrl(
        snapshot,
        "alghurobaa://albums/42",
        true,
      ),
    ).toBe(true);
  });

  test("compares parameter order safely", () => {
    expect(
      areOtaRoutesEqual(
        { pathname: "/search", params: { q: "audio", type: "blog" } },
        { pathname: "/search", params: { type: "blog", q: "audio" } },
      ),
    ).toBe(true);
  });

  test("clears a failed capture before reloading without restoration", async () => {
    const calls: string[] = [];

    await runOtaUpdateReload({
      prepare: async () => {
        calls.push("prepare");
        throw new Error("storage unavailable");
      },
      clear: async () => {
        calls.push("clear");
      },
      reload: async () => {
        calls.push("reload");
      },
    });

    expect(calls).toEqual(["prepare", "clear", "reload"]);
  });

  test("clears the pending marker when reload fails", async () => {
    const calls: string[] = [];
    const reloadError = new Error("reload failed");

    await expect(
      runOtaUpdateReload({
        prepare: async () => {
          calls.push("prepare");
        },
        clear: async () => {
          calls.push("clear");
        },
        reload: async () => {
          calls.push("reload");
          throw reloadError;
        },
      }),
    ).rejects.toBe(reloadError);
    expect(calls).toEqual(["prepare", "reload", "clear"]);
  });
});
