import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { Directory, File } from "expo-file-system";
import { Image } from "react-native";
import TrackPlayer, { Event, State, type Track } from "react-native-track-player";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ItemProps } from "@/components/home-feed/home-feed-post-card";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { setupTrackPlayer } from "@/services/audio-player/setup-track-player";

const Paths = {
  document: FileSystem.Paths.document,
};

const LOADED_SOUND_MARKER = { engine: "track-player" } as const;
const CONTEXT_REWIND_MS = 3000;
const CONTEXT_REWIND_THRESHOLD_MS = CONTEXT_REWIND_MS;
const POSITION_POLL_MS = 500;
const DEFAULT_ARTWORK = Image.resolveAssetSource(
  require("../../assets/icons/loading-icon.png"),
).uri;

let positionInterval: ReturnType<typeof setInterval> | null = null;
let listenerCleanup: (() => void) | null = null;

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

function secondsToMillis(seconds?: number | null) {
  return Math.max(0, Math.round((seconds ?? 0) * 1000));
}

function millisToSeconds(ms: number) {
  return Math.max(0, ms / 1000);
}

function isPlayingState(state?: State) {
  return state === State.Playing || state === State.Buffering;
}

function getPlaybackStateName(
  state: Awaited<ReturnType<typeof TrackPlayer.getPlaybackState>>,
) {
  return state.state;
}

function getBlogTitle(blog: ItemProps | null | undefined) {
  return blog?.audio?.title ?? blog?.caption ?? "Now Playing";
}

function getBlogArtist(blog: ItemProps | null | undefined) {
  const audio = blog?.audio as Record<string, unknown> | null | undefined;
  const channel = blog && "channel" in blog ? (blog as any).channel : null;

  return (
    (typeof audio?.artist === "string" && audio.artist) ||
    (typeof audio?.speaker === "string" && audio.speaker) ||
    channel?.title ||
    channel?.name ||
    "Al-Ghurobaa"
  );
}

function getBlogArtwork(blog: ItemProps | null | undefined) {
  const audio = blog?.audio as Record<string, unknown> | null | undefined;
  const image = blog && "image" in blog ? (blog as any).image : null;

  return (
    (typeof audio?.artwork === "string" && audio.artwork) ||
    (typeof audio?.imageUrl === "string" && audio.imageUrl) ||
    image?.url ||
    DEFAULT_ARTWORK
  );
}

function buildTrack(blog: ItemProps, url: string, durationMs?: number): Track {
  const id = String(blog?.id ?? blog?.audio?.fileName ?? url);

  return {
    id,
    url,
    title: getBlogTitle(blog),
    artist: getBlogArtist(blog),
    album: "Al-Ghurobaa",
    artwork: getBlogArtwork(blog),
    duration: durationMs ? millisToSeconds(durationMs) : undefined,
    blogId: blog?.id,
  };
}

async function syncPlayerSnapshot() {
  const [playbackState, progress] = await Promise.all([
    TrackPlayer.getPlaybackState(),
    TrackPlayer.getProgress(),
  ]);

  useAudioStore.setState({
    duration: secondsToMillis(progress.duration),
    isPlaying: isPlayingState(getPlaybackStateName(playbackState)),
    position: secondsToMillis(progress.position),
  });
}

function ensureTrackPlayerListeners() {
  if (listenerCleanup) return;

  const subscriptions = [
    TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      useAudioStore.setState({
        isLoading:
          event.state === State.Loading || event.state === State.Buffering,
        isPlaying: isPlayingState(event.state),
      });
    }),
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
      useAudioStore.setState({
        duration: secondsToMillis(event.duration),
        position: secondsToMillis(event.position),
      });
    }),
    TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
      useAudioStore.setState({
        error: event.message ?? "Audio playback failed",
        isLoading: false,
        isPlaying: false,
      });
    }),
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
      useAudioStore.setState({
        isPlaying: false,
        playSessionStartPosition: null,
      });
      useAudioStore.getState().stopPositionTracking();
    }),
  ];

  listenerCleanup = () => {
    for (const subscription of subscriptions) {
      subscription.remove();
    }
    listenerCleanup = null;
  };
}

async function preparePlayer() {
  await setupTrackPlayer();
  ensureTrackPlayerListeners();
}

interface AudioState {
  sound: typeof LOADED_SOUND_MARKER | null;
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
  playSessionStartPosition: number | null;
  playbackRate: number;
  sleepTimerEnd: number | null;
  activeTrackId: string | null;

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
      playSessionStartPosition: null,
      activeTrackId: null,
      blog: null!,

