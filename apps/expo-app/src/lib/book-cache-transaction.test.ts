import { expect, test } from "bun:test";
import { runBookCacheTransaction } from "./book-cache-transaction";

test("preserves the work error when native rollback also fails", async () => {
	const full = new Error("database or disk is full");
	await expect(runBookCacheTransaction(async (work) => {
		try { await work(null); }
		catch { throw new Error("cannot rollback - no transaction is active"); }
	}, async () => { throw full; })).rejects.toBe(full);
});

test("preserves a commit failure rather than returning uncommitted results", async () => {
	const commit = new Error("commit failed");
	await expect(runBookCacheTransaction(async (work) => {
		await work(null);
		throw commit;
	}, async () => 12)).rejects.toBe(commit);
});

test("returns successful results including undefined", async () => {
	const run = async (work: (db: number) => Promise<void>) => { await work(12); };
	expect(await runBookCacheTransaction(run, async (db) => db)).toBe(12);
	expect(await runBookCacheTransaction(run, async () => undefined)).toBeUndefined();
});
