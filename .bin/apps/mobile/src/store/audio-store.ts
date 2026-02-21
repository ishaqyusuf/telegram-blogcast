import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
// import { File, Directory, Paths, getInfoAsync } from "expo-file-system";
import * as FileSystem from "expo-file-system";
import { Directory, File } from "expo-file-system";
import { ItemProps } from "@/components/home-feed/home-feed-post-card";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";

const Paths = {
  document: FileSystem.Paths.document,
};
let positionInterval: NodeJS.Timeout | null = null;
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

  // Actions
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
      volume: 1.0,
      blog: null!,
      loadAudio: async (blog) => {
        const uri = (await getTelegramFileUrl(blog?.audio?.telegramFileId))
          ?.url!;
        const fileName = blog?.audio?.fileName!;
        console.log("LOADING>>>");
        try {
          set({ isLoading: true, error: null });

          // Unload any existing sound
          const { sound: existingSound } = get();
          if (existingSound) {
            await existingSound.unloadAsync();
          }

          // Setup paths
          const folderPath = `al-ghurobaa/media`;
          const filePath = `${folderPath}${fileName}`;

          // Ensure folder exists
          const dir = new Directory(Paths.document, folderPath);
          const folderInfo = dir.info();
          if (!folderInfo.exists) {
            await dir.create({
              intermediates: true,
            });
          }

          // Check if file already downloaded
          // const fileInfo = await FileSystem.getInfoAsync(filePath);
          const file = new File(Paths.document, filePath);
          const fileInfo = file.info();
          let audioSource: string;

          if (fileInfo.exists) {
            // File exists locally, use it
            console.log("Playing from local file:", filePath);
            audioSource = file.uri;
            set({ localPath: filePath });
          } else {
            // File doesn't exist, stream and download
            console.log("Streaming and downloading:", uri);
            audioSource = uri;
            set({ localPath: null, isDownloading: true, downloadProgress: 0 });
            // Start download in background
            // const downloadResumable =
            FileSystem.File.downloadFileAsync(
              uri,
              file,
              {}
              // (downloadProgress) => {
              //   const progress =
              //     downloadProgress.totalBytesWritten /
              //     downloadProgress.totalBytesExpectedToWrite;
              //   set({ downloadProgress: progress });
              // }
            )
              .then((result) => {
                if (result) {
                  console.log("Download completed:", result.uri);
                  set({
                    localPath: result.uri,
                    isDownloading: false,
                    downloadProgress: 1,
                  });
                }
              })
              .catch((err) => {
                console.error("Download failed:", err);
                set({ isDownloading: false, downloadProgress: 0 });
              });
          }

          // Configure audio mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
          });

          // Load sound (either from local file or stream)
          const { sound } = await Audio.Sound.createAsync(
            { uri: audioSource },
            { shouldPlay: true, volume: get().volume },
            (status) => {
              if (status.isLoaded) {
                set({
                  isPlaying: status.isPlaying,
                  duration: status.durationMillis || 0,
                  position: status.positionMillis || 0,
                });
              }
            }
          );

          const status = await sound.getStatusAsync();

          set({
            sound,
            uri,
            isLoading: false,
            duration: status.isLoaded ? status.durationMillis || 0 : 0,
            position: 0,
            blog,
          });
        } catch (err) {
          console.log(err);
          set({
            error: err instanceof Error ? err.message : "Failed to load audio",
            isLoading: false,
            isDownloading: false,
          });
        }
      },
      play: async () => {
        const { sound, startPositionTracking } = get();
        if (!sound) return;

        try {
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
          await sound.setPositionAsync(positionMillis);
          set({ position: positionMillis, error: null });
        } catch (err) {
          set({
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
            error:
              err instanceof Error ? err.message : "Failed to unload audio",
          });
        }
      },

      updatePosition: (position: number) => {
        set({ position });
      },

      restoreAudio: async () => {
        const { uri, position, volume } = get();

        if (!uri) return;

        // Note: For restore, you'll need to store fileName separately
        // or derive it from the URI. For now, we'll try to use localPath if available
        const { localPath } = get();

        try {
          set({ isLoading: true, error: null });

          // Configure audio mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
          });

          // Use local path if available, otherwise stream
          const audioSource = localPath || uri;

          // Load the sound
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
            }
          );

          // Restore position
          await sound.setPositionAsync(position);

          const status = await sound.getStatusAsync();

          set({
            sound,
            isLoading: false,
            duration: status.isLoaded ? status.durationMillis || 0 : 0,
            isPlaying: false, // Don't auto-play on restore
          });

          // Optionally resume playing if it was playing before
          // if (wasPlaying) {
          //   await get().play();
          // }
        } catch (err) {
          set({
            error:
              err instanceof Error ? err.message : "Failed to restore audio",
            isLoading: false,
          });
        }
      },
      startPositionTracking: () => {
        // Clear existing interval
        if (positionInterval) {
          clearInterval(positionInterval);
        }

        // Update position every 100ms
        positionInterval = setInterval(async () => {
          const { sound, isPlaying } = get();
          if (sound && isPlaying) {
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
      }),
    }
  )
);
