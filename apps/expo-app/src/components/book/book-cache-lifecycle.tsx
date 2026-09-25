import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { getBookCacheRepository, getBookAnnotationRepository } from "@/db/book-cache-db";
import { cancelBookAnnotationSync, syncBookAnnotations } from "@/lib/book-annotation-service";
import { useAuthContext } from "@/hooks/use-auth";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { cancelBookFolderSync, syncBookFolder } from "@/lib/book-cache-sync";
import { pauseBookDownload, startBookDownload, useBookDownloadProgress } from "@/lib/book-cache-download-service";
import { useBookCacheMaintenance } from "@/lib/book-cache-maintenance-state";
import { shouldResumeBookDownload } from "@/lib/book-cache-download";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { withBookCacheDeadline } from "@/lib/book-cache-resource";

export function BookCacheLifecycle() {
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	useEffect(() => {
		let disposed = false;
		let checking = false;
		let lastAnnotationBook = 0;
		const lastManifestCheck = new Map<number, number>();
		async function resume() {
			if (disposed || checking || AppState.currentState !== "active" || useBookCacheMaintenance.getState().busy) return;
			checking = true;
			try {
				void syncBookFolder();
				if (useBookDownloadProgress.getState().working) return;
				const network = await NetInfo.fetch();
				if (network.isConnected === false || network.isInternetReachable === false) return;
				const books = await (await getBookAnnotationRepository()).pendingBooks(scope);
				const annotationBook = books.find((id) => id > lastAnnotationBook) ?? books[0];
				if (!disposed && annotationBook && AppState.currentState === "active") {
					lastAnnotationBook = annotationBook;
					void syncBookAnnotations(annotationBook, scope);
				}
				const jobs = await (await getBookCacheRepository()).listDownloads(scope);
				const pending = jobs.find(shouldResumeBookDownload);
				if (!disposed && pending && AppState.currentState === "active") {
					void startBookDownload(pending.bookId);
					return;
				}
				// A completed local copy checks the lightweight server revision when the
				// app is active. Download pages again only when the book changed.
				const now = Date.now();
				const complete = jobs.find((job) => job.status === "complete" && now - (lastManifestCheck.get(job.bookId) ?? 0) > 6 * 60 * 60_000);
				if (complete) {
					const abort = new AbortController();
					const latest = await withBookCacheDeadline((signal) => vanillaTrpc.book.getBookDownloadManifest.query({ bookId: complete.bookId }, { signal }), abort.signal);
					lastManifestCheck.set(complete.bookId, now);
					if (!disposed && AppState.currentState === "active" && latest.revision !== complete.manifest.revision) void startBookDownload(complete.bookId, true);
				}
			} catch (error) { console.warn("[Book cache] foreground recovery deferred", error); }
			finally { checking = false; }
		}
		const first = setTimeout(() => void resume(), 1_000);
		const timer = setInterval(() => void resume(), 60_000);
		const app = AppState.addEventListener("change", (state) => {
			if (state === "active") void resume();
			else { cancelBookFolderSync(false); pauseBookDownload("interrupted"); cancelBookAnnotationSync(); }
		});
		const net = NetInfo.addEventListener((state) => { if (state.isConnected && state.isInternetReachable !== false) void resume(); });
		return () => { disposed = true; clearTimeout(first); clearInterval(timer); app.remove(); net(); cancelBookFolderSync(false); pauseBookDownload("interrupted"); cancelBookAnnotationSync(); };
	}, [scope]);
	return null;
}
