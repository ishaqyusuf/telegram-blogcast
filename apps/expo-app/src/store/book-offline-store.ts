import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DownloadedBookMeta = {
  bookId: number;
  contentHash: string | null;
  downloadedAt: number;  // ms timestamp
  lastSyncedAt: number;  // ms timestamp
};

export type BookmarkEntry = {
  pageId: number;
  bookId: number;
  chapterTitle: string | null;
  pageNo: number | null;
  createdAt: number; // ms timestamp
};

type BookOfflineState = {
  downloadedBooks: Record<number, DownloadedBookMeta>;
  downloadProgress: Record<number, number>; // bookId → 0-1

  // Reading progress: bookId → last-read pageId
  readingProgress: Record<number, number>;

  // Bookmarks: bookId → list of entries
  bookmarks: Record<number, BookmarkEntry[]>;

  // ── Download actions ─────────────────────────────────────────────────────
  setDownloaded: (meta: DownloadedBookMeta) => void;
  removeDownloaded: (bookId: number) => void;
  isDownloaded: (bookId: number) => boolean;
  getBookMeta: (bookId: number) => DownloadedBookMeta | undefined;
  setDownloadProgress: (bookId: number, progress: number) => void;
  clearDownloadProgress: (bookId: number) => void;
  updateSyncedAt: (bookId: number, contentHash: string | null) => void;

  // ── Reading progress actions ──────────────────────────────────────────────
  setLastPage: (bookId: number, pageId: number) => void;
  getLastPage: (bookId: number) => number | null;
  clearLastPage: (bookId: number) => void;

  // ── Bookmark actions ──────────────────────────────────────────────────────
  addBookmark: (entry: BookmarkEntry) => void;
  removeBookmark: (bookId: number, pageId: number) => void;
  isBookmarked: (bookId: number, pageId: number) => boolean;
  getBookmarks: (bookId: number) => BookmarkEntry[];
};

export const useBookOfflineStore = create<BookOfflineState>()(
  persist(
    (set, get) => ({
      downloadedBooks: {},
      downloadProgress: {},
      readingProgress: {},
      bookmarks: {},

      // ── Download ────────────────────────────────────────────────────────────
      setDownloaded: (meta) =>
        set((s) => ({
          downloadedBooks: { ...s.downloadedBooks, [meta.bookId]: meta },
        })),

      removeDownloaded: (bookId) =>
        set((s) => {
          const { [bookId]: _, ...rest } = s.downloadedBooks;
          return { downloadedBooks: rest };
        }),

      isDownloaded: (bookId) => bookId in get().downloadedBooks,

      getBookMeta: (bookId) => get().downloadedBooks[bookId],

      setDownloadProgress: (bookId, progress) =>
        set((s) => ({
          downloadProgress: { ...s.downloadProgress, [bookId]: progress },
        })),

      clearDownloadProgress: (bookId) =>
        set((s) => {
          const { [bookId]: _, ...rest } = s.downloadProgress;
          return { downloadProgress: rest };
        }),

      updateSyncedAt: (bookId, contentHash) =>
        set((s) => {
          const existing = s.downloadedBooks[bookId];
          if (!existing) return s;
          return {
            downloadedBooks: {
              ...s.downloadedBooks,
              [bookId]: { ...existing, contentHash, lastSyncedAt: Date.now() },
            },
          };
        }),

      // ── Reading progress ────────────────────────────────────────────────────
      setLastPage: (bookId, pageId) =>
        set((s) => ({
          readingProgress: { ...s.readingProgress, [bookId]: pageId },
        })),

      getLastPage: (bookId) => get().readingProgress[bookId] ?? null,

      clearLastPage: (bookId) =>
        set((s) => {
          const { [bookId]: _, ...rest } = s.readingProgress;
          return { readingProgress: rest };
        }),

      // ── Bookmarks ───────────────────────────────────────────────────────────
      addBookmark: (entry) =>
        set((s) => {
          const current = s.bookmarks[entry.bookId] ?? [];
          // Prevent duplicates
          if (current.some((b) => b.pageId === entry.pageId)) return s;
          return {
            bookmarks: {
              ...s.bookmarks,
              [entry.bookId]: [entry, ...current],
            },
          };
        }),

      removeBookmark: (bookId, pageId) =>
        set((s) => ({
          bookmarks: {
            ...s.bookmarks,
            [bookId]: (s.bookmarks[bookId] ?? []).filter((b) => b.pageId !== pageId),
          },
        })),

      isBookmarked: (bookId, pageId) =>
        (get().bookmarks[bookId] ?? []).some((b) => b.pageId === pageId),

      getBookmarks: (bookId) => get().bookmarks[bookId] ?? [],
    }),
    {
      name: "book-offline-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        downloadedBooks: s.downloadedBooks,
        readingProgress: s.readingProgress,
        bookmarks: s.bookmarks,
      }),
    }
  )
);
