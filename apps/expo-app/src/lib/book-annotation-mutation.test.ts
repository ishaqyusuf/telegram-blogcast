import { expect, test } from "bun:test";
import { commitAnnotationMutation } from "./book-annotation-mutation";

test("a committed annotation is successful even if its UI refresh fails", async () => {
  let writes = 0;
  let reported = 0;
  const result = await commitAnnotationMutation(
    async () => { writes++; return "saved-id"; },
    async () => { throw new Error("refresh unavailable"); },
    () => { reported++; },
  );
  expect(result).toBe("saved-id");
  expect(writes).toBe(1);
  expect(reported).toBe(1);
});

test("a failed write remains retryable and never runs post-commit work", async () => {
  let refreshed = false;
  await expect(commitAnnotationMutation(
    async () => { throw new Error("disk full"); },
    async () => { refreshed = true; },
    () => {},
  )).rejects.toThrow("disk full");
  expect(refreshed).toBe(false);
});

test("successful refresh preserves the committed result", async () => {
  const stages: string[] = [];
  expect(await commitAnnotationMutation(
    async () => { stages.push("write"); return 7; },
    async () => { stages.push("refresh"); },
    () => { stages.push("failure"); },
  )).toBe(7);
  expect(stages).toEqual(["write", "refresh"]);
});
