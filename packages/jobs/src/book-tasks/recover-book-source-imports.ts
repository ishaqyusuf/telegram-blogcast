import { db } from "@acme/db";
import { runs, schedules } from "@trigger.dev/sdk/v3";
import { finishSourceImport } from "../book-source-import";
import { dispatchSourceImport } from "../dispatch-source-import";

// Closes the database-write / Trigger-enqueue gap and reconciles hard-terminated runs.
export const recoverBookSourceImports = schedules.task({
	id: "recover-book-source-imports",
	cron: "*/5 * * * *",
	maxDuration: 60,
	run: async () => {
		const pending = await db.bookSourceImport.findMany({
			where: { status: "queued", runId: null, updatedAt: { lt: new Date(Date.now() - 60_000) } },
			orderBy: { updatedAt: "asc" },
			take: 20,
			select: { id: true, generation: true },
		});
		for (const job of pending) {
			try {
				await dispatchSourceImport(db, { importId: job.id, generation: job.generation });
			} catch {
				await db.bookSourceImport.updateMany({
					where: { id: job.id, generation: job.generation, status: "queued", runId: null },
					data: {
						updatedAt: new Date(),
						errorMessage: "Waiting for the import worker. Recovery will retry automatically.",
					},
				});
			}
		}
		const stale = await db.bookSourceImport.findMany({
			where: {
				status: { in: ["queued", "running"] },
				runId: { not: null },
				updatedAt: { lt: new Date(Date.now() - 10 * 60_000) },
			},
			orderBy: { updatedAt: "asc" },
			take: 20,
			select: { id: true, generation: true, runId: true },
		});
		let reconciled = 0;
		for (const job of stale) {
			try {
				const run = await runs.retrieve(job.runId!);
				if (!run.isFailed && !run.isCancelled && !run.isSuccess) {
					await db.bookSourceImport.updateMany({
						where: { id: job.id, generation: job.generation, status: { in: ["queued", "running"] } },
						data: { updatedAt: new Date() },
					});
					continue;
				}
				// A hard worker termination may bypass onFailure; never leave the job spinning.
				await finishSourceImport(db, { importId: job.id, generation: job.generation }, {
					status: run.isCancelled ? "cancelled" : "failed",
					errorCode: "worker",
					errorMessage: "The import worker stopped before finishing. Saved pages stay readable. Retry to continue.",
				});
				reconciled += 1;
			} catch {
				await db.bookSourceImport.updateMany({
					where: { id: job.id, generation: job.generation, status: { in: ["queued", "running"] } },
					data: { updatedAt: new Date() },
				});
			}
		}
		return { dispatched: pending.length, reconciled };
	},
});
