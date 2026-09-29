import * as FileSystem from "expo-file-system/legacy";
import { getMediaTargetUri, getLegacyAndroidMediaTargetUri, getUsableCachedMediaUri } from "./media-cache";

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
		const target = {
			cacheKey,
			fileName: input.fileName,
			kind: "audio",
		} as const;
		const candidates = new Set([
			await getMediaTargetUri(target),
			await getLegacyAndroidMediaTargetUri(target),
		]);
		for (const uri of candidates) {
			if (!uri) continue;
			const found = await getUsableCachedMediaUri(uri);
			if (!found) continue;
			const info = await FileSystem.getInfoAsync(uri);
			if (!info.exists) continue;
			// Old direct-to-final writes require a known size to prove completion.
			if (input.size && input.size > 0 && info.size !== input.size) continue;
			if (typeof cacheKey === "number" && !(input.size && input.size > 0))
				continue;
			return uri;
		}
		// A source filename can change without changing the media ID. Recover a
		// previously verified final file by stable ID when its size is known.
		if (typeof cacheKey === "string" && input.size && input.size > 0) {
			for (const targetUri of candidates) {
				if (!targetUri) continue;
				const directory = targetUri.slice(0, targetUri.lastIndexOf("/"));
				const names = await FileSystem.readDirectoryAsync(directory).catch(() => []);
				for (const name of names) {
					if (!name.startsWith(`${cacheKey}-`) || name.endsWith(".part")) continue;
					const uri = `${directory}/${name}`;
					const info = await FileSystem.getInfoAsync(uri).catch(() => null);
					if (info?.exists && info.size === input.size) return uri;
				}
			}
		}
	}
	return null;
}
