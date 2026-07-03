import type {
  State as NativeTrackPlayerState,
  Track,
} from "react-native-track-player";

type TrackPlayerModule = typeof import("react-native-track-player");
type TrackPlayerApi = TrackPlayerModule["default"];

export type { Track };
export type TrackPlayerState = NativeTrackPlayerState;

const unavailableMessage =
  "Native audio player is unavailable. Rebuild the Expo development client so react-native-track-player is included.";

let nativeModule: TrackPlayerModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nativeModule = require("react-native-track-player") as TrackPlayerModule;
} catch (error) {
  console.warn("[audio] TrackPlayer native module unavailable", error);
}

function createUnavailableTrackPlayer(): TrackPlayerApi {
  const unavailable = async () => {
    throw new Error(unavailableMessage);
  };

  return {
    add: unavailable,
    addEventListener: () => ({ remove: () => undefined }),
    getActiveTrack: async () => undefined,
    getPlaybackState: async () => ({ state: State.None }),
    getProgress: async () => ({ buffered: 0, duration: 0, position: 0 }),
    getRate: async () => 1,
    pause: unavailable,
    play: unavailable,
    registerPlaybackService: () => undefined,
    reset: unavailable,
    seekTo: unavailable,
    setRate: unavailable,
    setVolume: unavailable,
    setupPlayer: unavailable,
    updateOptions: unavailable,
  } as unknown as TrackPlayerApi;
}

export const isTrackPlayerAvailable = Boolean(nativeModule?.default);

export const AndroidAudioContentType =
  nativeModule?.AndroidAudioContentType ??
  ({
    Speech: "speech",
  } as unknown as TrackPlayerModule["AndroidAudioContentType"]);

export const AppKilledPlaybackBehavior =
  nativeModule?.AppKilledPlaybackBehavior ??
  ({
    ContinuePlayback: "continue-playback",
  } as unknown as TrackPlayerModule["AppKilledPlaybackBehavior"]);

export const Capability =
  nativeModule?.Capability ??
  ({
    JumpBackward: "jump-backward",
    JumpForward: "jump-forward",
    Pause: "pause",
    Play: "play",
    SeekTo: "seek-to",
    SkipToNext: "skip-to-next",
    SkipToPrevious: "skip-to-previous",
  } as unknown as TrackPlayerModule["Capability"]);

export const Event =
  nativeModule?.Event ??
  ({
    PlaybackError: "playback-error",
    PlaybackProgressUpdated: "playback-progress-updated",
    PlaybackQueueEnded: "playback-queue-ended",
    PlaybackState: "playback-state",
    RemoteDuck: "remote-duck",
    RemoteJumpBackward: "remote-jump-backward",
    RemoteJumpForward: "remote-jump-forward",
    RemoteNext: "remote-next",
    RemotePause: "remote-pause",
    RemotePlay: "remote-play",
    RemotePrevious: "remote-previous",
    RemoteSeek: "remote-seek",
    RemoteStop: "remote-stop",
  } as unknown as TrackPlayerModule["Event"]);

export const State =
  nativeModule?.State ??
  ({
    Buffering: "buffering",
    Ended: "ended",
    Loading: "loading",
    None: "none",
    Paused: "paused",
    Playing: "playing",
    Ready: "ready",
    Stopped: "stopped",
  } as unknown as TrackPlayerModule["State"]);

const TrackPlayer = nativeModule?.default ?? createUnavailableTrackPlayer();

export default TrackPlayer;
