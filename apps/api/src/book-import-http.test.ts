import { describe, expect, spyOn, test } from "bun:test";
import { app } from "./index";

describe("chapter import HTTP ownership", () => {
  for (const token of [undefined, "invalid", "ab".repeat(32)]) {
    test(`routes ${token?.length === 64 ? "valid" : "missing or invalid"} capabilities through the live context`, async () => {
      const log = spyOn(console, "log").mockImplementation(() => {});
      try {
        // Invalid input stops before database access, after capability authorization.
        const response = await app.request("/api/trpc/bookChapter.capture", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer test-private-authorization",
            cookie: "session=test-private-cookie",
            ...(token ? { "x-book-import-token": token } : {}),
          },
          body: JSON.stringify({ json: {} }),
        });
        expect(response.status).toBe(token?.length === 64 ? 400 : 401);
        const body = await response.json();
        expect(body).toMatchObject({
          error: { json: { data: {
            code: token?.length === 64 ? "BAD_REQUEST" : "UNAUTHORIZED",
          } } },
        });
        expect(log).toHaveBeenCalled();
        const logs = JSON.stringify(log.mock.calls);
        if (token) expect(logs).not.toContain(token);
        expect(logs).not.toContain("test-private-authorization");
        expect(logs).not.toContain("test-private-cookie");
      } finally {
        log.mockRestore();
      }
    });
  }
});
