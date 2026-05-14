import { useCallback } from "react";

export function useBookOffline(_bookId: number) {
  const noop = useCallback(async () => {}, []);

  return {
    isDownloaded: false,
    isDownloading: false,
    hasUpdate: false,
    isOnline: true,
    progress: 0,
    download: noop,
    removeOffline: noop,
  };
}

export async function readLocalPage(_pageId: number) {
  return null;
}
