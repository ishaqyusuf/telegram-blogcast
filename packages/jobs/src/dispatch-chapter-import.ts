import type { Database } from "@acme/db";
import { tasks } from "@trigger.dev/sdk/v3";
import {
	CHAPTER_IMPORT_TASK,
	type ChapterImportPayload,
} from "./book-chapter-import";

export async function dispatchChapterImport(
	db: Database,
	payload: ChapterImportPayload,
) {
	if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
		throw new Error(
			"Chapter imports are not configured. Your capture is saved; retry later.",
		);
	}
	const run = await tasks.trigger(CHAPTER_IMPORT_TASK, payload, {
		idempotencyKey: `chapters:${payload.importId}:${payload.generation}`,
		idempotencyKeyTTL: "7d",
		tags: [`chapter-import:${payload.importId}`],
	});
	await db.bookChapterImport.updateMany({
		where: { id: payload.importId, generation: payload.generation },
		data: { runId: run.id },
	});
	return run.id;
}
