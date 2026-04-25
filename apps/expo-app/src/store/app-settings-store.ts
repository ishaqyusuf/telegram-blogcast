import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppLanguage = "en" | "ar";

type AppSettingsState = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      language: "en",
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "app-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
