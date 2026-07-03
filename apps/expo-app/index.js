try {
  const TrackPlayer = require("react-native-track-player").default;

  TrackPlayer?.registerPlaybackService?.(
    () => require("./src/services/audio-player/playback-service").playbackService,
  );
} catch (error) {
  console.warn("[audio] Skipping TrackPlayer service registration", error);
}

require("expo-router/entry");
