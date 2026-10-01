import { useFocusEffect } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useCallback, useId, useRef } from "react";

export function useFocusedKeepAwake() {
	const id = useId();
	const focusCount = useRef(0);

	useFocusEffect(
		useCallback(() => {
			// Each focus owns a separate lock so delayed cleanup cannot release a new one.
			const tag = `audio-screen-${id}-${++focusCount.current}`;
			const activation = activateKeepAwakeAsync(tag);
			void activation.catch(() => {
				console.warn("Unable to keep the audio screen awake.");
			});

			return () => {
				// Wait for acquisition if navigation leaves before the native call settles.
				void activation
					.then(() => deactivateKeepAwake(tag))
					.catch(() => undefined);
			};
		}, [id]),
	);
}
