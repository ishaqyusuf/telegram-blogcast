import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStore } from "zustand";
import { useAuthContext } from "@/hooks/use-auth";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { createBookOfflineStore, type BookOfflineState } from "./book-offline-state";

export type { BookmarkEntry, DownloadedBookMeta } from "./book-offline-state";

const stores = new Map<string, ReturnType<typeof createBookOfflineStore>>();

export function useBookOfflineStore<T>(selector: (state: BookOfflineState) => T): T {
  const { profile } = useAuthContext();
  const scope = bookCacheScopeForUser(profile?.user?.id);
  let store = stores.get(scope);
  if (!store) {
    store = createBookOfflineStore(AsyncStorage, scope);
    stores.set(scope, store);
  }
  return useStore(store, selector);
}
