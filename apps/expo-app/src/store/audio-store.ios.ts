import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { Directory, File } from "expo-file-system";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ItemProps } from "@/components/home-feed/home-feed-post-card";
import { getAudioPlayability, isAudioPlayable } from "@/lib/audio-playability";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";

const Paths = {
	document: FileSystem.Paths.document,
};
const CONTEXT_REWIND_MS = 1500;
const END_REPLAY_RESET_THRESHOLD_MS = 750;
const STALE_AUDIO_MS = 12 * 60 * 60 * 1000;
let positionInterval: ReturnType<typeof setInterval> | null = null;

export type AudioPlayMode =
	| "off"
	| "repeat-one"
	| "album-sequence"
	| "repeat-album"
	| "shuffle-album";

const AUDIO_PLAY_MODES: AudioPlayMode[] = [
	"off",
	"repeat-one",
	"album-sequence",
	"repeat-album",
	"shuffle-album",
];

function joinDocumentPath(...parts: string[]) {
	return parts
		.map((part) => part.replace(/^\/+|\/+$/g, ""))
		.filter(Boolean)
		.join("/");
}

function uniqueUrls(urls: (string | null | undefined)[]) {
	return urls.filter(
		(url, index): url is string =>
			Boolean(url) &&
			urls.findIndex((candidate) => candidate === url) === index,
	);
}

function isOlderThan(timestamp: number | null | undefined, maxAgeMs: number) {
	return Boolean(timestamp && Date.now() - timestamp > maxAgeMs);
}

function isAtAudioEnd(positionMs: number, durationMs: number) {
	return durationMs > 0 && positionMs >= durationMs - END_REPLAY_RESET_THRESHOLD_MS;
}

function getAudioPayload(blog: ItemProps | null | undefined) {
	return blog?.audio as Record<string, any> | null | undefined;
}

function getAlbumQueueFromBlog(blog: ItemProps | null | undefined) {
	const queue = getAudioPayload(blog)?.albumQueue;
	return Array.isArray(queue) ? (queue as ItemProps[]) : null;
}

function getAlbumIdFromBlog(blog: ItemProps | null | undefined) {
	const albumId = getAudioPayload(blog)?.albumId;
	return albumId == null ? null : String(albumId);
}

function getAudioTrackKey(blog: ItemProps | null | undefined) {
	const audio = getAudioPayload(blog);
	const mediaId = audio?.mediaId;
	return String(mediaId ?? blog?.id ?? audio?.fileName ?? "");
}

function getNextPlayMode(playMode: AudioPlayMode) {
	const currentIndex = AUDIO_PLAY_MODES.indexOf(playMode);
	return AUDIO_PLAY_MODES[(currentIndex + 1) % AUDIO_PLAY_MODES.length]!;
}

function withAlbumQueue(blog: ItemProps, albumQueue: ItemProps[] | null) {
	if (!albumQueue?.length) return blog;

	return {
		...blog,
		audio: {
			...(blog.audio as any),
			albumQueue,
		},
	} as ItemProps;
}

