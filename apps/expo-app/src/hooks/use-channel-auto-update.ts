import { useLocalServicesSession } from "@/components/local-services";
import {
	CHANNEL_AUTO_UPDATE_INTERVAL_MS,
	runChannelAutoUpdate,
} from "@/lib/channel-auto-update";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

export function useChannelAutoUpdate() {
	const enabled = useAppSettingsStore((s) => s.channelAutoUpdateEnabled);
	const selectedIds = useAppSettingsStore((s) => s.channelAutoUpdateIds);
	const { isEnabled, connectionStatus, localApiClient, activeGatewayUrl } =
		useLocalServicesSession();
	const inFlight = useRef(false);
	const lastAttempt = useRef({ key: "", time: 0 });

	useEffect(() => {
		// Local Services only enables after the persisted settings have hydrated.
		if (
			!enabled ||
			!isEnabled ||
			connectionStatus !== "online" ||
			!localApiClient ||
			selectedIds.length === 0
		)
			return;

		let cancelled = false;
		const key = JSON.stringify([activeGatewayUrl, selectedIds]);
		const isCurrent = () => !cancelled && AppState.currentState === "active";
		const check = async () => {
			if (!isCurrent() || inFlight.current) return;
			if (
				lastAttempt.current.key === key &&
				Date.now() - lastAttempt.current.time < CHANNEL_AUTO_UPDATE_INTERVAL_MS
			)
				return;
			lastAttempt.current = { key, time: Date.now() };
			inFlight.current = true;
			try {
				await runChannelAutoUpdate({
					selectedIds,
					isCurrent,
					getAuthStatus: () =>
						localApiClient.channel.telegramAuthStatus.query(),
					getSummary: () =>
						localApiClient.channel.getUpdatePromptSummary.query(),
					startJob: (input) =>
						localApiClient.channel.startRecentUpdateJob.mutate(input),
				});
			} catch (error) {
				// Offline/auth failures must never interrupt reading. Retry on the next check.
				console.warn("[channel-auto-update] check failed", error);
			} finally {
				inFlight.current = false;
			}
		};

		void check();
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") void check();
		});
		const timer = setInterval(() => void check(), 30_000);
		return () => {
			cancelled = true;
			clearInterval(timer);
			subscription.remove();
		};
	}, [
		activeGatewayUrl,
		connectionStatus,
		enabled,
		isEnabled,
		localApiClient,
		selectedIds,
	]);
}
