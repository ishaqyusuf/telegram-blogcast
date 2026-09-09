import { expect, test } from "bun:test";
import { anchorBookAnnotation } from "./book-annotation-anchor";
import type { LocalDeviceAnnotation } from "./book-annotation-repository";

const row = (): LocalDeviceAnnotation => ({ localId: "highlight-1", bookId: 3, pageId: 12, revision: 2, deleted: false, dirty: true, updatedAt: 100, error: null, payload: { kind: "highlight", paragraphId: 19, paragraphPid: 1, quoteText: "passage", startOffset: 4, endOffset: 11, color: "#ff0000", note: "Private note" } });

test("reimported paragraph IDs follow a unique quoted passage without changing stored data", () => {
  const original = row();
  const rendered = anchorBookAnnotation(original, [{ id: 99, pid: 2, text: "New passage text" }]);
  expect(rendered.anchorStatus).toBe("matched");
  expect(rendered.payload).toMatchObject({ paragraphId: 99, startOffset: 4, endOffset: 11, color: "#ff0000", note: "Private note" });
  expect(original.payload.paragraphId).toBe(19);
  expect(rendered.revision).toBe(2);
  expect(rendered.dirty).toBe(true);
});
test("stable paragraph identity preserves a known range even for repeated text", () => {
  const rendered = anchorBookAnnotation(row(), [{ id: 19, pid: 1, text: "New passage and passage" }]);
  expect(rendered.anchorStatus).toBe("matched");
  expect(rendered.payload).toMatchObject({ startOffset: 4, endOffset: 11 });
});
test("ambiguous or missing quotes remain saved but do not paint unrelated text", () => {
  for (const paragraphs of [
    [{ id: 98, pid: 1, text: "passage passage" }],
    [{ id: 98, pid: 1, text: "passage" }, { id: 99, pid: 2, text: "passage" }],
    [{ id: 19, pid: 1, text: "Entirely replaced text" }],
  ]) {
    const rendered = anchorBookAnnotation(row(), paragraphs);
    expect(rendered.anchorStatus).toBe("unmatched");
    expect(rendered.payload).toMatchObject({ paragraphId: null, quoteText: "passage", color: "#ff0000", note: "Private note" });
  }
});
test("comments remain readable at page level when their paragraph disappears", () => {
  const comment: LocalDeviceAnnotation = { ...row(), payload: { kind: "comment", paragraphId: 19, paragraphPid: 1, quoteText: "passage", content: "My comment" } };
  const rendered = anchorBookAnnotation(comment, []);
  expect(rendered.payload).toMatchObject({ paragraphId: null, content: "My comment" });
  expect(anchorBookAnnotation({ ...comment, payload: { ...comment.payload, paragraphId: null, quoteText: null } }, []).anchorStatus).toBe("page");
});
