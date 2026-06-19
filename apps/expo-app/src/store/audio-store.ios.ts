import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { Directory, File } from "expo-file-system";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ItemProps } from "@/components/home-feed/home-feed-post-card";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";

const Paths = {
  document: FileSystem.Paths.document,
};
const CONTEXT_REWIND_MS = 1500;
let positionInterval: ReturnType<typeof setInterval> | null = null;

function joinDocumentPath(...parts: string[]) {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function uniqueUrls(urls: (string | null | undefined)[]) {
  return urls.filter(
    (url, index): url is string =>
      Boolean(url) && urls.findIndex((candidate) => candidate === url) === index,
  );
}

interface AudioState {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  isLoading: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  duration: number;
  position: number;
  uri: string | null;
  localPath: string | null;
  error: string | null;
  volume: number;
  blog: ItemProps;
  isSeeking: boolean;
  playbackRate: number;
  sleepTimerEnd: number | null;

  loadAudio: (blog: ItemProps) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionMillis: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  unloadAudio: () => Promise<void>;
  updatePosition: (position: number) => void;
  restoreAudio: () => Promise<void>;
  startPositionTracking: () => void;
  stopPositionTracking: () => void;
  setPlaybackRate: (rate: number) => Promise<void>;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      sound: null,
      isPlaying: false,
      isLoading: false,
      isDownloading: false,
      downloadProgress: 0,
      duration: 0,
      position: 0,
      uri: null,
      localPath: null,
      error: null,
      volume: 1,
      playbackRate: 1,
      sleepTimerEnd: null,
      isSeeking: false,
      blog: null!,

      loadAudio: async (blog) => {
        const directUrl = (blog?.audio as any)?.url as string | undefined;
        const fileName = blog?.audio?.fileName;

        try {
          if (!fileName) {
            throw new Error("Audio file name is not available");
          }

          set({ isLoading: true, error: null });

          const { sound: existingSound, stopPositionTracking } = get();
          if (existingSound) {
            stopPositionTracking();
            await existingSound.unloadAsync();
          }

          const folderPath = "al-ghurobaa/media";
          const filePath = joinDocumentPath(folderPath, fileName);
          const dir = new Directory(Paths.document, folderPath);
          const folderInfo = dir.info();
          if (!folderInfo.exists) {
            await dir.create({ intermediates: true });
          }

          const file = new File(Paths.document, filePath);
          const fileInfo = file.info();
          let audioSource: string;

          if (fileInfo.exists) {
            audioSource = file.uri;
            set({ localPath: file.uri });
          } else {
            const telegramUrl = blog?.audio?.telegramFileId
              ? (await getTelegramFileUrl(blog.audio.telegramFileId))?.url
              : null;
            const sourceUrls = uniqueUrls([directUrl, telegramUrl]);

            if (sourceUrls.length === 0) {
              throw new Error("Audio URL is not available");
            }

            audioSource = sourceUrls[0];
            set({ localPath: null, downloadProgress: 0 });
          }

          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });

          const onPlaybackStatusUpdate = (status: any) => {
            if (status.isLoaded) {
              set({
                isPlaying: status.isPlaying,
                duration: status.durationMillis || 0,
                position: status.positionMillis || 0,
              });
            }
          };

          let sound: Audio.Sound | null = null;
          let loadedSource = audioSource;
          let loadError: unknown;
          const sourceUrls =
            audioSource === file.uri
              ? [audioSource]
              : uniqueUrls([
                  audioSource,
                  blog?.audio?.telegramFileId
                    ? (await getTelegramFileUrl(blog.audio.telegramFileId))?.url
                    : null,
                ]);

          for (const source of sourceUrls) {
            try {
              const result = await Audio.Sound.createAsync(
                { uri: source },
                { shouldPlay: false, volume: get().volume },
                onPlaybackStatusUpdate,
              );
              sound = result.sound;
              loadedSource = source;
              break;
            } catch (err) {
              loadError = err;
              console.warn("[audio] Failed to load source", source, err);
            }
          }

          if (!sound) {
            throw loadError instanceof Error
              ? loadError
              : new Error("Failed to load audio");
          }

          const status = await sound.getStatusAsync();

          set({
            sound,
            uri: loadedSource,
            isLoading: false,
            isPlaying: false,
            duration: status.isLoaded ? status.durationMillis || 0 : 0,
            position: 0,
            blog,
          });

          if (loadedSource !== file.uri) {
            set({ isDownloading: true, downloadProgress: 0 });
            LegacyFileSystem.createDownloadResumable(
              loadedSource,
              file.uri,
              {},
              (progress) => {
                const expected = progress.totalBytesExpectedToWrite;
                const written = progress.totalBytesWritten;
                if (expected > 0) {
                  set({
                    downloadProgress: Math.max(
                      0,
                      Math.min(1, written / expected),
                    ),
                  });
                }
              },
            )
              .downloadAsync()
              .then((result) => {
                if (result) {
                  set({
                    localPath: result.uri,
                    isDownloading: false,
                    downloadProgress: 1,
                  });
                } else {
                  set({ isDownloading: false, downloadProgress: 0 });
                }
              })
              .catch((err) => {
                console.warn("[audio] Cache download failed:", err);
                set({ isDownloading: false, downloadProgress: 0 });
              });
          }
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to load audio",
            isLoading: false,
            isDownloading: false,
          });
        }
      },

      play: async () => {
        const { sound, position, startPositionTracking } = get();
        if (!sound) return;

        try {
          const resumePos = Math.max(0, position - CONTEXT_REWIND_MS);
          await sound.setPositionAsync(resumePos);
          set({ position: resumePos });
          await sound.playAsync();
          set({ isPlaying: true, error: null });
          startPositionTracking();
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to play audio",
          });
        }
      },

      pause: async () => {
        const { sound, stopPositionTracking } = get();
        if (!sound) return;

        try {
          await sound.pauseAsync();
          set({ isPlaying: false, error: null });
          stopPositionTracking();
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to pause audio",
          });
        }
      },

      stop: async () => {
        const { sound, stopPositionTracking } = get();
        if (!sound) return;

        try {
          await sound.stopAsync();
          await sound.setPositionAsync(0);
          set({ isPlaying: false, position: 0, error: null });
          stopPositionTracking();
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to stop audio",
          });
        }
      },

      seek: async (positionMillis: number) => {
        const { sound } = get();
        if (!sound) return;

        try {
          set({ position: positionMillis, isSeeking: true, error: null });
          await sound.setPositionAsync(positionMillis);
          set({ isSeeking: false });
        } catch (err) {
          set({
            isSeeking: false,
            error: err instanceof Error ? err.message : "Failed to seek",
          });
        }
      },

      setVolume: async (volume: number) => {
        const { sound } = get();
        const clampedVolume = Math.max(0, Math.min(1, volume));

        if (sound) {
          try {
            await sound.setVolumeAsync(clampedVolume);
          } catch (err) {
            set({
              error:
                err instanceof Error ? err.message : "Failed to set volume",
            });
          }
        }

        set({ volume: clampedVolume });
      },

      togglePlayPause: async () => {
        const { isPlaying, play, pause } = get();
        if (isPlaying) {
          await pause();
        } else {
          await play();
        }
      },

      unloadAudio: async () => {
        const { sound, stopPositionTracking } = get();
        if (!sound) return;

        try {
          stopPositionTracking();
          await sound.unloadAsync();
          set({
            sound: null,
            isPlaying: false,
            isDownloading: false,
            downloadProgress: 0,
            duration: 0,
            position: 0,
            uri: null,
            localPath: null,
            error: null,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to unload audio",
          });
        }
      },

      updatePosition: (position: number) => {
        set({ position });
      },

      restoreAudio: async () => {
        const { uri, position, volume } = get();

        if (!uri) return;

        const { localPath } = get();

        try {
          set({ isLoading: true, error: null });

          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });

          const audioSource = localPath || uri;

          const { sound } = await Audio.Sound.createAsync(
            { uri: audioSource },
            {
              shouldPlay: false,
              volume,
              positionMillis: position,
            },
            (status) => {
              if (status.isLoaded) {
                set({
                  isPlaying: status.isPlaying,
                  duration: status.durationMillis || 0,
                  position: status.positionMillis || 0,
                });
              }
            },
          );

          await sound.setPositionAsync(position);

          const status = await sound.getStatusAsync();

          set({
            sound,
            isLoading: false,
            duration: status.isLoaded ? status.durationMillis || 0 : 0,
            isPlaying: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to restore audio",
            isLoading: false,
          });
        }
      },

      startPositionTracking: () => {
        if (positionInterval) {
          clearInterval(positionInterval);
        }

        positionInterval = setInterval(async () => {
          const { sound, isPlaying, isSeeking } = get();
          if (sound && isPlaying && !isSeeking) {
            try {
              const status = await sound.getStatusAsync();
              if (status.isLoaded) {
                set({
                  position: status.positionMillis,
                  duration: status.durationMillis || get().duration,
                });
              }
            } catch (err) {
              console.error("Failed to get position:", err);
            }
          }
        }, 100);
      },

      stopPositionTracking: () => {
        if (positionInterval) {
          clearInterval(positionInterval);
          positionInterval = null;
        }
      },

      setPlaybackRate: async (rate: number) => {
        const { sound } = get();
        set({ playbackRate: rate });
        if (sound) {
          try {
            await (sound as any).setRateAsync(rate, true);
          } catch (err) {
            console.warn("[audio] setRateAsync error", err);
          }
        }
      },

      setSleepTimer: (minutes: number) => {
        set({ sleepTimerEnd: Date.now() + minutes * 60 * 1000 });
      },

      clearSleepTimer: () => {
        set({ sleepTimerEnd: null });
      },
    }),
    {
      name: "audio-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        uri: state.uri,
        localPath: state.localPath,
        position: state.position,
        volume: state.volume,
        isPlaying: state.isPlaying,
        duration: state.duration,
        playbackRate: state.playbackRate,
      }),
    },
  ),
);
