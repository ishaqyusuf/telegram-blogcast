import type { Database } from "@acme/db";
import { tasks } from "@trigger.dev/sdk/v3";
import { SOURCE_IMPORT_TASK, type SourceImportPayload } from "./book-source-import";

export async function dispatchSourceImport(db: Database, payload: SourceImportPayload) {
	if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
		throw new Error("Book imports are not configured. Your request is saved; retry later.");
	}
	const run = await tasks.trigger(SOURCE_IMPORT_TASK, payload, {
		idempotencyKey: `book-source:${payload.importId}:${payload.generation}`,
		idempotencyKeyTTL: "7d",
		tags: [`book-source-import:${payload.importId}`],
	});
	await db.bookSourceImport.updateMany({
		where: { id: payload.importId, generation: payload.generation },
		data: { runId: run.id },
	});
	return run.id;
}
