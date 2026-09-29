import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import {
	planPlayHistoryWrites,
	rememberSessionPosition,
} from "@/lib/play-history";
import { useAudioStore } from "@/store/audio-store";
import { useTRPC } from "@/trpc/client";
import { vanillaTrpc } from "@/trpc/vanilla-client";

const SAVE_INTERVAL_MS = 30_000;

function activeMediaId(state: ReturnType<typeof useAudioStore.getState>) {
	const mediaId = (state.blog?.audio as { mediaId?: number } | undefined)
		?.mediaId;
	return state.sound && typeof mediaId === "number" ? mediaId : null;
}

function snapshot(state: ReturnType<typeof useAudioStore.getState>) {
	return {
		mediaId: activeMediaId(state),
		isPlaying: state.isPlaying,
		isSeeking: state.isSeeking,
		position: state.position,
	};
}

/** Keep play history attached to the player, including feed, album, and system controls. */
export function usePlayHistorySync() {
	const queryClient = useQueryClient();
	const trpc = useTRPC();

	useEffect(() => {
		let previous = useAudioStore.getState();
		let lastSavedMediaId: number | null = null;
		let lastSavedPosition = -1;
		let lastSavedAt = 0;
		let pending = Promise.resolve();

		const save = (mediaId: number, progressMs: number) => {
			const position = Math.max(0, Math.round(progressMs));
			const now = Date.now();
			if (
				mediaId === lastSavedMediaId &&
				position === lastSavedPosition &&
				now - lastSavedAt < SAVE_INTERVAL_MS
			)
				return;

			lastSavedMediaId = mediaId;
			lastSavedPosition = position;
			lastSavedAt = now;
			rememberSessionPosition(mediaId, position);
			pending = pending
				.catch(() => undefined)
				.then(() =>
					vanillaTrpc.blog.savePlayHistory.mutate({
						mediaId,
						progressMs: position,
					}),
				)
				.then(() =>
					queryClient.invalidateQueries({
						queryKey: trpc.blog.getRecentlyPlayed.queryKey(),
					}),
				)
				.then(() => undefined)
				.catch((error) =>
					console.warn("[audio] Failed to save play history:", error),
				);
		};

		const unsubscribe = useAudioStore.subscribe((current) => {
			for (const write of planPlayHistoryWrites(
				snapshot(previous),
				snapshot(current),
			)) {
				save(write.mediaId, write.progressMs);
			}
			previous = current;
		});

		const interval = setInterval(() => {
			const state = useAudioStore.getState();
			const mediaId = activeMediaId(state);
			if (mediaId && state.isPlaying) save(mediaId, state.position);
		}, SAVE_INTERVAL_MS);

		const appState = AppState.addEventListener("change", (nextState) => {
			if (nextState === "active") return;
			const state = useAudioStore.getState();
			const mediaId = activeMediaId(state);
			if (mediaId) save(mediaId, state.position);
		});

		return () => {
			const state = useAudioStore.getState();
			const mediaId = activeMediaId(state);
			if (mediaId && state.isPlaying) save(mediaId, state.position);
			unsubscribe();
			clearInterval(interval);
			appState.remove();
		};
	}, [queryClient, trpc]);
}
