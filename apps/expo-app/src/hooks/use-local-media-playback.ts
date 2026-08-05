import { getWebUrl } from "@/lib/base-url";
import { getLocalMediaClientId } from "@/lib/local-media-installation";
import { prepareLocalMediaPlayback } from "@/lib/local-media-playback";
import { useCallback, useEffect, useState } from "react";

export type LocalMediaPlaybackState = {
	state: "idle" | "offline" | "preparing" | "ready" | "unavailable" | "error";
	url: string | null;
	progress: number;
	error: string | null;
};

const INITIAL_STATE: LocalMediaPlaybackState = {
	state: "idle",
	url: null,
	progress: 0,
	error: null,
};

export function useLocalMediaPlayback(input: {
	mediaId?: number | null;
	required: boolean;
	localServicesEnabled: boolean;
	gatewayBaseUrl?: string | null;
}) {
	const [retryKey, setRetryKey] = useState(0);
	const [playback, setPlayback] =
		useState<LocalMediaPlaybackState>(INITIAL_STATE);

	// biome-ignore lint/correctness/useExhaustiveDependencies: retryKey intentionally restarts preparation after a user retry.
	useEffect(() => {
		const mediaId = input.mediaId;
		const gatewayBaseUrl = input.gatewayBaseUrl;
		if (!input.required || !mediaId) {
			setPlayback(INITIAL_STATE);
			return;
		}
		if (!input.localServicesEnabled || !gatewayBaseUrl) {
			setPlayback({
				state: "offline",
				url: null,
				progress: 0,
				error: null,
			});
			return;
		}

		const controller = new AbortController();
		setPlayback({
			state: "preparing",
			url: null,
			progress: 0,
			error: null,
		});
		void getLocalMediaClientId()
			.then((clientId) =>
				prepareLocalMediaPlayback({
					mediaId,
					clientId,
					productionBaseUrl: getWebUrl(),
					gatewayBaseUrl,
					signal: controller.signal,
					onProgress: (progress) => {
						setPlayback((current) => ({
							...current,
							state: "preparing",
							progress,
						}));
					},
				}),
			)
			.then((result) => {
				if (controller.signal.aborted) return;
				setPlayback({
					state: result.state,
					url: result.url,
					progress: result.state === "ready" ? 1 : 0,
					error: null,
				});
			})
			.catch((error) => {
				if (controller.signal.aborted) return;
				setPlayback({
					state: "error",
					url: null,
					progress: 0,
					error:
						error instanceof Error
							? error.message
							: "Large media preparation failed.",
				});
			});

		return () => controller.abort();
	}, [
		input.gatewayBaseUrl,
		input.localServicesEnabled,
		input.mediaId,
		input.required,
		retryKey,
	]);

	const retry = useCallback(() => setRetryKey((current) => current + 1), []);
	return { ...playback, retry };
}
