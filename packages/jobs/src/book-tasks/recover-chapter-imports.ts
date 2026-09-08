import { db } from "@acme/db";
import { runs, schedules } from "@trigger.dev/sdk/v3";
import { dispatchChapterImport } from "../dispatch-chapter-import";

// Closes the database-write / Trigger-enqueue gap without relying on mobile polling.
export const recoverChapterImports = schedules.task({
	id: "recover-chapter-imports",
	cron: "*/5 * * * *",
	maxDuration: 60,
	run: async () => {
		const pending = await db.bookChapterImport.findMany({
			where: {
				status: "queued",
				runId: null,
				updatedAt: { lt: new Date(Date.now() - 60_000) },
			},
			orderBy: { updatedAt: "asc" },
			take: 20,
			select: { id: true, generation: true },
		});
		for (const job of pending) {
			try {
				await dispatchChapterImport(db, {
					importId: job.id,
					generation: job.generation,
				});
			} catch {
				await db.bookChapterImport.updateMany({
					where: {
						id: job.id,
						generation: job.generation,
						status: "queued",
						runId: null,
					},
					data: {
						updatedAt: new Date(),
						errorMessage:
							"Worker submission is delayed. Recovery will retry automatically.",
					},
				});
			}
		}
		const stale = await db.bookChapterImport.findMany({
			where: {
				status: { in: ["queued", "running"] },
				runId: { not: null },
				updatedAt: { lt: new Date(Date.now() - 5 * 60_000) },
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
					await db.bookChapterImport.updateMany({
						where: {
							id: job.id,
							generation: job.generation,
							status: { in: ["queued", "running"] },
						},
						data: { updatedAt: new Date() },
					});
					continue;
				}
				// A hard worker termination may bypass onFailure. Never leave that run spinning forever.
				await db.bookChapterImport.updateMany({
					where: {
						id: job.id,
						generation: job.generation,
						status: { in: ["queued", "running"] },
					},
					data: {
						status: run.isCancelled ? "cancelled" : "failed",
						errorMessage:
							"The chapter worker stopped before completion. Your saved pages are unchanged. Retry chapters.",
					},
				});
				reconciled += 1;
			} catch {
				await db.bookChapterImport.updateMany({
					where: {
						id: job.id,
						generation: job.generation,
						status: { in: ["queued", "running"] },
					},
					data: {
						updatedAt: new Date(),
						errorMessage:
							"Worker status is temporarily unavailable. Recovery will retry automatically.",
					},
				});
			}
		}
		return { dispatched: pending.length, reconciled };
	},
});
