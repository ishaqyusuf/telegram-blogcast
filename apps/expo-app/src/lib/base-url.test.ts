import { describe, expect, mock, test } from "bun:test";

mock.module("expo-constants", () => ({
  default: {
    expoConfig: {},
  },
}));

const { normalizeTrpcUrl, resolveLocalNetworkHost } = await import("./base-url");

describe("resolveLocalNetworkHost", () => {
  test("prefers an explicit network host over Expo's loopback host", () => {
    expect(
      resolveLocalNetworkHost({
        debuggerHost: "127.0.0.1:8081",
        explicitLocalHost: "10.152.136.73",
        urlCandidates: [],
      }),
    ).toBe("10.152.136.73");
  });

  test("falls back from Expo's loopback host to a LAN URL", () => {
    expect(
      resolveLocalNetworkHost({
        debuggerHost: "127.0.0.1:8081",
        urlCandidates: ["http://10.152.136.73:3501/api/trpc"],
      }),
    ).toBe("10.152.136.73");
  });

  test("keeps loopback when no LAN address is configured", () => {
    expect(
      resolveLocalNetworkHost({
        debuggerHost: "127.0.0.1:8081",
        urlCandidates: [],
      }),
    ).toBe("127.0.0.1");
  });
});

describe("normalizeTrpcUrl", () => {
  test("accepts either the production origin, API root, or full tRPC URL", () => {
    expect(normalizeTrpcUrl("https://alghurobaa.vercel.app")).toBe(
      "https://alghurobaa.vercel.app/api/trpc",
    );
    expect(normalizeTrpcUrl("https://alghurobaa.vercel.app/api")).toBe(
      "https://alghurobaa.vercel.app/api/trpc",
    );
    expect(
      normalizeTrpcUrl("https://alghurobaa.vercel.app/api/api/trpc"),
    ).toBe("https://alghurobaa.vercel.app/api/trpc");
  });
});
