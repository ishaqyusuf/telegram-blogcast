// Local development stand-in for the Trigger worker: processes queued book-source imports
// against an isolated localhost database. Never point this at a shared or production DB.
// Usage: KETABONLINE_LIVE_DATABASE_URL=postgresql://...@127.0.0.1:5432/db bun scripts/run-source-imports-locally.ts [--watch]
const target = process.env.KETABONLINE_LIVE_DATABASE_URL;
if (!target || !["127.0.0.1", "localhost"].includes(new URL(target).hostname))
	throw new Error("Set KETABONLINE_LIVE_DATABASE_URL to an isolated localhost PostgreSQL database.");
process.env.POSTGRES_URL = target;

const { db } = await import("@acme/db");
const { runBookSourceImport, finishSourceImport } = await import("../src/book-source-import");
const watch = process.argv.includes("--watch");

do {
	const jobs = await db.bookSourceImport.findMany({
		where: { status: "queued" },
		orderBy: { createdAt: "asc" },
		take: 5,
		select: { id: true, generation: true, sourceBookId: true },
	});
	for (const job of jobs) {
		const payload = { importId: job.id, generation: job.generation };
		try {
			console.log(JSON.stringify({ sourceBookId: job.sourceBookId, result: await runBookSourceImport(db, payload) }));
		} catch (error) {
			// Mirrors the Trigger task's failure hook after its retries are exhausted.
			await finishSourceImport(db, payload, {
				status: "failed",
				errorCode: "worker",
				errorMessage: "The import stopped before finishing. Saved pages stay readable. Retry to continue.",
			});
			console.error(job.sourceBookId, error instanceof Error ? error.message : error);
		}
	}
	if (watch) await new Promise((resolve) => setTimeout(resolve, 2_000));
} while (watch);
await db.$disconnect();
