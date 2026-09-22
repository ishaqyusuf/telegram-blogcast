import {
	type AudioDownloadIdentity,
	getDownloadedAudio,
	subscribeToAudioDownloads,
} from "@/lib/downloaded-audio";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function useDownloadedAudio({
	mediaId,
	blogId,
	fileName,
	size,
}: AudioDownloadIdentity) {
	const identity = `${mediaId}:${blogId}:${fileName}:${size}`;
	const [result, setResult] = useState<{
		identity: string;
		uri: string | null;
	}>();
	useEffect(() => {
		let generation = 0;
		let alive = true;
		const check = async () => {
			const request = ++generation;
			const uri = await getDownloadedAudio({
				mediaId,
				blogId,
				fileName,
				size,
			}).catch(() => null);
			if (alive && request === generation) setResult({ identity, uri });
		};
		void check();
		const unsubscribe = subscribeToAudioDownloads(() => {
			void check();
		});
		const appState = AppState.addEventListener("change", (state) => {
			if (state === "active") void check();
		});
		return () => {
			alive = false;
			unsubscribe();
			appState.remove();
		};
	}, [identity, mediaId, blogId, fileName, size]);
	return result?.identity === identity ? result.uri : null;
}
