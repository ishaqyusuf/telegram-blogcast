import { expect, test } from "bun:test";
import { canExportBookContent } from "./book-content-policy";

test("only published read-only Shamela content is eligible for portable mirrors", () => {
  const published = { sourceType: "shamela", shamelaId: 23833, editable: false, ownerUserId: 1, blog: { published: true } };
  expect(canExportBookContent(published)).toBe(true);
  expect(canExportBookContent({ ...published, blog: { published: false } })).toBe(false);
  expect(canExportBookContent({ ...published, blog: null })).toBe(false);
  expect(canExportBookContent({ ...published, sourceType: "user" })).toBe(false);
  expect(canExportBookContent({ ...published, editable: true })).toBe(false);
  expect(canExportBookContent({ ...published, shamelaId: null })).toBe(false);
});
