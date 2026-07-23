import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LegacyFileSystem from "expo-file-system/legacy";
import {
	AppState,
	DeviceEventEmitter,
	Image,
	PermissionsAndroid,
	Platform,
} from "react-native";
import TrackPlayer, {
	Event,
	State,
	type Track,
	type TrackPlayerState,
} from "@/services/audio-player/track-player-safe";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ItemProps } from "@/components/home-feed/home-feed-post-card";
import { getAudioPlayability, isAudioPlayable } from "@/lib/audio-playability";
import { getAudioDisplayTitle } from "@/lib/audio-title";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import {
	REMOTE_PLAYBACK_SNAPSHOT_EVENT,
	type RemotePlaybackSnapshot,
} from "@/services/audio-player/playback-service-handlers";
import {
	normalizePlaybackRate,
	synchronizePlaybackRate,
} from "@/services/audio-player/notification-controls";
import { getRemotePlaybackStateUpdate } from "@/services/audio-player/remote-playback-state";
import {
	refreshTrackPlayerNotificationOptions,
	setupTrackPlayer,
} from "@/services/audio-player/setup-track-player";

const LOADED_SOUND_MARKER = { engine: "track-player" } as const;
const CONTEXT_REWIND_MS = 1500;
const CONTEXT_REWIND_THRESHOLD_MS = CONTEXT_REWIND_MS;
const END_REPLAY_RESET_THRESHOLD_MS = 750;
const POSITION_POLL_MS = 250;
const STALE_AUDIO_MS = 12 * 60 * 60 * 1000;
const PRIVATE_AUDIO_FOLDER = "al-ghurobaa/media";
const PUBLIC_AUDIO_ROOT = "Al-ghurobaa";
const PUBLIC_AUDIO_FOLDER = "media";
const DEFAULT_ARTWORK = Image.resolveAssetSource(
	require("../../assets/icons/loading-icon.png"),
).uri;

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

let positionInterval: ReturnType<typeof setInterval> | null = null;
let listenerCleanup: (() => void) | null = null;
let notificationPermissionPromise: Promise<void> | null = null;

function uniqueUrls(urls: (string | null | undefined)[]) {
	return urls.filter(
		(url, index): url is string =>
			Boolean(url) &&
			urls.findIndex((candidate) => candidate === url) === index,
	);
}

function secondsToMillis(seconds?: number | null) {
	return Math.max(0, Math.round((seconds ?? 0) * 1000));
}

function millisToSeconds(ms: number) {
	return Math.max(0, ms / 1000);
}

function isPlayingState(state?: TrackPlayerState) {
	return state === State.Playing || state === State.Buffering;
}

function isOlderThan(timestamp: number | null | undefined, maxAgeMs: number) {
	return Boolean(timestamp && Date.now() - timestamp > maxAgeMs);
}

function isAtAudioEnd(positionMs: number, durationMs: number) {
  return (
    durationMs > 0 && positionMs >= durationMs - END_REPLAY_RESET_THRESHOLD_MS
  );
}

function getPlaybackStateName(
	state: Awaited<ReturnType<typeof TrackPlayer.getPlaybackState>>,
) {
	return state.state;
}

