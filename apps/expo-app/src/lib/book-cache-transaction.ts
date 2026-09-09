export async function runBookCacheTransaction<Database, Result>(
	run: (work: (database: Database) => Promise<void>) => Promise<void>,
	work: (database: Database) => Promise<Result>,
): Promise<Result> {
	let completed: { value: Result } | undefined;
	let failed: { error: unknown } | undefined;
	try {
		await run(async (database) => {
			try { completed = { value: await work(database) }; }
			catch (error) {
				failed = { error };
				throw error;
			}
		});
	} catch (error) {
		// SQLite can auto-rollback on SQLITE_FULL; Expo's extra rollback then masks it.
		throw failed ? failed.error : error;
	}
	if (!completed) throw new Error("Book cache transaction did not complete");
	return completed.value;
}
