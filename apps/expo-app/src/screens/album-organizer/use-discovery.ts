import { _trpc } from "@/components/static-trpc";
import { useMutation, useQueryClient } from "@/lib/react-query";
import type { AlbumOrganizerModel } from "@/store/app-settings-store";
import { useEffect, useRef, useState } from "react";

export function useDiscovery(
	channelId: number,
	onReady: (runId: number) => void,
) {
	const qc = useQueryClient();
	const start = useMutation(
		_trpc.album.startOrganizerDiscovery.mutationOptions(),
	);
	const step = useMutation(
		_trpc.album.continueOrganizerDiscovery.mutationOptions(),
	);
	const active = useRef(false);
	const [running, setRunning] = useState(false);
	const [scanned, setScanned] = useState(0);
	const [error, setError] = useState("");
	useEffect(
		() => () => {
			active.current = false;
		},
		[],
	);
	async function generate(provider: AlbumOrganizerModel) {
		if (active.current) return;
		active.current = true;
		setRunning(true);
		setError("");
		try {
			let result = await start.mutateAsync({ channelId, provider });
			setScanned(result.mediaCount);
			while (active.current && result.scan && !result.scan.complete) {
				result = await step.mutateAsync({ runId: result.id });
				setScanned(result.mediaCount);
				if (result.scan?.lease)
					await new Promise((resolve) => setTimeout(resolve, 1500));
			}
			if (active.current && (!result.scan || result.scan.complete))
				onReady(result.id);
		} catch (cause) {
			if (active.current)
				setError(
					cause instanceof Error
						? cause.message
						: "Discovery paused. Retry to continue.",
				);
		} finally {
			active.current = false;
			setRunning(false);
			await Promise.all([
				qc.invalidateQueries({
					queryKey: _trpc.album.getAutomaticIndexChannelSummary.queryKey({
						channelId,
					}),
				}),
				qc.invalidateQueries({
					queryKey: _trpc.album.getAutomaticIndexRuns.queryKey(),
				}),
			]);
		}
	}
	return {
		generate,
		running,
		scanned,
		error,
		pause: () => {
			active.current = false;
		},
	};
}
