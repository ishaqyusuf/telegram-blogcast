import {
	addLocalApiIpToHistory,
	normalizeLocalApiIpInput,
} from "@/lib/local-api-ip-cache";
import type { TranscriptionModel } from "@/lib/transcription-models";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppLanguage = "en" | "ar";
export type ReaderTheme = "default" | "sepia" | "night";
export type ReaderLineSpacing = "compact" | "normal" | "relaxed";
export type AlbumOrganizerModel = "deepseek" | "gemini" | "openai";

type AppSettingsState = {
	language: AppLanguage;
	readerFontSize: number;
	readerLineSpacing: ReaderLineSpacing;
	readerTheme: ReaderTheme;
	localApiBaseUrl: string | null;
	localServicesIp: string | null;
	localApiLastIp: string | null;
	localApiIpHistory: string[];
	localTranscriberBaseUrl: string | null;
	transcriptionModel: TranscriptionModel;
	albumOrganizerModel: AlbumOrganizerModel;
	setLanguage: (language: AppLanguage) => void;
	setReaderFontSize: (fontSize: number) => void;
	setReaderLineSpacing: (lineSpacing: ReaderLineSpacing) => void;
	setReaderTheme: (theme: ReaderTheme) => void;
	resetReaderSettings: () => void;
	setLocalApiBaseUrl: (url: string | null) => void;
	setLocalServicesIp: (ip: string | null) => void;
	rememberLocalApiIp: (ip: string) => void;
	setLocalTranscriberBaseUrl: (url: string | null) => void;
	setTranscriptionModel: (model: TranscriptionModel) => void;
	setAlbumOrganizerModel: (model: AlbumOrganizerModel) => void;
};

export const useAppSettingsStore = create<AppSettingsState>()(
	persist(
		(set) => ({
			language: "en",
			readerFontSize: 18,
			readerLineSpacing: "normal",
			readerTheme: "default",
			localApiBaseUrl: null,
			localServicesIp: null,
			localApiLastIp: null,
			localApiIpHistory: [],
			localTranscriberBaseUrl: null,
			transcriptionModel: "whisper-local",
			albumOrganizerModel: "deepseek",
			setLanguage: (language) => set({ language }),
			setReaderFontSize: (fontSize) =>
				set({ readerFontSize: Math.max(14, Math.min(28, fontSize)) }),
			setReaderLineSpacing: (readerLineSpacing) => set({ readerLineSpacing }),
			setReaderTheme: (readerTheme) => set({ readerTheme }),
			resetReaderSettings: () =>
				set({
					readerFontSize: 18,
					readerLineSpacing: "normal",
					readerTheme: "default",
				}),
			setLocalApiBaseUrl: (url) => set({ localApiBaseUrl: url }),
			setLocalServicesIp: (ip) =>
				set((state) => {
					const cleanIp = normalizeLocalApiIpInput(ip);
					if (!cleanIp) return { localServicesIp: null };
					return {
						localServicesIp: cleanIp,
						localApiLastIp: cleanIp,
						localApiIpHistory: addLocalApiIpToHistory(
							state.localApiIpHistory,
							cleanIp,
						),
					};
				}),
			rememberLocalApiIp: (ip) =>
				set((state) => {
					const cleanIp = normalizeLocalApiIpInput(ip);
					if (!cleanIp) return state;
					return {
						localServicesIp: state.localServicesIp ?? cleanIp,
						localApiLastIp: cleanIp,
						localApiIpHistory: addLocalApiIpToHistory(
							state.localApiIpHistory,
							cleanIp,
						),
					};
				}),
			setLocalTranscriberBaseUrl: (url) =>
				set({ localTranscriberBaseUrl: url }),
			setTranscriptionModel: (model) => set({ transcriptionModel: model }),
			setAlbumOrganizerModel: (model) => set({ albumOrganizerModel: model }),
		}),
		{
			name: "app-settings",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
