import TrackPlayer, { Event } from "react-native-track-player";

import { AUDIO_JUMP_SECONDS } from "./setup-track-player";

export async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const offset = event.interval ?? AUDIO_JUMP_SECONDS;
    await TrackPlayer.seekBy(-Math.abs(offset));
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const offset = event.interval ?? AUDIO_JUMP_SECONDS;
    await TrackPlayer.seekBy(Math.abs(offset));
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    TrackPlayer.seekTo(event.position);
  });

  TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
    if (event.paused || event.permanent) {
      TrackPlayer.pause();
    }
  });
}
