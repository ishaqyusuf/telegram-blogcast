export type TranscriptCacheSqliteValue =
	| string
	| number
	| null
	| boolean
	| Uint8Array;

/**
 * The smallest SQLite surface the cache needs. Keeping this boundary free of
 * Expo types lets repository behavior run against an in-memory SQLite adapter
 * in focused tests.
 */
export interface TranscriptCacheSqliteDatabase {
	exec(sql: string): Promise<void>;
	run(sql: string, params?: TranscriptCacheSqliteValue[]): Promise<void>;
	all<T>(sql: string, params?: TranscriptCacheSqliteValue[]): Promise<T[]>;
	first<T>(
		sql: string,
		params?: TranscriptCacheSqliteValue[],
	): Promise<T | null>;
	transaction<T>(
		task: (transaction: TranscriptCacheSqliteDatabase) => Promise<T>,
	): Promise<T>;
}
