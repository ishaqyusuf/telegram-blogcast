import AsyncStorage from "@react-native-async-storage/async-storage";
import { addLocalApiIpToHistory, normalizeLocalApiIpInput } from "@/lib/local-api-ip-cache";
import type { TranscriptionModel } from "@/lib/transcription-models";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppLanguage = "en" | "ar";

type AppSettingsState = {
  language: AppLanguage;
  localApiBaseUrl: string | null;
  localApiLastIp: string | null;
  localApiIpHistory: string[];
  localTranscriberBaseUrl: string | null;
  transcriptionModel: TranscriptionModel;
  setLanguage: (language: AppLanguage) => void;
  setLocalApiBaseUrl: (url: string | null) => void;
  rememberLocalApiIp: (ip: string) => void;
  setLocalTranscriberBaseUrl: (url: string | null) => void;
  setTranscriptionModel: (model: TranscriptionModel) => void;
};

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      language: "en",
      localApiBaseUrl: null,
      localApiLastIp: null,
      localApiIpHistory: [],
      localTranscriberBaseUrl: null,
      transcriptionModel: "gpt-4o-transcribe",
      setLanguage: (language) => set({ language }),
      setLocalApiBaseUrl: (url) => set({ localApiBaseUrl: url }),
      rememberLocalApiIp: (ip) =>
        set((state) => {
          const cleanIp = normalizeLocalApiIpInput(ip);
          if (!cleanIp) return state;
          return {
            localApiLastIp: cleanIp,
            localApiIpHistory: addLocalApiIpToHistory(state.localApiIpHistory, cleanIp),
          };
        }),
      setLocalTranscriberBaseUrl: (url) => set({ localTranscriberBaseUrl: url }),
      setTranscriptionModel: (model) => set({ transcriptionModel: model }),
    }),
    {
      name: "app-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
