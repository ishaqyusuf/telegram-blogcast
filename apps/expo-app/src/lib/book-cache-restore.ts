import { bookCachePaths, parseChapterFile, parsePageFile } from "./book-cache-format";
import { readRecoverableBookFile, type BookFileAccess } from "./book-cache-files";
import type { createBookCacheRepository } from "./book-cache-repository";

export async function restoreBookFiles(files: BookFileAccess, repository: ReturnType<typeof createBookCacheRepository>, scope: string, bookId: number, options: { signal?: AbortSignal; onProgress?: (restored: number, skipped: number, failed: number) => void } = {}) {
	const paths = bookCachePaths(bookId, 1);
	if (!files.list) throw new Error("This folder does not support restoration.");
	const manifest = await readRecoverableBookFile(files, paths.manifest, (text) => {
		const value = JSON.parse(text);
		if (value.formatVersion !== 1 || value.bookId !== bookId || !Number.isSafeInteger(value.sourceBookId) || value.sourceBookId < 1)
			throw new Error("Invalid public-book manifest or source identity.");
		return value as { bookId: number; sourceBookId: number };
	});
	if (!manifest) throw new Error("A valid book manifest is required for restoration.");
	const ids = [...new Set((await files.list(`${paths.book}/pages`)).flatMap((name) => {
		const match = name.match(/^page-([1-9]\d*)\.json(?:\.previous)?$/);
		const id = match ? Number(match[1]) : 0;
		return Number.isSafeInteger(id) && id > 0 ? [id] : [];
	}))].sort((a, b) => a - b);
	let restored = 0, skipped = 0, failed = 0, chaptersRestored = false;
	const errors: string[] = [];
	const report = (error: unknown) => { failed++; if (errors.length < 10) errors.push(error instanceof Error ? error.message : "Could not restore a file."); };
	for (const pageId of ids) {
		if (options.signal?.aborted) break;
		try {
			if (await repository.readPage(scope, bookId, pageId)) { skipped++; continue; }
			const saved = await readRecoverableBookFile(files, bookCachePaths(bookId, pageId).page, (text) => parsePageFile(text, { bookId, pageId }));
			if (!saved || saved.value.sourceBookId !== manifest.value.sourceBookId) throw new Error(`Page ${pageId} does not match the book manifest.`);
			if (options.signal?.aborted) break;
			// No server metadata or mirror job: restored files stay local and unverified until an online refresh.
			if (await repository.savePage(scope, saved.value, 0, false, undefined, true)) restored++;
			else skipped++;
		} catch (error) { report(error); }
		options.onProgress?.(restored, skipped, failed);
	}
	if (!options.signal?.aborted && !await repository.readChapters(scope, bookId)) {
		try {
			const tree = await readRecoverableBookFile(files, paths.chapters, (text) => parseChapterFile(text, bookId));
			if (tree && !options.signal?.aborted) {
				if (tree.value.sourceBookId !== manifest.value.sourceBookId) throw new Error("Chapters do not match the book manifest.");
				chaptersRestored = await repository.saveChapters(scope, tree.value, 0, false, true);
			}
		} catch (error) { report(error); }
	}
	return { restored, skipped, failed, errors, chaptersRestored, cancelled: options.signal?.aborted ?? false };
}
