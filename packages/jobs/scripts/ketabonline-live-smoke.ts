// Opt-in live smoke test: imports real KetabOnline books into an isolated localhost database.
// Usage: KETABONLINE_LIVE_DATABASE_URL=postgresql://...@127.0.0.1:5432/db bun scripts/ketabonline-live-smoke.ts 29423 62952 500300
const target = process.env.KETABONLINE_LIVE_DATABASE_URL;
if (!target || !["127.0.0.1", "localhost"].includes(new URL(target).hostname))
	throw new Error("Set KETABONLINE_LIVE_DATABASE_URL to an isolated localhost PostgreSQL database.");
process.env.POSTGRES_URL = target;

const { db } = await import("@acme/db");
const { runBookSourceImport, sourceImportActiveKey } = await import("../src/book-source-import");

for (const sourceBookId of process.argv.slice(2).map(Number)) {
	await db.bookSourceImport.updateMany({
		where: { activeKey: sourceImportActiveKey("ketabonline", sourceBookId) },
		data: { activeKey: null, status: "cancelled" },
	});
	const job = await db.bookSourceImport.create({
		data: {
			provider: "ketabonline",
			sourceBookId,
			ownerHash: "0".repeat(64),
			activeKey: sourceImportActiveKey("ketabonline", sourceBookId),
		},
	});
	const started = performance.now();
	let result: unknown;
	try {
		result = await runBookSourceImport(db, { importId: job.id, generation: 1 });
	} catch (error) {
		result = { thrown: error instanceof Error ? error.message : String(error) };
	}
	const final = await db.bookSourceImport.findUniqueOrThrow({ where: { id: job.id } });
	const counts = final.bookId
		? {
				pages: await db.bookPage.count({ where: { bookId: final.bookId, deletedAt: null, status: "fetched" } }),
				chapters: await db.bookTocNode.count({ where: { bookId: final.bookId, deletedAt: null } }),
				volumes: await db.bookVolume.count({ where: { bookId: final.bookId, deletedAt: null } }),
			}
		: null;
	console.log(
		JSON.stringify({
			sourceBookId,
			wallMs: Math.round(performance.now() - started),
			result,
			status: final.status,
			phase: final.phase,
			errorCode: final.errorCode,
			errorMessage: final.errorMessage,
			bookId: final.bookId,
			counts,
			metrics: final.metricsJson,
		}),
	);
}
await db.$disconnect();
