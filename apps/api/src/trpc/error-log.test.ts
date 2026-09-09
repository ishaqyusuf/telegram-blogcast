import { expect, test } from "bun:test";
import { trpcErrorLogDetails } from "./error-log";

test("private annotation errors do not expose notes in inputs, URLs or database exceptions", () => {
  const secret = "private passage and comment";
  const error = { message: secret, code: "INTERNAL_SERVER_ERROR", name: "Error", stack: secret };
  const result = trpcErrorLogDetails({ path: "bookAnnotation.sync", input: { note: secret }, url: `https://api.test/api/trpc/bookAnnotation.sync?input=${secret}`, error });
  expect(JSON.stringify(result)).not.toContain(secret);
  expect(result.input).toBe("[REDACTED]");
  expect(result.errorMessage).toContain("INTERNAL_SERVER_ERROR");
});

test("private batch URLs are redacted even when the route could not be resolved", () => {
  const result = trpcErrorLogDetails({ input: "private", url: "https://api.test/api/trpc/book.getPage,bookAnnotation.sync?input=private", error: { message: "private", code: "BAD_REQUEST", name: "Error" } });
  expect(JSON.stringify(result)).not.toContain("private");
  expect(result.input).toBe("[REDACTED]");
});

test("unrelated route diagnostics retain their existing shape", () => {
  const error = { message: "missing page", code: "NOT_FOUND", name: "Error", stack: "trace" };
  expect(trpcErrorLogDetails({ path: "book.getPage", input: { pageId: 170 }, url: "https://api.test/api/trpc/book.getPage", error })).toEqual({ input: { pageId: 170 }, url: "https://api.test/api/trpc/book.getPage", errorMessage: ["missing page", "NOT_FOUND", "Error", "trace"] });
});
