const { Platform } = require("react-native");
const {
	registerAndroidPlaybackService,
} = require("./src/services/audio-player/register-playback-service");

if (Platform.OS === "android") {
	const TrackPlayer = require("react-native-track-player").default;

	registerAndroidPlaybackService({
		platform: Platform.OS,
		register: (factory) => TrackPlayer.registerPlaybackService(factory),
		serviceFactory: () =>
			require("./src/services/audio-player/playback-service").playbackService,
	});
}

require("expo-router/entry");
