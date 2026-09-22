import * as FileSystem from "expo-file-system/legacy";
import { getMediaTargetUri, getUsableCachedMediaUri } from "./media-cache";

export type AudioDownloadIdentity = {
	mediaId?: number | null;
	blogId?: number | null;
	fileName?: string | null;
	size?: number | null;
};
const listeners = new Set<() => void>();
export const subscribeToAudioDownloads = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};
export const notifyAudioDownloadsChanged = () => {
	for (const listener of listeners) listener();
};

export async function getDownloadedAudio(input: AudioDownloadIdentity) {
	if (!input.fileName || (!input.mediaId && !input.blogId)) return null;
	const keys = [
		input.mediaId ? `media-${input.mediaId}` : null,
		input.blogId,
	].filter((key): key is string | number => key != null);
	for (const cacheKey of keys) {
		const uri = await getMediaTargetUri({
			cacheKey,
			fileName: input.fileName,
			kind: "audio",
		});
		const found = await getUsableCachedMediaUri(uri);
		if (!found) continue;
		const info = await FileSystem.getInfoAsync(uri);
		if (!info.exists) continue;
		// New files are atomically promoted. Adopt old downloads only when their
		// server-provided length proves that the old direct-to-final write finished.
		if (input.size && input.size > 0 && info.size !== input.size) continue;
		if (typeof cacheKey === "number" && !(input.size && input.size > 0))
			continue;
		return uri;
	}
	return null;
}
