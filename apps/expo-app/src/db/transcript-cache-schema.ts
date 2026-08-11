import type { TranscriptCacheSqliteDatabase } from "./transcript-cache-sqlite";

export const TRANSCRIPT_CACHE_SCHEMA_VERSION = 1;

export const TRANSCRIPT_CACHE_TABLES = {
	metadata: "transcript_cache_metadata",
	windows: "transcript_cache_windows",
	segments: "transcript_cache_segments",
} as const;

type CacheMigration = {
	version: number;
	name: string;
	up: (database: TranscriptCacheSqliteDatabase) => Promise<void>;
};

const migrations: CacheMigration[] = [
	{
		version: 1,
		name: "create transcript cache tables",
		async up(database) {
			await database.exec(`
        CREATE TABLE IF NOT EXISTS ${TRANSCRIPT_CACHE_TABLES.metadata} (
          media_id INTEGER PRIMARY KEY NOT NULL,
          transcript_id INTEGER,
          transcript_updated_at INTEGER,
          status TEXT,
          duration_sec REAL,
          segment_count INTEGER NOT NULL DEFAULT 0 CHECK (segment_count >= 0),
          max_end_sec REAL NOT NULL DEFAULT 0 CHECK (max_end_sec >= 0),
          cached_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${TRANSCRIPT_CACHE_TABLES.windows} (
          media_id INTEGER NOT NULL,
          window_start_sec REAL NOT NULL,
          window_end_sec REAL NOT NULL,
          transcript_id INTEGER,
          transcript_updated_at INTEGER,
          status TEXT,
          duration_sec REAL,
          segment_count INTEGER NOT NULL DEFAULT 0 CHECK (segment_count >= 0),
          max_end_sec REAL NOT NULL DEFAULT 0 CHECK (max_end_sec >= 0),
          previous_window_start_sec REAL,
          next_window_start_sec REAL,
          has_previous INTEGER NOT NULL DEFAULT 0 CHECK (has_previous IN (0, 1)),
          has_next INTEGER NOT NULL DEFAULT 0 CHECK (has_next IN (0, 1)),
          cached_at INTEGER NOT NULL,
          PRIMARY KEY (media_id, window_start_sec, window_end_sec),
          FOREIGN KEY (media_id)
            REFERENCES ${TRANSCRIPT_CACHE_TABLES.metadata}(media_id)
            ON DELETE CASCADE,
          CHECK (window_start_sec >= 0),
          CHECK (window_end_sec > window_start_sec)
        );

        CREATE TABLE IF NOT EXISTS ${TRANSCRIPT_CACHE_TABLES.segments} (
          media_id INTEGER NOT NULL,
          window_start_sec REAL NOT NULL,
          window_end_sec REAL NOT NULL,
          segment_id TEXT,
          start_sec REAL NOT NULL,
          end_sec REAL NOT NULL,
          text TEXT NOT NULL,
          words_json TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'done',
          model TEXT,
          PRIMARY KEY (
            media_id,
            window_start_sec,
            window_end_sec,
            start_sec,
            end_sec
          ),
          FOREIGN KEY (
            media_id,
            window_start_sec,
            window_end_sec
          ) REFERENCES ${TRANSCRIPT_CACHE_TABLES.windows} (
            media_id,
            window_start_sec,
            window_end_sec
          ) ON DELETE CASCADE,
          CHECK (start_sec >= 0),
          CHECK (end_sec > start_sec)
        );

        CREATE INDEX IF NOT EXISTS idx_transcript_cache_windows_media_range
          ON ${TRANSCRIPT_CACHE_TABLES.windows} (media_id, window_start_sec, window_end_sec);

        CREATE INDEX IF NOT EXISTS idx_transcript_cache_segments_media_range
          ON ${TRANSCRIPT_CACHE_TABLES.segments} (media_id, start_sec, end_sec);
      `);
		},
	},
];

