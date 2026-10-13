import { db } from "@acme/db";
import { task } from "@trigger.dev/sdk/v3";
import {
	finishSourceImport,
	runBookSourceImport,
	SOURCE_IMPORT_TASK,
	type SourceImportPayload,
} from "../book-source-import";

// Whole-book imports parse up to a 160 MB archive member; the measured 70 MB sample peaked
// near 400 MB RSS, so the worker gets 2 GB and imports run one at a time.
export const importBookSource = task({
	id: SOURCE_IMPORT_TASK,
	machine: "medium-1x",
	maxDuration: 900,
	queue: { concurrencyLimit: 1 },
	retry: {
		maxAttempts: 3,
		minTimeoutInMs: 5_000,
		maxTimeoutInMs: 60_000,
		factor: 2,
		randomize: true,
	},
	run: async (payload: SourceImportPayload, { ctx }) => {
		await db.bookSourceImport.updateMany({
			where: {
				id: payload.importId,
				generation: payload.generation,
				status: { in: ["queued", "running"] },
			},
			data: { runId: ctx.run.id },
		});
		return runBookSourceImport(db, payload);
	},
	onFailure: async ({ payload }) => {
		await finishSourceImport(db, payload, {
			status: "failed",
			errorCode: "worker",
			errorMessage:
				"The import stopped before finishing. Saved pages stay readable. Retry to continue.",
		});
	},
});
