import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  isTrackPlayerAvailable,
} from "./track-player-safe";

let setupPromise: Promise<void> | null = null;

export const AUDIO_JUMP_SECONDS = 5;

const playerCapabilities = [
  Capability.Play,
  Capability.Pause,
  Capability.SeekTo,
  Capability.SkipToPrevious,
  Capability.JumpBackward,
  Capability.JumpForward,
  Capability.SkipToNext,
];

const notificationCapabilities = [
  Capability.SkipToPrevious,
  Capability.JumpBackward,
  Capability.Play,
  Capability.JumpForward,
  Capability.SkipToNext,
];

const notificationSpeedIcon = require("../../../assets/notification/notification_speed_1x.png");
const notificationPlusIcon = require("../../../assets/notification/notification_plus.png");

export async function setupTrackPlayer() {
  if (!isTrackPlayerAvailable) {
    throw new Error(
      "Audio playback needs a fresh Expo development build with react-native-track-player included.",
    );
  }

  if (!setupPromise) {
    setupPromise = TrackPlayer.setupPlayer({
      androidAudioContentType: AndroidAudioContentType.Speech,
      autoHandleInterruptions: true,
      autoUpdateMetadata: true,
      minBuffer: 10,
      maxBuffer: 50,
      playBuffer: 1.5,
      backBuffer: 30,
    }).catch((error: unknown) => {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (code === "player_already_initialized") {
        return;
      }

      setupPromise = null;
      throw error;
    });
  }

  await setupPromise;

  await TrackPlayer.updateOptions({
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      alwaysPauseOnInterruption: true,
    },
    backwardJumpInterval: AUDIO_JUMP_SECONDS,
    capabilities: playerCapabilities,
    compactCapabilities: [
      Capability.JumpBackward,
      Capability.Play,
      Capability.JumpForward,
    ],
    forwardJumpInterval: AUDIO_JUMP_SECONDS,
    previousIcon: notificationSpeedIcon,
    nextIcon: notificationPlusIcon,
    notificationCapabilities,
    progressUpdateEventInterval: 0.25,
  });
}
