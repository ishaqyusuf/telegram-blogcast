const { Platform } = require("react-native");

if (Platform.OS === "android") {
  const TrackPlayer = require("react-native-track-player").default;

  TrackPlayer.registerPlaybackService(
    () =>
      require("./src/services/audio-player/playback-service").playbackService,
  );
}

require("expo-router/entry");
