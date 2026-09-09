import { expect, test } from "bun:test";
import { failedBookDraftState } from "./book-draft-state";

const draft = { bookId: 3, pageId: 12, contentJson: "{}", contentHtml: null, plainText: "Private draft", baseVersion: 1, updatedAt: 100 };

test("failed draft loads cannot expose the previous profile or page", () => {
  const state = { key: "guest:3:12", draft, ready: true };
  for (const key of ["user:2:3:12", "guest:3:13"]) {
    expect(failedBookDraftState(state, key, "read failed")).toEqual({ key, draft: null, ready: false, error: "read failed" });
  }
});

test("a failed reload preserves an already visible draft for the same profile and page", () => {
  const key = "guest:3:12";
  expect(failedBookDraftState({ key, draft, ready: true }, key, "read failed")).toEqual({ key, draft, ready: false, error: "read failed" });
});