function resolveNextAlbumQueueItem(
	state: Pick<AudioState, "albumQueue" | "blog" | "playMode" | "shuffleHistory">,
) {
	const queue = state.albumQueue;
	if (!queue?.length) return null;

	const currentKey = getAudioTrackKey(state.blog);
	const currentIndex = Math.max(
		0,
		queue.findIndex((item) => getAudioTrackKey(item) === currentKey),
	);

	if (state.playMode === "album-sequence") {
		const nextItem = queue
			.slice(currentIndex + 1)
			.find((item) => isAudioPlayable((item as any).audio));
		return nextItem
			? { item: nextItem, shuffleHistory: state.shuffleHistory }
			: null;
	}

	if (state.playMode === "repeat-album") {
		for (let offset = 1; offset <= queue.length; offset++) {
			const item = queue[(currentIndex + offset) % queue.length]!;
			if (!isAudioPlayable((item as any).audio)) continue;

			return {
				item,
				shuffleHistory: state.shuffleHistory,
			};
		}

		return null;
	}

	if (state.playMode !== "shuffle-album") return null;

	const currentHistory = state.shuffleHistory.includes(currentKey)
		? state.shuffleHistory
		: [...state.shuffleHistory, currentKey].filter(Boolean);
	const visited = new Set(currentHistory);
	let candidates = queue.filter(
		(item) =>
			isAudioPlayable((item as any).audio) &&
			!visited.has(getAudioTrackKey(item)),
	);

	if (candidates.length === 0) {
		candidates = queue.filter(
			(item) =>
				isAudioPlayable((item as any).audio) &&
				getAudioTrackKey(item) !== currentKey,
		);
	}

	if (candidates.length === 0) {
		candidates = queue.filter((item) => isAudioPlayable((item as any).audio));
	}

	if (candidates.length === 0) return null;

	const nextItem = candidates[Math.floor(Math.random() * candidates.length)];
	if (!nextItem) return null;

	const nextKey = getAudioTrackKey(nextItem);
	return {
		item: nextItem,
		shuffleHistory:
			visited.size >= queue.length
				? [currentKey, nextKey].filter(Boolean)
				: [...currentHistory, nextKey].filter(Boolean),
	};
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
	pausedAt: number | null;
	playedAt: number | null;
	hasEnded: boolean;
	playMode: AudioPlayMode;
	albumQueue: ItemProps[] | null;
	shuffleHistory: string[];

	loadAudio: (blog: ItemProps) => Promise<void>;
	play: () => Promise<void>;
	playNextAlbumTrack: () => Promise<boolean>;
	pause: () => Promise<void>;
	stop: () => Promise<void>;
	seek: (positionMillis: number) => Promise<void>;
	setVolume: (volume: number) => Promise<void>;
	togglePlayPause: () => Promise<void>;
	unloadAudio: () => Promise<void>;
	updatePosition: (position: number) => void;
	restoreAudio: () => Promise<void>;
	syncPlaybackSnapshot: () => Promise<void>;
	startPositionTracking: () => void;
	stopPositionTracking: () => void;
	setPlaybackRate: (rate: number) => Promise<void>;
	setSleepTimer: (minutes: number) => void;
	clearSleepTimer: () => void;
	setPlayMode: (playMode: AudioPlayMode) => void;
	cyclePlayMode: () => void;
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
			pausedAt: null,
			playedAt: null,
			isSeeking: false,
			hasEnded: false,
			blog: null!,
			playMode: "off",
			albumQueue: null,
			shuffleHistory: [],

			loadAudio: async (blog) => {
				const directUrl = (blog?.audio as any)?.url as string | undefined;
				const fileName = blog?.audio?.fileName;
				const incomingAlbumQueue = getAlbumQueueFromBlog(blog);
				const incomingAlbumId = getAlbumIdFromBlog(blog);
				const currentAlbumId = getAlbumIdFromBlog(get().blog);
				const nextAlbumQueue = incomingAlbumQueue?.length
					? incomingAlbumQueue
					: incomingAlbumId && incomingAlbumId === currentAlbumId
						? get().albumQueue
						: null;
				const shouldResetAlbumMode = !incomingAlbumId || !nextAlbumQueue?.length;

				try {
					const audioPlayability = getAudioPlayability(blog?.audio as any);
					if (!audioPlayability.canPlay) {
						throw new Error(
							audioPlayability.reason ?? "Audio cannot be played.",
						);
					}

					const currentSound = get().sound;
					const currentBlogId = get().blog?.id;

					if (currentSound && currentBlogId === blog?.id) {
						const status = await currentSound.getStatusAsync();
						const duration = status.isLoaded
							? status.durationMillis || get().duration
							: get().duration;
						const position = status.isLoaded
							? (status.positionMillis ?? get().position)
							: get().position;
						const hasEnded =
							status.isLoaded &&
							(Boolean(status.didJustFinish) ||
								(!status.isPlaying && get().hasEnded));
						set({
							albumQueue: nextAlbumQueue,
							blog,
							error: null,
							isLoading: false,
							isPlaying: hasEnded
								? false
								: status.isLoaded
									? status.isPlaying
									: get().isPlaying,
							playMode: shouldResetAlbumMode ? "off" : get().playMode,
							shuffleHistory: shouldResetAlbumMode
								? []
								: get().shuffleHistory,
							duration,
							position: hasEnded && duration > 0 ? duration : position,
							hasEnded: status.isLoaded ? hasEnded : get().hasEnded,
						});
						return;
					}

					if (!fileName) {
						throw new Error("Audio file name is not available");
					}

					set({ isLoading: true, error: null, hasEnded: false });
					set({
						albumQueue: nextAlbumQueue,
						playMode: shouldResetAlbumMode ? "off" : get().playMode,
						shuffleHistory: shouldResetAlbumMode ? [] : get().shuffleHistory,
					});

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
							const duration = status.durationMillis || 0;
							const position =
								status.didJustFinish && duration > 0
									? duration
									: status.positionMillis || 0;
							const hasEnded =
								Boolean(status.didJustFinish) ||
								(!status.isPlaying && get().hasEnded);
							if (hasEnded) {
								set({
									hasEnded,
									isPlaying: false,
									duration,
									...(get().isSeeking ? {} : { position }),
								});
								void get().playNextAlbumTrack().then((playedNext) => {
									if (!playedNext) get().stopPositionTracking();
								});
								return;
							}
							set({
								hasEnded,
								isPlaying: status.isPlaying,
								duration,
								...(get().isSeeking && !hasEnded ? {} : { position }),
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
						pausedAt: null,
						hasEnded: false,
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

			playNextAlbumTrack: async () => {
				const { sound } = get();
				if (!sound) return false;

				if (get().playMode === "repeat-one") {
					try {
						await sound.setPositionAsync(0);
						await sound.playAsync();
						set({
							hasEnded: false,
							isPlaying: true,
							error: null,
							pausedAt: null,
							playedAt: Date.now(),
							position: 0,
						});
						get().startPositionTracking();
						return true;
					} catch (err) {
						set({
							error:
								err instanceof Error
									? err.message
									: "Failed to repeat audio",
						});
						return false;
					}
				}

				const next = resolveNextAlbumQueueItem(get());
				if (!next) return false;

				const albumQueue = get().albumQueue;
				await get().loadAudio(withAlbumQueue(next.item, albumQueue));
				if (get().error) return false;

				set({ shuffleHistory: next.shuffleHistory });
				await get().play();
				return !get().error;
			},

			play: async () => {
				const { duration, hasEnded, position, sound, startPositionTracking } =
					get();
				if (!sound) return;

				try {
					const shouldRestart =
						hasEnded || isAtAudioEnd(position, duration);
					const resumePos = shouldRestart
						? 0
						: Math.max(0, position - CONTEXT_REWIND_MS);
					await sound.setPositionAsync(resumePos);
					set({ hasEnded: false, position: resumePos });
					await sound.playAsync();
					set({
						hasEnded: false,
						isPlaying: true,
						error: null,
						pausedAt: null,
						playedAt: Date.now(),
					});
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
					set({ isPlaying: false, error: null, pausedAt: Date.now() });
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
					set({
						isPlaying: false,
						position: 0,
						hasEnded: false,
						error: null,
						pausedAt: Date.now(),
					});
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
					set({
						hasEnded: false,
						position: positionMillis,
						isSeeking: true,
						error: null,
					});
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
						hasEnded: false,
						albumQueue: null,
						pausedAt: null,
						playedAt: null,
						playMode: "off",
						position: 0,
						shuffleHistory: [],
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
				set({
					position,
					playedAt: get().isPlaying ? Date.now() : get().playedAt,
				});
			},

			restoreAudio: async () => {
				const {
					isPlaying: wasPlaying,
					pausedAt,
					playedAt,
					position,
					uri,
					volume,
				} = get();

				if (!uri) return;

				const { localPath } = get();
				const effectivePausedAt = wasPlaying
					? pausedAt
					: (pausedAt ?? Date.now());
				const effectivePlayedAt = wasPlaying
					? (playedAt ?? Date.now())
					: playedAt;
				const isStale =
					(!wasPlaying && isOlderThan(effectivePausedAt, STALE_AUDIO_MS)) ||
					(wasPlaying && isOlderThan(effectivePlayedAt, STALE_AUDIO_MS));

				if (isStale) {
					set({
						duration: 0,
						hasEnded: false,
						isPlaying: false,
						localPath: null,
						albumQueue: null,
						pausedAt: null,
						playedAt: null,
						playMode: "off",
						position: 0,
						shuffleHistory: [],
						sound: null,
						uri: null,
					});
					return;
				}

				try {
					set({
						isLoading: true,
						error: null,
						isPlaying: false,
						hasEnded: false,
						pausedAt: wasPlaying ? Date.now() : effectivePausedAt,
						playedAt: effectivePlayedAt,
					});

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
								const duration = status.durationMillis || 0;
								const position =
									status.didJustFinish && duration > 0
										? duration
										: status.positionMillis || 0;
								const hasEnded =
									Boolean(status.didJustFinish) ||
									(!status.isPlaying && get().hasEnded);
								if (hasEnded) {
									set({
										hasEnded,
										isPlaying: false,
										pausedAt: Date.now(),
										playedAt: get().playedAt,
										duration,
										...(get().isSeeking ? {} : { position }),
									});
									void get().playNextAlbumTrack().then((playedNext) => {
										if (!playedNext) get().stopPositionTracking();
									});
									return;
								}
								set({
									hasEnded,
									isPlaying: status.isPlaying,
									pausedAt: status.isPlaying ? null : Date.now(),
									playedAt:
										status.isPlaying ? Date.now() : get().playedAt,
									duration,
									...(get().isSeeking && !hasEnded ? {} : { position }),
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
						hasEnded: false,
						pausedAt: wasPlaying ? Date.now() : effectivePausedAt,
					});
				} catch (err) {
					set({
						error:
							err instanceof Error ? err.message : "Failed to restore audio",
						isLoading: false,
					});
				}
			},

			syncPlaybackSnapshot: async () => {
				const { sound } = get();
				if (!sound) return;

				try {
					const status = await sound.getStatusAsync();
					if (!status.isLoaded) return;
					const duration = status.durationMillis || get().duration;
					const position =
						status.didJustFinish && duration > 0
							? duration
							: status.positionMillis || 0;
					const hasEnded =
						Boolean(status.didJustFinish) ||
						(!status.isPlaying && get().hasEnded);

					if (hasEnded) {
						set({
							duration,
							hasEnded,
							isPlaying: false,
							pausedAt: get().pausedAt ?? Date.now(),
							playedAt: get().playedAt,
							...(get().isSeeking ? {} : { position }),
						});
						void get().playNextAlbumTrack().then((playedNext) => {
							if (!playedNext) get().stopPositionTracking();
						});
						return;
					}

					set({
						duration,
						hasEnded: false,
						isPlaying: status.isPlaying,
						pausedAt:
							status.isPlaying
								? null
								: (get().pausedAt ?? Date.now()),
						playedAt:
							status.isPlaying
								? Date.now()
								: get().playedAt,
						...(get().isSeeking && !hasEnded
							? {}
							: {
									position,
								}),
					});

					if (status.isPlaying) {
						get().startPositionTracking();
					} else {
						get().stopPositionTracking();
					}
				} catch (err) {
					set({
						error:
							err instanceof Error
								? err.message
								: "Failed to sync audio playback",
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
								const duration = status.durationMillis || get().duration;
								const position =
									status.didJustFinish && duration > 0
										? duration
										: status.positionMillis;
								const hasEnded =
									Boolean(status.didJustFinish) ||
									(!status.isPlaying && get().hasEnded);
								if (hasEnded) {
									set({
										duration,
										hasEnded,
										position,
										playedAt: get().playedAt,
									});
									void get().playNextAlbumTrack().then((playedNext) => {
										if (!playedNext) get().stopPositionTracking();
									});
									return;
								}
								set({
									duration,
									hasEnded: false,
									position,
									playedAt: Date.now(),
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

			setPlayMode: (playMode) => {
				const canUseAlbumMode = Boolean(get().albumQueue?.length);
				set({
					playMode: canUseAlbumMode ? playMode : "off",
					shuffleHistory:
						playMode === "shuffle-album"
							? [getAudioTrackKey(get().blog)].filter(Boolean)
							: [],
				});
			},

			cyclePlayMode: () => {
				const canUseAlbumMode = Boolean(get().albumQueue?.length);
				const nextPlayMode = canUseAlbumMode
					? getNextPlayMode(get().playMode)
					: "off";
				set({
					playMode: nextPlayMode,
					shuffleHistory:
						nextPlayMode === "shuffle-album"
							? [getAudioTrackKey(get().blog)].filter(Boolean)
							: [],
				});
			},
		}),
		{
			name: "audio-storage",
			storage: createJSONStorage(() => AsyncStorage),
			partialize: (state) => ({
				uri: state.uri,
				localPath: state.localPath,
				pausedAt: state.pausedAt,
				playedAt: state.playedAt,
				position: state.position,
				volume: state.volume,
				isPlaying: state.isPlaying,
				duration: state.duration,
				playbackRate: state.playbackRate,
				playMode: state.playMode,
			}),
		},
	),
);
