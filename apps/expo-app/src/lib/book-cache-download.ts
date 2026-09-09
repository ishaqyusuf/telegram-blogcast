export type BookDownloadManifest = {
	bookId: number; nameAr: string | null; nameEn: string | null; sourceBookId: number | null;
	maxPageId: number; totalPages: number; revision: string;
};
export type BookDownload = {
	scope: string; bookId: number; manifest: BookDownloadManifest;
	cursor: number; completed: number; chaptersSaved: boolean;
	status: "queued" | "running" | "paused" | "failed" | "complete";
	error: string | null;
	pauseReason?: "user" | "interrupted";
};

export function shouldResumeBookDownload(job: Pick<BookDownload, "status" | "pauseReason">) {
	return job.status === "queued" || job.status === "running" || (job.status === "paused" && job.pauseReason === "interrupted");
}

export async function runBookDownload(job: BookDownload, adapter: {
	saveChapters: () => Promise<void>;
	pageIds: (afterId: number, maxPageId: number) => Promise<{ id: number }[]>;
	savePage: (pageId: number) => Promise<void>;
	manifest: () => Promise<BookDownloadManifest>;
	checkpoint: (job: BookDownload) => Promise<void>;
}, signal: AbortSignal) {
	let current: BookDownload = { ...job, status: "running", error: null, pauseReason: undefined };
	const save = async (patch: Partial<BookDownload>) => {
		current = { ...current, ...patch };
		await adapter.checkpoint(current);
	};
	try {
		await save({});
		while (!signal.aborted) {
			const ids = await adapter.pageIds(current.cursor, current.manifest.maxPageId);
			if (!ids.length) break;
			for (const { id } of ids) {
				if (signal.aborted) break;
				if (!Number.isSafeInteger(id) || id <= current.cursor || id > current.manifest.maxPageId)
					throw new Error("The server returned an invalid download cursor.");
				await adapter.savePage(id);
				// Advancing only after the page transaction means restart safely repeats at most one page.
				await save({ cursor: id, completed: current.completed + 1 });
			}
		}
		if (signal.aborted) await save({ status: "paused", pauseReason: signal.reason === "user" ? "user" : "interrupted" });
		else {
			if (!current.chaptersSaved) {
				await adapter.saveChapters();
				await save({ chaptersSaved: true });
			}
			if (signal.aborted) throw new Error("Download paused.");
			const latest = await adapter.manifest();
			if (signal.aborted) throw new Error("Download paused.");
			if (latest.bookId !== current.bookId || latest.revision !== current.manifest.revision || latest.maxPageId !== current.manifest.maxPageId || latest.totalPages !== current.completed)
				throw new Error("The book changed during download. Saved pages are safe; restart to include the latest pages.");
			await save({ status: "complete" });
		}
	} catch (error) {
		await save({ status: signal.aborted ? "paused" : "failed", pauseReason: signal.aborted ? signal.reason === "user" ? "user" : "interrupted" : undefined, error: signal.aborted ? null : error instanceof Error ? error.message : "Book download failed." });
	}
	return current;
}
