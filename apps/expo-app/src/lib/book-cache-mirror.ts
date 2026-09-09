import { bookCachePaths, parseChapterFile, parsePageFile } from "./book-cache-format";
import { writeRecoverableBookFile, type BookFileAccess } from "./book-cache-files";
import type { createBookCacheRepository } from "./book-cache-repository";

type Repository = ReturnType<typeof createBookCacheRepository>;

export async function mirrorBookCache(
	repository: Repository,
	files: BookFileAccess,
	scope: string,
	options: { signal?: AbortSignal; onProgress?: (saved: number, failed: number) => void } = {},
) {
	const attempted = new Set<string>();
	let saved = 0;
	let failed = 0;
	while (!options.signal?.aborted && attempted.size < 100) {
		const jobs = (await repository.pendingMirrors(scope)).filter((job) => !attempted.has(`${job.kind}:${job.entity_id}:${job.generation}`));
		if (!jobs.length) break;
		for (const job of jobs) {
			if (options.signal?.aborted || attempted.size >= 100) break;
			attempted.add(`${job.kind}:${job.entity_id}:${job.generation}`);
			try {
				const text = await repository.mirrorPayload(job);
				if (!text) continue;
				const paths = bookCachePaths(job.book_id, job.kind === "page" ? job.entity_id : 1);
				const validate = (content: string) => job.kind === "page"
					? parsePageFile(content, { bookId: job.book_id, pageId: job.entity_id })
					: parseChapterFile(content, job.book_id);
				const value = validate(text);
				await writeRecoverableBookFile(files, job.kind === "page" ? paths.page : paths.chapters, text, validate);
				const manifest = JSON.stringify({ formatVersion: 1, bookId: job.book_id, sourceBookId: value.sourceBookId });
				await writeRecoverableBookFile(files, paths.manifest, manifest, (input) => {
					const parsed = JSON.parse(input);
					if (parsed.formatVersion !== 1 || parsed.bookId !== job.book_id || parsed.sourceBookId !== value.sourceBookId)
						throw new Error("Book manifest identity mismatch");
					return parsed;
				});
				await repository.acknowledgeMirror(job);
				saved++;
			} catch (error) {
				failed++;
				await repository.failMirror(job, error instanceof Error ? error.message : "Could not write the book folder.");
			}
			options.onProgress?.(saved, failed);
		}
	}
	return { saved, failed, cancelled: options.signal?.aborted ?? false };
}
