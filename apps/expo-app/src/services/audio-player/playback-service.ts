import * as Linking from "expo-linking";

import { AUDIO_JUMP_SECONDS } from "./setup-track-player";
import TrackPlayer, { Event } from "./track-player-safe";

const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2];

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

async function cyclePlaybackRate() {
  const rate = await TrackPlayer.getRate();
  const currentIndex = SPEED_OPTIONS.findIndex(
    (option) => Math.abs(option - rate) < 0.01,
  );
  const nextRate = SPEED_OPTIONS[(currentIndex + 1) % SPEED_OPTIONS.length]!;
  await TrackPlayer.setRate(nextRate);
}

async function openCurrentTrackComments() {
  const track = await TrackPlayer.getActiveTrack();
  const blogId = (track as any)?.blogId ?? track?.id;
  if (!blogId) return;

  await Linking.openURL(
    Linking.createURL(`/blog-view-2/${blogId}`, {
      queryParams: { openComments: "1" },
    }),
  );
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
    runRemoteAction(cyclePlaybackRate);
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    runRemoteAction(openCurrentTrackComments);
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
