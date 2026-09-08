import { db } from "@acme/db";
import { task } from "@trigger.dev/sdk/v3";
import {
	CHAPTER_IMPORT_TASK,
	importBookChapters,
	type ChapterImportPayload,
} from "../book-chapter-import";

export const importShamelaChapters = task({
	id: CHAPTER_IMPORT_TASK,
	maxDuration: 180,
	queue: { concurrencyLimit: 2 },
	retry: {
		maxAttempts: 3,
		minTimeoutInMs: 1000,
		maxTimeoutInMs: 10_000,
		factor: 2,
		randomize: true,
	},
	run: async (payload: ChapterImportPayload, { ctx }) => {
		await db.bookChapterImport.updateMany({
			where: {
				id: payload.importId,
				generation: payload.generation,
				status: { in: ["queued", "running"] },
			},
			data: { runId: ctx.run.id },
		});
		return importBookChapters(db, payload);
	},
	onFailure: async ({ payload }) => {
		await db.bookChapterImport.updateMany({
			where: {
				id: payload.importId,
				generation: payload.generation,
				status: { in: ["queued", "running"] },
			},
			data: {
				status: "failed",
				errorMessage:
					"Chapter import failed. Your saved pages are unchanged. Retry chapters.",
			},
		});
	},
});
