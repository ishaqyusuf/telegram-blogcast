import { initLocalDb, localSqlite, withLocalDbRetry } from "./local-db";
import { createBookCacheRepository, type CacheSqlite } from "../lib/book-cache-repository";
import { createBookAnnotationRepository } from "../lib/book-annotation-repository";
import { runBookCacheTransaction } from "../lib/book-cache-transaction";

const transaction = async <T>(work: (db: CacheSqlite) => Promise<T>) => {
	await initLocalDb();
	return withLocalDbRetry(() => runBookCacheTransaction<CacheSqlite, T>(
		(run) => localSqlite.withExclusiveTransactionAsync(run), work,
	));
};
const repository = createBookCacheRepository(localSqlite, transaction);
const annotations = createBookAnnotationRepository(localSqlite, transaction);

export async function getBookAnnotationRepository() {
	await annotations.initialize();
	return annotations;
}

/** Uses the existing database, without relocating its live DB/WAL files. */
export async function getBookCacheRepository() {
	await repository.initialize();
	return repository;
}
