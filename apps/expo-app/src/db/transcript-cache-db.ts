import {
	type SQLiteDatabase,
	deleteDatabaseSync,
	openDatabaseSync,
} from "expo-sqlite";

import { createTranscriptCacheRepository } from "./transcript-cache-repository";
import type { TranscriptCacheRepository } from "./transcript-cache-repository";
import {
	migrateTranscriptCache,
	rebuildTranscriptCacheSchema,
} from "./transcript-cache-schema";
import type {
	TranscriptCacheSqliteDatabase,
	TranscriptCacheSqliteValue,
} from "./transcript-cache-sqlite";

export const TRANSCRIPT_CACHE_DATABASE_NAME = "al_ghurobaa_cache.db";

function createExpoSqliteAdapter(
	database: SQLiteDatabase,
): TranscriptCacheSqliteDatabase {
	return {
		exec: (sql) => database.execAsync(sql),
		run: (sql, params = []) =>
			database
				.runAsync(sql, params as TranscriptCacheSqliteValue[])
				.then(() => undefined),
		all: <T>(sql: string, params: TranscriptCacheSqliteValue[] = []) =>
			database.getAllAsync<T>(sql, params),
		first: <T>(sql: string, params: TranscriptCacheSqliteValue[] = []) =>
			database.getFirstAsync<T>(sql, params),
		transaction: async <T>(
			task: (transaction: TranscriptCacheSqliteDatabase) => Promise<T>,
		) => {
			let result!: T;
			await database.withExclusiveTransactionAsync(async (transaction) => {
				result = await task(createExpoSqliteAdapter(transaction));
			});
			return result;
		},
	};
}

export type OpenTranscriptCache = TranscriptCacheRepository & {
	close(): Promise<void>;
	rebuild(): Promise<void>;
};

async function openTranscriptCacheDatabase(databaseName: string) {
	const database = openDatabaseSync(databaseName, {
		enableChangeListener: true,
	});
	const adapter = createExpoSqliteAdapter(database);

	try {
		await adapter.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
		await migrateTranscriptCache(adapter);
	} catch (error) {
		try {
			await database.closeAsync();
		} catch {
			// Preserve the migration error; recovery is explicit below.
		}
		throw error;
	}

	const repository = createTranscriptCacheRepository(adapter);
	return Object.assign(repository, {
		close: () => database.closeAsync(),
		rebuild: () => rebuildTranscriptCacheSchema(adapter),
	});
}

let defaultCachePromise: Promise<OpenTranscriptCache> | null = null;

/** Open the durable app-private cache, migrating it before use. */
export function getTranscriptCache() {
	if (!defaultCachePromise) {
		defaultCachePromise = openTranscriptCacheDatabase(
			TRANSCRIPT_CACHE_DATABASE_NAME,
		).catch((error) => {
			defaultCachePromise = null;
			throw error;
		});
	}
	return defaultCachePromise;
}

/**
 * Recreate the disposable cache file after a corruption or unsupported schema
 * error. The PostgreSQL/server transcript remains authoritative.
 */
export async function recoverTranscriptCache() {
	const current = defaultCachePromise;
	defaultCachePromise = null;

	if (current) {
		try {
			const cache = await current;
			await cache.close();
		} catch {
			// The failed opener closes its own handle; a previously opened cache can
			// still be closed by the successful branch above.
		}
	}

	try {
		deleteDatabaseSync(TRANSCRIPT_CACHE_DATABASE_NAME);
	} catch {
		// The file may not exist yet. The subsequent open creates it.
	}

	return getTranscriptCache();
}
