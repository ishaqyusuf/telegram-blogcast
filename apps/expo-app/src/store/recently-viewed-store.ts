import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface RecentlyViewedItem {
  id: number;
  title: string;
  type: string;
  date: string | null;
}

interface RecentlyViewedStore {
  items: RecentlyViewedItem[];
  markViewed: (item: RecentlyViewedItem) => void;
  clear: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set) => ({
      items: [],
      markViewed: (item) =>
        set((state) => ({
          items: [
            item,
            ...state.items.filter((i) => i.id !== item.id),
          ].slice(0, 20),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "recently-viewed",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
