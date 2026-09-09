import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBookCacheRepository } from "@/db/book-cache-db";
import { createAndroidBookFiles, getBookFolder } from "./book-cache-folder";
import { mirrorBookCache } from "./book-cache-mirror";
import { getBookCacheScope } from "./book-cache-session";
import { acquireBookCacheWorker } from "./book-cache-maintenance-state";

export const useBookFolderSync = create<{
	working: boolean; paused: boolean; saved: number; failed: number; error: string | null;
}>(() => ({ working: false, paused: false, saved: 0, failed: 0, error: null }));

let running: Promise<void> | undefined;
let controller: AbortController | undefined;

const pauseKey = "book-folder-sync-paused-v1";
let pausePersistence = Promise.resolve();
function persistPause(paused: boolean) {
	useBookFolderSync.setState({ paused });
	pausePersistence = pausePersistence.then(() => paused ? AsyncStorage.setItem(pauseKey, "true") : AsyncStorage.removeItem(pauseKey)).catch((error) => console.warn("[Book cache] could not persist pause", error));
	return pausePersistence;
}
export function cancelBookFolderSync(userInitiated = true) {
	controller?.abort();
	if (userInitiated) {
		void persistPause(true);
	}
}

export function syncBookFolder(manual = false) {
	if (running) return running;
	const release = acquireBookCacheWorker();
	if (!release) return Promise.resolve();
	const scope = getBookCacheScope();
	const abort = new AbortController();
	controller = abort;
	useBookFolderSync.setState({ working: true, saved: 0, failed: 0, error: null });
	running = (async () => {
		if (manual) await persistPause(false);
		else if (useBookFolderSync.getState().paused || await AsyncStorage.getItem(pauseKey) === "true") { useBookFolderSync.setState({ paused: true }); return; }
		const folder = await getBookFolder();
		if (!folder || abort.signal.aborted) return;
		const repository = await getBookCacheRepository();
		await repository.prepareMirrorDestination(scope, folder.uri);
		if (abort.signal.aborted || scope !== getBookCacheScope()) return;
		const files = createAndroidBookFiles(folder);
		await mirrorBookCache(repository, {
			...files,
			async write(path, content) {
				if (abort.signal.aborted || scope !== getBookCacheScope()) {
					abort.abort();
					throw new Error("Folder sync paused. Saved content is safe.");
				}
				return files.write(path, content);
			},
		}, scope, {
			signal: abort.signal,
			onProgress(saved, failed) { useBookFolderSync.setState({ saved, failed }); },
		});
	})().catch((error) => {
		useBookFolderSync.setState({ error: error instanceof Error ? error.message : "Book folder synchronization failed." });
	}).finally(() => {
		running = undefined;
		controller = undefined;
		release();
		useBookFolderSync.setState({ working: false });
	});
	return running;
}
