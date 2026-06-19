import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
} from "react-native-track-player";

let setupPromise: Promise<void> | null = null;

export const AUDIO_JUMP_SECONDS = 15;

const playerCapabilities = [
  Capability.Play,
  Capability.Pause,
  Capability.SeekTo,
  Capability.JumpBackward,
  Capability.JumpForward,
];

const mediaSessionCapabilities = [
  ...playerCapabilities,
  Capability.SkipToPrevious,
  Capability.SkipToNext,
];

export async function setupTrackPlayer() {
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
    capabilities: mediaSessionCapabilities,
    compactCapabilities: [
      Capability.JumpBackward,
      Capability.Play,
      Capability.Pause,
      Capability.JumpForward,
    ],
    forwardJumpInterval: AUDIO_JUMP_SECONDS,
    notificationCapabilities: playerCapabilities,
    progressUpdateEventInterval: 1,
  });
}