function assertMigrationSequence() {
	migrations.forEach((migration, index) => {
		const expectedVersion = index + 1;
		if (migration.version !== expectedVersion) {
			throw new Error(
				`Transcript cache migration ${migration.name} is numbered ${migration.version}; expected ${expectedVersion}.`,
			);
		}
	});
}

async function getUserVersion(database: TranscriptCacheSqliteDatabase) {
	const row = await database.first<{ user_version: number }>(
		"PRAGMA user_version",
	);
	const version = Number(row?.user_version ?? 0);
	if (!Number.isInteger(version) || version < 0) {
		throw new Error("Transcript cache has an invalid SQLite schema version.");
	}
	return version;
}

async function validateTableColumns(
	database: TranscriptCacheSqliteDatabase,
	table: string,
	requiredColumns: string[],
) {
	const rows = await database.all<{ name: string }>(
		`PRAGMA table_info(${table})`,
	);
	const columns = new Set(rows.map((row) => row.name));
	const missing = requiredColumns.filter((column) => !columns.has(column));
	if (missing.length > 0) {
		throw new Error(
			`Transcript cache table ${table} is missing columns: ${missing.join(", ")}.`,
		);
	}
}

/**
 * Verifies the cache-owned schema after migrations. This deliberately fails
 * loudly for a malformed cache instead of swallowing an ALTER/DDL error and
 * leaving a partially usable database behind.
 */
export async function validateTranscriptCacheSchema(
	database: TranscriptCacheSqliteDatabase,
) {
	await validateTableColumns(database, TRANSCRIPT_CACHE_TABLES.metadata, [
		"media_id",
		"transcript_id",
		"transcript_updated_at",
		"status",
		"duration_sec",
		"segment_count",
		"max_end_sec",
		"cached_at",
	]);
	await validateTableColumns(database, TRANSCRIPT_CACHE_TABLES.windows, [
		"media_id",
		"window_start_sec",
		"window_end_sec",
		"transcript_id",
		"transcript_updated_at",
		"status",
		"duration_sec",
		"segment_count",
		"max_end_sec",
		"previous_window_start_sec",
		"next_window_start_sec",
		"has_previous",
		"has_next",
		"cached_at",
	]);
	await validateTableColumns(database, TRANSCRIPT_CACHE_TABLES.segments, [
		"media_id",
		"window_start_sec",
		"window_end_sec",
		"segment_id",
		"start_sec",
		"end_sec",
		"text",
		"words_json",
		"status",
		"model",
	]);
}

/** Apply all pending numbered migrations atomically. */
export async function migrateTranscriptCache(
	database: TranscriptCacheSqliteDatabase,
) {
	assertMigrationSequence();

	const currentVersion = await getUserVersion(database);
	if (currentVersion > TRANSCRIPT_CACHE_SCHEMA_VERSION) {
		throw new Error(
			`Transcript cache schema ${currentVersion} is newer than the supported schema ${TRANSCRIPT_CACHE_SCHEMA_VERSION}.`,
		);
	}

	for (const migration of migrations) {
		if (migration.version <= currentVersion) continue;

		await database.transaction(async (transaction) => {
			await migration.up(transaction);
			await transaction.exec(`PRAGMA user_version = ${migration.version}`);
		});
	}

	await validateTranscriptCacheSchema(database);
}

/**
 * Rebuilds only the cache-owned schema. The cache is disposable because the
 * server remains authoritative; this is useful for logical corruption without
 * touching the app's durable content database.
 */
export async function rebuildTranscriptCacheSchema(
	database: TranscriptCacheSqliteDatabase,
) {
	await database.transaction(async (transaction) => {
		await transaction.exec(`
      DROP TABLE IF EXISTS ${TRANSCRIPT_CACHE_TABLES.segments};
      DROP TABLE IF EXISTS ${TRANSCRIPT_CACHE_TABLES.windows};
      DROP TABLE IF EXISTS ${TRANSCRIPT_CACHE_TABLES.metadata};
      PRAGMA user_version = 0;
    `);
	});

	await migrateTranscriptCache(database);
}
