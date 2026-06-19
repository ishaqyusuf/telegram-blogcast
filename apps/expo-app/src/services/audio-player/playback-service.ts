import TrackPlayer, { Event } from "react-native-track-player";

import { AUDIO_JUMP_SECONDS } from "./setup-track-player";

function runRemoteAction(action: () => Promise<void>) {
  action().catch((error) => {
    console.warn("[audio] remote action failed", error);
  });
}

async function seekBySeconds(offsetSeconds: number) {
  const progress = await TrackPlayer.getProgress();
  const duration = Number.isFinite(progress.duration) ? progress.duration : 0;
  const nextPosition = Math.max(
    0,
    duration > 0
      ? Math.min(duration, progress.position + offsetSeconds)
      : progress.position + offsetSeconds,
  );

  await TrackPlayer.seekTo(nextPosition);
}

export async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    runRemoteAction(() => TrackPlayer.play());
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    runRemoteAction(() => TrackPlayer.pause());
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    runRemoteAction(() => TrackPlayer.pause());
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    runRemoteAction(() => seekBySeconds(-AUDIO_JUMP_SECONDS));
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    runRemoteAction(() => seekBySeconds(AUDIO_JUMP_SECONDS));
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, (event) => {
    const offset = event.interval ?? AUDIO_JUMP_SECONDS;
    runRemoteAction(() => seekBySeconds(-Math.abs(offset)));
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, (event) => {
    const offset = event.interval ?? AUDIO_JUMP_SECONDS;
    runRemoteAction(() => seekBySeconds(Math.abs(offset)));
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    runRemoteAction(() => TrackPlayer.seekTo(event.position));
  });

  TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
    if (event.paused || event.permanent) {
      runRemoteAction(() => TrackPlayer.pause());
    }
  });
}