function sanitizePublicFileName(fileName: string) {
	const sanitized = fileName.replace(/[\\/:*?"<>|]/g, "-").trim();
	return sanitized || "audio.mp3";
}

function joinFileUri(root: string, ...parts: string[]) {
  return `${root.replace(/\/+$/g, "")}/${parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

function getSafEntryName(uri: string) {
	const decoded = decodeURIComponent(uri);
	const name = decoded.split("/").pop();
	return name?.split(":").pop() ?? "";
}

function getAudioMimeType(fileName: string) {
	const extension = fileName.split(".").pop()?.toLowerCase();
	if (extension === "m4a" || extension === "mp4") return "audio/mp4";
	if (extension === "ogg" || extension === "oga") return "audio/ogg";
	if (extension === "wav") return "audio/wav";
	return "audio/mpeg";
}

async function canReadSafDirectory(uri: string) {
	try {
		await LegacyFileSystem.StorageAccessFramework.readDirectoryAsync(uri);
		return true;
	} catch {
		return false;
	}
}

async function findSafChildByName(parentUri: string, name: string) {
	const entries =
		await LegacyFileSystem.StorageAccessFramework.readDirectoryAsync(parentUri);
	return entries.find((entry) => getSafEntryName(entry) === name) ?? null;
}

async function getUsableSafFile(parentUri: string, name: string) {
	const fileUri = await findSafChildByName(parentUri, name);
	if (!fileUri) return null;

	const info = await LegacyFileSystem.getInfoAsync(fileUri).catch(() => null);
	if (!info?.exists || (typeof info.size === "number" && info.size <= 0)) {
		await LegacyFileSystem.StorageAccessFramework.deleteAsync(fileUri, {
			idempotent: true,
		}).catch(() => undefined);
		return null;
	}

	return fileUri;
}

async function getUsableFileUri(uri: string) {
  const info = await LegacyFileSystem.getInfoAsync(uri).catch(() => null);
  if (!info?.exists || (typeof info.size === "number" && info.size <= 0)) {
    if (info?.exists) {
      await LegacyFileSystem.deleteAsync(uri, { idempotent: true }).catch(
        () => undefined,
      );
    }
    return null;
  }

  return uri;
}

async function ensurePrivateAudioFile(fileName: string) {
  if (!LegacyFileSystem.documentDirectory) {
    throw new Error("Audio storage is not available");
  }

  const directoryUri = joinFileUri(
    LegacyFileSystem.documentDirectory,
    PRIVATE_AUDIO_FOLDER,
  );
  await LegacyFileSystem.makeDirectoryAsync(directoryUri, {
    intermediates: true,
  }).catch(() => undefined);

  return joinFileUri(directoryUri, sanitizePublicFileName(fileName));
}

async function ensurePublicAudioFolder(
  storedUri?: string | null,
  requestIfMissing = true,
) {
	if (Platform.OS !== "android") return null;

	if (storedUri && (await canReadSafDirectory(storedUri))) {
		return storedUri;
	}

  if (!requestIfMissing) return null;

	const { StorageAccessFramework } = LegacyFileSystem;
	const appRootUri =
		StorageAccessFramework.getUriForDirectoryInRoot(PUBLIC_AUDIO_ROOT);
	const permissions =
		await StorageAccessFramework.requestDirectoryPermissionsAsync(appRootUri);

	if (!permissions.granted) return null;

	const existing =
		(await findSafChildByName(permissions.directoryUri, PUBLIC_AUDIO_FOLDER)) ??
		(await StorageAccessFramework.makeDirectoryAsync(
			permissions.directoryUri,
			PUBLIC_AUDIO_FOLDER,
		));

	return existing;
}

async function createPublicAudioFile(
	publicFolderUri: string,
	fileName: string,
) {
	const publicFileName = sanitizePublicFileName(fileName);
	const existing = await getUsableSafFile(publicFolderUri, publicFileName);
	if (existing) return existing;

	return LegacyFileSystem.StorageAccessFramework.createFileAsync(
		publicFolderUri,
		publicFileName,
		getAudioMimeType(publicFileName),
	);
}

async function copySafFileToPrivateFile(fromUri: string, toUri: string) {
  await LegacyFileSystem.copyAsync({ from: fromUri, to: toUri });
  return getUsableFileUri(toUri);
}

async function copyPrivateFileToPublicFile(
  fromUri: string,
  publicFolderUri: string | null,
  fileName: string,
) {
  if (!publicFolderUri) return null;

  try {
    const publicFileUri = await createPublicAudioFile(
      publicFolderUri,
      fileName,
    );
    await LegacyFileSystem.copyAsync({ from: fromUri, to: publicFileUri });
    return publicFileUri;
  } catch (err) {
    console.warn("[audio] Public audio copy failed:", err);
    return null;
  }
}

async function requestAndroidNotificationPermission() {
	const sdkVersion =
		typeof Platform.Version === "number"
			? Platform.Version
			: Number.parseInt(String(Platform.Version), 10);

	if (!Number.isFinite(sdkVersion) || sdkVersion < 33) return;

	const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
	const alreadyGranted = await PermissionsAndroid.check(permission);

	if (!alreadyGranted) {
		await PermissionsAndroid.request(permission);
	}
}

async function ensureNotificationPermission() {
	if (!notificationPermissionPromise) {
		notificationPermissionPromise =
			requestAndroidNotificationPermission().catch(() => {
				notificationPermissionPromise = null;
			});
	}

	await notificationPermissionPromise;
}

function getBlogTitle(blog: ItemProps | null | undefined) {
	return getAudioDisplayTitle(blog, "Now Playing");
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
  state: Pick<
    AudioState,
    "albumQueue" | "blog" | "playMode" | "shuffleHistory"
  >,
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
	const [playbackState, progress, playbackRate] = await Promise.all([
		TrackPlayer.getPlaybackState(),
		TrackPlayer.getProgress(),
		TrackPlayer.getRate(),
	]);

	const playbackStateName = getPlaybackStateName(playbackState);
	const isPlaying = isPlayingState(playbackStateName);
	const current = useAudioStore.getState();
	const supportedPlaybackRate = await synchronizePlaybackRate({
		nativeRate: playbackRate,
		storedRate: current.playbackRate,
		setNativeRate: (rate) => TrackPlayer.setRate(rate),
		refreshNotificationOptions: refreshTrackPlayerNotificationOptions,
	});
	const durationMs = secondsToMillis(progress.duration) || current.duration;
	const positionMs = secondsToMillis(progress.position);
	const hasEnded =
    playbackStateName === State.Ended || (!isPlaying && current.hasEnded);
	useAudioStore.setState({
		duration: durationMs,
		hasEnded,
		isPlaying,
		playbackRate: supportedPlaybackRate,
		playedAt: isPlaying ? Date.now() : current.playedAt,
		...(current.isSeeking
			? {}
			: { position: hasEnded && durationMs > 0 ? durationMs : positionMs }),
	});

	return isPlaying;
}

function ensureTrackPlayerListeners() {
	if (listenerCleanup) return;

	const subscriptions = [
		TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
			const isPlaying = isPlayingState(event.state);
			const hasEnded =
				event.state === State.Ended
					? true
					: isPlaying
						? false
						: useAudioStore.getState().hasEnded;
			const duration = useAudioStore.getState().duration;
			useAudioStore.setState({
				hasEnded,
				isLoading:
					event.state === State.Loading || event.state === State.Buffering,
				isPlaying,
				pausedAt: isPlaying ? null : Date.now(),
				playedAt: isPlaying ? Date.now() : useAudioStore.getState().playedAt,
				...(event.state === State.Ended && duration > 0
					? { position: duration }
					: {}),
			});
		}),
		TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
			const current = useAudioStore.getState();
			const duration = secondsToMillis(event.duration) || current.duration;
			const position = secondsToMillis(event.position);
			useAudioStore.setState({
				duration,
				hasEnded: current.hasEnded,
        playedAt: current.isPlaying ? Date.now() : current.playedAt,
				...(current.isSeeking ? {} : { position }),
			});
		}),
		TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
			useAudioStore.setState({
				error: event.message ?? "Audio playback failed",
				isLoading: false,
				isPlaying: false,
				pausedAt: Date.now(),
			});
		}),
		TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (event) => {
			const duration = useAudioStore.getState().duration;
      void useAudioStore
        .getState()
        .playNextAlbumTrack()
        .then((playedNext) => {
				if (playedNext) return;

				useAudioStore.setState({
					hasEnded: true,
					isPlaying: false,
					pausedAt: Date.now(),
					playSessionStartPosition: null,
					position: duration > 0 ? duration : secondsToMillis(event.position),
				});
				useAudioStore.getState().stopPositionTracking();
			});
		}),
		DeviceEventEmitter.addListener(
			REMOTE_PLAYBACK_SNAPSHOT_EVENT,
			(snapshot: RemotePlaybackSnapshot) => {
				const current = useAudioStore.getState();
				useAudioStore.setState(
					getRemotePlaybackStateUpdate({
						snapshot,
						current,
						now: Date.now(),
					}),
				);

				if (snapshot.isPlaying) {
					useAudioStore.getState().startPositionTracking();
				} else {
					useAudioStore.getState().stopPositionTracking();
				}
			},
		),
		AppState.addEventListener("change", (nextState) => {
			const state = useAudioStore.getState();
			if (
				nextState !== "active" ||
				(!state.sound && !state.activeTrackId)
			) {
				return;
			}
			void useAudioStore.getState().syncPlaybackSnapshot();
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
	await setupTrackPlayer(
		normalizePlaybackRate(useAudioStore.getState().playbackRate),
	);
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
	pausedAt: number | null;
	playedAt: number | null;
	publicAudioFolderUri: string | null;
	hasEnded: boolean;
	playMode: AudioPlayMode;
	albumQueue: ItemProps[] | null;
	shuffleHistory: string[];

  loadAudio: (
    blog: ItemProps,
    options?: { requestPublicFolder?: boolean },
  ) => Promise<void>;
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
			playSessionStartPosition: null,
			activeTrackId: null,
			blog: null!,
			publicAudioFolderUri: null,
			hasEnded: false,
			playMode: "off",
			albumQueue: null,
			shuffleHistory: [],

      loadAudio: async (blog, options) => {
				const directUrl = (blog?.audio as any)?.url as string | undefined;
				const fileName = blog?.audio?.fileName;
				const nextTrackId = String(blog?.id ?? fileName ?? directUrl ?? "");
				const incomingAlbumQueue = getAlbumQueueFromBlog(blog);
				const incomingAlbumId = getAlbumIdFromBlog(blog);
				const currentAlbumId = getAlbumIdFromBlog(get().blog);
				const nextAlbumQueue = incomingAlbumQueue?.length
					? incomingAlbumQueue
					: incomingAlbumId && incomingAlbumId === currentAlbumId
						? get().albumQueue
						: null;
        const shouldResetAlbumMode =
          !incomingAlbumId || !nextAlbumQueue?.length;

				try {
					const audioPlayability = getAudioPlayability(blog?.audio as any);
					if (!audioPlayability.canPlay) {
						throw new Error(
							audioPlayability.reason ?? "Audio cannot be played.",
						);
					}

					if (
						nextTrackId &&
						get().sound &&
						get().activeTrackId === nextTrackId
					) {
						set({
							albumQueue: nextAlbumQueue,
							blog,
							error: null,
							isLoading: false,
							playMode: shouldResetAlbumMode ? "off" : get().playMode,
              shuffleHistory: shouldResetAlbumMode ? [] : get().shuffleHistory,
						});
						try {
							await syncPlayerSnapshot();
						} catch (err) {
							console.warn("[audio] Failed to sync existing track:", err);
						}
						return;
					}

					if (!fileName) {
						throw new Error("Audio file name is not available");
					}

					set({
						downloadProgress: 0,
						error: null,
						isDownloading: false,
						isLoading: true,
						pausedAt: null,
						playSessionStartPosition: null,
						hasEnded: false,
						albumQueue: nextAlbumQueue,
						playMode: shouldResetAlbumMode ? "off" : get().playMode,
						shuffleHistory: shouldResetAlbumMode ? [] : get().shuffleHistory,
					});

					await preparePlayer();
					get().stopPositionTracking();

					const publicFileName = sanitizePublicFileName(fileName);
					let publicAudioFolderUri = get().publicAudioFolderUri;
					try {
            publicAudioFolderUri = await ensurePublicAudioFolder(
              publicAudioFolderUri,
              options?.requestPublicFolder ?? true,
            );
						if (publicAudioFolderUri !== get().publicAudioFolderUri) {
							set({ publicAudioFolderUri });
						}
					} catch (err) {
						console.warn("[audio] Downloads folder unavailable:", err);
						publicAudioFolderUri = null;
						set({ publicAudioFolderUri: null });
					}

					const publicAudioUri = publicAudioFolderUri
						? await getUsableSafFile(
								publicAudioFolderUri,
								publicFileName,
							).catch(() => null)
						: null;
          const privateAudioUri = await ensurePrivateAudioFile(publicFileName);
          const privateCachedAudioUri = await getUsableFileUri(privateAudioUri);
						const telegramUrl = blog?.audio?.telegramFileId
							? (await getTelegramFileUrl(blog.audio.telegramFileId))?.url
							: null;
						const sourceUrls = uniqueUrls([directUrl, telegramUrl]);
          let audioSource: string;
          let downloadTargetUri: string | null = null;

          if (privateCachedAudioUri) {
            audioSource = privateCachedAudioUri;
            set({ localPath: privateCachedAudioUri });
          } else {
            const copiedPublicAudioUri = publicAudioUri
              ? await copySafFileToPrivateFile(
                  publicAudioUri,
                  privateAudioUri,
                ).catch((err) => {
                  console.warn("[audio] Public audio import failed:", err);
                  return null;
                })
              : null;

            if (copiedPublicAudioUri) {
              audioSource = copiedPublicAudioUri;
              set({ localPath: copiedPublicAudioUri });
            } else if (sourceUrls.length > 0) {
						audioSource = sourceUrls[0];
              downloadTargetUri = privateAudioUri;
						set({
							downloadProgress: 0,
                isDownloading: true,
							localPath: null,
						});
            } else {
              throw new Error("Audio URL is not available");
            }
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
						isDownloading: Boolean(downloadTargetUri),
						isPlaying: false,
						hasEnded: false,
						playSessionStartPosition: null,
						position: 0,
						sound: LOADED_SOUND_MARKER,
						uri: audioSource,
					});

					if (downloadTargetUri) {
						set({ downloadProgress: 0, isDownloading: true });

						LegacyFileSystem.createDownloadResumable(
							audioSource,
							downloadTargetUri,
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
                  void copyPrivateFileToPublicFile(
                    result.uri,
                    publicAudioUri ? null : publicAudioFolderUri,
                    publicFileName,
                  );
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
                LegacyFileSystem.deleteAsync(downloadTargetUri, {
                  idempotent: true,
                }).catch(() => undefined);
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

			playNextAlbumTrack: async () => {
				if (!get().sound) return false;

				if (get().playMode === "repeat-one") {
					try {
						await preparePlayer();
						await TrackPlayer.seekTo(0);
						await TrackPlayer.play();
						set({
							error: null,
							hasEnded: false,
							isPlaying: true,
							pausedAt: null,
							playedAt: Date.now(),
							playSessionStartPosition: 0,
							position: 0,
						});
						get().startPositionTracking();
						return true;
					} catch (err) {
						set({
							error:
                err instanceof Error ? err.message : "Failed to repeat audio",
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
				if (!get().sound) return;

				try {
					await preparePlayer();
					await ensureNotificationPermission();
					const progress = await TrackPlayer.getProgress();
          const durationMs =
            secondsToMillis(progress.duration) || get().duration;
					const currentPositionMs = secondsToMillis(progress.position);
					const shouldRestart =
						get().hasEnded || isAtAudioEnd(currentPositionMs, durationMs);
					const playSessionStartPosition = shouldRestart
						? 0
						: currentPositionMs;

					if (shouldRestart) {
						await TrackPlayer.seekTo(0);
					}

					await TrackPlayer.play();
					set({
						error: null,
						hasEnded: false,
						isPlaying: true,
						pausedAt: null,
						playedAt: Date.now(),
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
						hasEnded: false,
						isPlaying: false,
						pausedAt: Date.now(),
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
						hasEnded: false,
						isPlaying: false,
						pausedAt: Date.now(),
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
					set({
						error: null,
						hasEnded: false,
						isSeeking: true,
						position: positionMillis,
					});
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
						hasEnded: false,
						isDownloading: false,
						isPlaying: false,
						localPath: null,
						albumQueue: null,
						pausedAt: null,
						playedAt: null,
						playMode: "off",
						playSessionStartPosition: null,
						position: 0,
						shuffleHistory: [],
						sound: null,
						uri: null,
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
					blog,
					isPlaying: wasPlaying,
					pausedAt,
					playedAt,
					position,
					volume,
					playbackRate: persistedPlaybackRate,
				} = get();
				const playbackRate = normalizePlaybackRate(persistedPlaybackRate);
				set({ playbackRate });

				try {
					await preparePlayer();
					const activeTrack = await TrackPlayer.getActiveTrack();
					if (activeTrack) {
						set({
							activeTrackId: String(
								activeTrack.id ?? get().activeTrackId ?? "",
							),
							error: null,
							isLoading: false,
							playbackRate,
							sound: LOADED_SOUND_MARKER,
						});
						await get().syncPlaybackSnapshot();
						return;
					}
				} catch (err) {
					console.warn("[audio] Failed to adopt active native track:", err);
				}

        if (!blog) return;

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
						activeTrackId: null,
						blog: null!,
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
						error: null,
						hasEnded: false,
						isLoading: true,
						isPlaying: false,
						pausedAt: wasPlaying ? Date.now() : effectivePausedAt,
						playedAt: effectivePlayedAt,
						playSessionStartPosition: null,
					});
          await get().loadAudio(blog, { requestPublicFolder: false });
          if (get().error || !get().sound) {
            throw new Error(get().error ?? "Failed to restore audio");
          }
					await TrackPlayer.setVolume(volume);
					await TrackPlayer.setRate(playbackRate);
					await TrackPlayer.seekTo(millisToSeconds(position));

					const progress = await TrackPlayer.getProgress();

					set({
						duration: secondsToMillis(progress.duration) || get().duration,
						hasEnded: false,
						isLoading: false,
						isPlaying: false,
						pausedAt: wasPlaying ? Date.now() : effectivePausedAt,
						position,
						sound: LOADED_SOUND_MARKER,
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
				try {
					await preparePlayer();
					const activeTrack = await TrackPlayer.getActiveTrack();
					if (!activeTrack) {
						set({ isPlaying: false, sound: null });
						get().stopPositionTracking();
						return;
					}

					set({
						activeTrackId: String(activeTrack.id ?? get().activeTrackId ?? ""),
						sound: LOADED_SOUND_MARKER,
					});
					const isPlaying = await syncPlayerSnapshot();
					if (isPlaying) {
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
				const playbackRate = normalizePlaybackRate(rate);
				set({ playbackRate });

				if (!get().sound) return;

				try {
					await preparePlayer();
					await TrackPlayer.setRate(playbackRate);
					await refreshTrackPlayerNotificationOptions(playbackRate);
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
				activeTrackId: state.activeTrackId,
				blog: state.blog,
				duration: state.duration,
				isPlaying: state.isPlaying,
				localPath: state.localPath,
				pausedAt: state.pausedAt,
				playedAt: state.playedAt,
				playbackRate: state.playbackRate,
				playMode: state.playMode,
				position: state.position,
				publicAudioFolderUri: state.publicAudioFolderUri,
				uri: state.uri,
				volume: state.volume,
			}),
		},
	),
);