      loadAudio: async (blog) => {
        const directUrl = (blog?.audio as any)?.url as string | undefined;
        const fileName = blog?.audio?.fileName;

        try {
          if (!fileName) {
            throw new Error("Audio file name is not available");
          }

          set({
            error: null,
            isLoading: true,
            playSessionStartPosition: null,
          });

          await preparePlayer();
          get().stopPositionTracking();

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
            set({ downloadProgress: 0, localPath: null });
          }

          const track = buildTrack(blog, audioSource);

          await TrackPlayer.reset();
          await TrackPlayer.add(track);
          await TrackPlayer.setVolume(get().volume);
          await TrackPlayer.setRate(get().playbackRate);

          const progress = await TrackPlayer.getProgress();

          set({
            activeTrackId: track.id ? String(track.id) : null,
            blog,
            duration: secondsToMillis(progress.duration),
            error: null,
            isLoading: false,
            isPlaying: false,
            playSessionStartPosition: null,
            position: 0,
            sound: LOADED_SOUND_MARKER,
            uri: audioSource,
          });

          if (audioSource !== file.uri) {
            set({ downloadProgress: 0, isDownloading: true });

            LegacyFileSystem.createDownloadResumable(
              audioSource,
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
                    downloadProgress: 1,
                    isDownloading: false,
                    localPath: result.uri,
                  });
                } else {
                  set({ downloadProgress: 0, isDownloading: false });
                }
              })
              .catch((err) => {
                console.warn("[audio] Cache download failed:", err);
                set({ downloadProgress: 0, isDownloading: false });
              });
          }
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to load audio",
            isDownloading: false,
            isLoading: false,
          });
        }
      },

      play: async () => {
        if (!get().sound) return;

        try {
          await preparePlayer();
          const progress = await TrackPlayer.getProgress();
          const playSessionStartPosition = secondsToMillis(progress.position);

          await TrackPlayer.play();
          set({
            error: null,
            isPlaying: true,
            playSessionStartPosition,
            position: playSessionStartPosition,
          });
          get().startPositionTracking();
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to play audio",
          });
        }
      },

      pause: async () => {
        if (!get().sound) return;

        try {
          await preparePlayer();
          await TrackPlayer.pause();

          const progress = await TrackPlayer.getProgress();
          const pausedPosition = secondsToMillis(progress.position);
          const sessionStartPosition =
            get().playSessionStartPosition ?? pausedPosition;
          const shouldRewind =
            pausedPosition - sessionStartPosition >=
            CONTEXT_REWIND_THRESHOLD_MS;
          const nextPosition = shouldRewind
            ? Math.max(0, pausedPosition - CONTEXT_REWIND_MS)
            : pausedPosition;

          if (nextPosition !== pausedPosition) {
            await TrackPlayer.seekTo(millisToSeconds(nextPosition));
          }

          set({
            error: null,
            isPlaying: false,
            playSessionStartPosition: null,
            position: nextPosition,
          });
          get().stopPositionTracking();
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to pause audio",
          });
        }
      },

      stop: async () => {
        if (!get().sound) return;

        try {
          await preparePlayer();
          await TrackPlayer.pause();
          await TrackPlayer.seekTo(0);
          set({
            error: null,
            isPlaying: false,
            playSessionStartPosition: null,
            position: 0,
          });
          get().stopPositionTracking();
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to stop audio",
          });
        }
      },

      seek: async (positionMillis: number) => {
        if (!get().sound) return;

        try {
          await preparePlayer();
          set({ error: null, isSeeking: true, position: positionMillis });
          await TrackPlayer.seekTo(millisToSeconds(positionMillis));
          set({
            isSeeking: false,
            playSessionStartPosition: get().isPlaying
              ? positionMillis
              : get().playSessionStartPosition,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to seek",
            isSeeking: false,
          });
        }
      },

      setVolume: async (volume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));

        try {
          await preparePlayer();
          await TrackPlayer.setVolume(clampedVolume);
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to set volume",
          });
        }

        set({ volume: clampedVolume });
      },

      togglePlayPause: async () => {
        if (get().isPlaying) {
          await get().pause();
        } else {
          await get().play();
        }
      },

      unloadAudio: async () => {
        if (!get().sound) return;

        try {
          await preparePlayer();
          get().stopPositionTracking();
          await TrackPlayer.reset();
          set({
            activeTrackId: null,
            downloadProgress: 0,
            duration: 0,
            error: null,
            isDownloading: false,
            isPlaying: false,
            localPath: null,
            playSessionStartPosition: null,
            position: 0,
            sound: null,
            uri: null,
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
        const { blog, localPath, position, uri, volume, playbackRate } = get();
        const audioSource = localPath || uri;

        if (!audioSource || !blog) return;

        try {
          set({ error: null, isLoading: true, playSessionStartPosition: null });
          await preparePlayer();

          const track = buildTrack(blog, audioSource, get().duration);

          await TrackPlayer.reset();
          await TrackPlayer.add(track);
          await TrackPlayer.setVolume(volume);
          await TrackPlayer.setRate(playbackRate);
          await TrackPlayer.seekTo(millisToSeconds(position));

          const progress = await TrackPlayer.getProgress();

          set({
            activeTrackId: track.id ? String(track.id) : null,
            duration: secondsToMillis(progress.duration) || get().duration,
            isLoading: false,
            isPlaying: false,
            position,
            sound: LOADED_SOUND_MARKER,
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
          const { sound, isSeeking } = get();

          if (!sound || isSeeking) return;

          try {
            await syncPlayerSnapshot();
          } catch (err) {
            console.warn("[audio] Failed to sync position:", err);
          }
        }, POSITION_POLL_MS);
      },

      stopPositionTracking: () => {
        if (positionInterval) {
          clearInterval(positionInterval);
          positionInterval = null;
        }
      },

      setPlaybackRate: async (rate: number) => {
        set({ playbackRate: rate });

        if (!get().sound) return;

        try {
          await preparePlayer();
          await TrackPlayer.setRate(rate);
        } catch (err) {
          console.warn("[audio] setRate error", err);
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
        activeTrackId: state.activeTrackId,
        blog: state.blog,
        duration: state.duration,
        isPlaying: state.isPlaying,
        localPath: state.localPath,
        playbackRate: state.playbackRate,
        position: state.position,
        uri: state.uri,
        volume: state.volume,
      }),
    },
  ),
);
