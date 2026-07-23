import * as Linking from "expo-linking";
import { DeviceEventEmitter } from "react-native";

import {
	type PlaybackServicePlayer,
	REMOTE_PLAYBACK_SNAPSHOT_EVENT,
	registerPlaybackServiceHandlers,
} from "./playback-service-handlers";
import { refreshTrackPlayerNotificationOptions } from "./setup-track-player";
import TrackPlayer, { State } from "./track-player-safe";

export async function playbackService() {
	registerPlaybackServiceHandlers({
		player: TrackPlayer as unknown as PlaybackServicePlayer,
		publishSnapshot: (snapshot) => {
			DeviceEventEmitter.emit(REMOTE_PLAYBACK_SNAPSHOT_EVENT, snapshot);
		},
		refreshNotificationOptions: refreshTrackPlayerNotificationOptions,
		isPlayingState: (state) =>
			state === State.Playing || state === State.Buffering,
		openComments: async (blogId) => {
			await Linking.openURL(
				Linking.createURL(`/blog-view-2/${blogId}`, {
					queryParams: { openComments: "1" },
				}),
			);
		},
	});
}
