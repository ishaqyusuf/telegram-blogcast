import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";
import { getBookCacheRepository } from "@/db/book-cache-db";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { getBookCacheScope } from "./book-cache-session";
import { runBookDownload, type BookDownload } from "./book-cache-download";
import { parseChapterFile } from "./book-cache-format";
import { withBookCacheDeadline } from "./book-cache-resource";
import { saveCachedReaderPage } from "./book-cache-reader";
import { notifyBookCacheChanged } from "./book-cache-events";
import { syncBookFolder } from "./book-cache-sync";
import { acquireBookCacheWorker } from "./book-cache-maintenance-state";

export const useBookDownloadProgress = create<{ active: BookDownload | null; requestedBookId: number | null; requestedScope: string | null; working: boolean; starting: boolean; error: string | null }>(() => ({ active: null, requestedBookId: null, requestedScope: null, working: false, starting: false, error: null }));
let running: Promise<void> | undefined;
let controller: AbortController | undefined;
export function pauseBookDownload(reason: "user" | "interrupted" = "user") { controller?.abort(reason); }

export function startBookDownload(bookId: number, restart = false) {
	if (running) return running;
	const release = acquireBookCacheWorker();
	if (!release) return Promise.resolve();
	const scope = getBookCacheScope();
	const abort = new AbortController();
	controller = abort;
	useBookDownloadProgress.setState({ requestedBookId: bookId, requestedScope: scope, working: true, starting: true, error: null });
	running = (async () => {
		const repository = await getBookCacheRepository();
		const network = await NetInfo.fetch();
		if (network.isConnected === false || network.isInternetReachable === false) throw new Error("Connect to the internet to download this book.");
		const check = () => {
			if (scope !== getBookCacheScope() || AppState.currentState !== "active") abort.abort();
			if (abort.signal.aborted) throw new Error("Download paused. Saved pages are safe.");
		};
		const fetchManifest = () => withBookCacheDeadline((signal) => vanillaTrpc.book.getBookDownloadManifest.query({ bookId }, { signal }), abort.signal);
		let job = restart ? null : await repository.readDownload(scope, bookId);
		if (!job || job.status === "complete") {
			check();
			const manifest = await fetchManifest();
			check();
			job = { scope, bookId, manifest, cursor: 0, completed: 0, chaptersSaved: false, status: "queued", error: null };
			await repository.saveDownload(job);
		}
		useBookDownloadProgress.setState({ active: job, starting: false });
		const app = AppState.addEventListener("change", (state) => { if (state !== "active") abort.abort(); });
		const net = NetInfo.addEventListener((state) => { if (state.isConnected === false || state.isInternetReachable === false) abort.abort(); });
		try {
			await runBookDownload(job, {
				async saveChapters() {
					check();
					const observedAt = Date.now();
					const snapshot = await withBookCacheDeadline((signal) => vanillaTrpc.bookChapter.tree.query({ bookId }, { signal }), abort.signal);
					check();
					if (!snapshot.cache?.complete) throw new Error("Capture the complete chapter tree before downloading this book.");
					const { exportable, ...meta } = snapshot.cache;
					const tree = parseChapterFile(JSON.stringify({ ...meta, nodes: snapshot.items }), bookId);
					await repository.saveChapters(scope, tree, observedAt, exportable);
					if (exportable) void syncBookFolder();
					notifyBookCacheChanged({ kind: "chapters", bookId });
				},
				async pageIds(afterId, maxPageId) {
					check();
					return withBookCacheDeadline((signal) => vanillaTrpc.book.getBookDownloadPageIds.query({ bookId, afterId, maxPageId, limit: 20 }, { signal }), abort.signal);
				},
				async savePage(pageId) {
					check();
					const observedAt = Date.now();
					const page = await withBookCacheDeadline((signal) => vanillaTrpc.book.getPage.query({ pageId }, { signal }), abort.signal);
					if (page.bookId !== bookId) throw new Error("Downloaded page belongs to a different book.");
					check();
					await saveCachedReaderPage(scope, page, observedAt);
				},
				manifest: fetchManifest,
				async checkpoint(value) {
					await repository.saveDownload(value);
					useBookDownloadProgress.setState({ active: value });
				},
			}, abort.signal);
		} finally { app.remove(); net(); }
	})().catch((error) => useBookDownloadProgress.setState({ error: error instanceof Error ? error.message : "Download failed." }))
		.finally(() => { running = undefined; controller = undefined; release(); useBookDownloadProgress.setState({ working: false, starting: false }); });
	return running;
}
