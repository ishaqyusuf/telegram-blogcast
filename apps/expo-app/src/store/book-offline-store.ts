import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DownloadedBookMeta = {
  bookId: number;
  contentHash: string | null;
  downloadedAt: number;  // ms timestamp
  lastSyncedAt: number;  // ms timestamp
};

type BookOfflineState = {
  downloadedBooks: Record<number, DownloadedBookMeta>;
  downloadProgress: Record<number, number>; // bookId → 0-1

  // Actions
  setDownloaded: (meta: DownloadedBookMeta) => void;
  removeDownloaded: (bookId: number) => void;
  isDownloaded: (bookId: number) => boolean;
  getBookMeta: (bookId: number) => DownloadedBookMeta | undefined;
  setDownloadProgress: (bookId: number, progress: number) => void;
  clearDownloadProgress: (bookId: number) => void;
  updateSyncedAt: (bookId: number, contentHash: string | null) => void;
};

export const useBookOfflineStore = create<BookOfflineState>()(
  persist(
    (set, get) => ({
      downloadedBooks: {},
      downloadProgress: {},

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
    }),
    {
      name: "book-offline-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ downloadedBooks: s.downloadedBooks }),
    }
  )
);
