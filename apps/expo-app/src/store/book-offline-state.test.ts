import { describe, expect, test } from "bun:test";
import { createBookOfflineStore } from "./book-offline-state";

function storageFixture() {
  const values = new Map<string, string>();
  return { values, storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } } };
}
const bookmark = { bookId: 3, pageId: 12, chapterTitle: "Chapter", pageNo: 106, createdAt: 100 };

describe("scoped offline book state", () => {
  test("early reader updates wait for hydration without replacing existing bookmarks", async () => {
    let finishRead!: (value: string | null) => void;
    const initial = new Promise<string | null>((resolve) => { finishRead = resolve; });
    const writes: string[] = [];
    const store = createBookOfflineStore({ getItem: () => initial, setItem: (_key, value) => { writes.push(value); }, removeItem: () => {} }, "guest");
    store.getState().setLastPage(3, 99);
    expect(writes).toHaveLength(0);
    finishRead(JSON.stringify({ state: { bookmarks: { 3: [bookmark] }, readingProgress: { 3: 12 } }, version: 0 }));
    await store.persist.rehydrate();
    expect(store.getState().getBookmarks(3)).toEqual([bookmark]);
    expect(store.getState().getLastPage(3)).toBe(99);
    expect(JSON.parse(writes.at(-1)!).state.bookmarks[3]).toEqual([bookmark]);
  });
  test("bookmarks, reading progress and previews persist without crossing profiles", async () => {
    const { storage } = storageFixture();
    const first = createBookOfflineStore(storage, "user:1");
    const second = createBookOfflineStore(storage, "user:2");
    first.getState().addBookmark(bookmark);
    first.getState().addBookmark(bookmark);
    first.getState().setLastPage(3, 12);
    first.getState().cachePageSummaries([{ bookId: 3, pageId: 12, sourcePageNo: 106, pageNo: 83, preview: "Private preview" }]);
    expect(first.getState().getBookmarks(3)).toHaveLength(1);
    expect(second.getState().getBookmarks(3)).toEqual([]);
    expect(second.getState().getLastPage(3)).toBeNull();
    expect(second.getState().savedPageSummaries).toEqual({});
    const reopened = createBookOfflineStore(storage, "user:1");
    await reopened.persist.rehydrate();
    expect(reopened.getState().getBookmarks(3)).toEqual([bookmark]);
    expect(reopened.getState().getLastPage(3)).toBe(12);
    second.getState().removeBookmark(3, 12);
    expect(reopened.getState().getBookmarks(3)).toEqual([bookmark]);
  });

  test("legacy device records remain guest-owned rather than being assigned to a signed-in profile", async () => {
    const { storage, values } = storageFixture();
    values.set("book-offline-storage", JSON.stringify({ state: { bookmarks: { 3: [bookmark] }, readingProgress: { 3: 12 }, savedPageSummaries: {}, downloadedBooks: {} }, version: 0 }));
    const signedIn = createBookOfflineStore(storage, "user:1");
    const guest = createBookOfflineStore(storage, "guest");
    await guest.persist.rehydrate();
    expect(guest.getState().getBookmarks(3)).toEqual([bookmark]);
    expect(signedIn.getState().getBookmarks(3)).toEqual([]);
    signedIn.getState().setLastPage(3, 99);
    expect(guest.getState().getLastPage(3)).toBe(12);
    expect(values.has("book-offline-storage")).toBe(true);
  });
});
