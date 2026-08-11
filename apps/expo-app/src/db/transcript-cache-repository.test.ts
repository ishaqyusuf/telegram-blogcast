import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { createTranscriptCacheRepository } from "./transcript-cache-repository";
import {
	TRANSCRIPT_CACHE_SCHEMA_VERSION,
	migrateTranscriptCache,
	rebuildTranscriptCacheSchema,
} from "./transcript-cache-schema";
import type {
	TranscriptCacheSqliteDatabase,
	TranscriptCacheSqliteValue,
} from "./transcript-cache-sqlite";

class BunSqliteAdapter implements TranscriptCacheSqliteDatabase {
	constructor(readonly sqlite = new Database(":memory:")) {}

	async exec(sql: string) {
		this.sqlite.run(sql);
	}

	async run(sql: string, params: TranscriptCacheSqliteValue[] = []) {
		this.sqlite.run(sql, ...params);
	}

	async all<T>(sql: string, params: TranscriptCacheSqliteValue[] = []) {
		return this.sqlite.query(sql).all(...params) as T[];
	}

	async first<T>(sql: string, params: TranscriptCacheSqliteValue[] = []) {
		return (this.sqlite.query(sql).get(...params) as T | null) ?? null;
	}

	async transaction<T>(
		task: (transaction: TranscriptCacheSqliteDatabase) => Promise<T>,
	) {
		this.sqlite.run("BEGIN");
		try {
			const result = await task(this);
			this.sqlite.run("COMMIT");
			return result;
		} catch (error) {
			this.sqlite.run("ROLLBACK");
			throw error;
		}
	}
}

async function createRepository() {
	const database = new BunSqliteAdapter();
	await migrateTranscriptCache(database);
	return {
		database,
		repository: createTranscriptCacheRepository(database),
	};
}

const firstWindow = {
	mediaId: 42,
	transcriptId: 7,
	transcriptUpdatedAt: new Date("2026-08-11T08:00:00.000Z"),
	status: "done",
	windowStartSec: 0,
	windowEndSec: 60,
	durationSec: 180,
	segmentCount: 3,
	maxEndSec: 180,
	hasPrevious: false,
	hasNext: true,
	nextWindowStartSec: 60,
	cachedAtMs: 1234,
	segments: [
		{
			id: 101,
			startSec: 10,
			endSec: 20,
			text: "first saved segment",
			words: [{ word: "first", startSec: 10, endSec: 12 }],
		},
	],
};

describe("transcript cache repository", () => {
	test("applies a numbered schema migration and validates its version", async () => {
		const database = new BunSqliteAdapter();

		await migrateTranscriptCache(database);

		const row = await database.first<{ user_version: number }>(
			"PRAGMA user_version",
		);
		expect(row?.user_version).toBe(TRANSCRIPT_CACHE_SCHEMA_VERSION);

		const tables = await database.all<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
		);
		expect(tables.map((table) => table.name)).toEqual([
			"transcript_cache_metadata",
			"transcript_cache_segments",
			"transcript_cache_windows",
		]);
	});

	test("rejects a malformed cache schema instead of accepting a partial version", async () => {
		const database = new BunSqliteAdapter();
		await database.exec(`
			CREATE TABLE transcript_cache_metadata (media_id INTEGER PRIMARY KEY);
			PRAGMA user_version = 1;
		`);

		await expect(migrateTranscriptCache(database)).rejects.toThrow(
			"missing columns",
		);
	});

	test("reads all cached windows overlapping a requested range and round-trips words/date freshness", async () => {
		const { repository } = await createRepository();
		await repository.upsertServerWindow(firstWindow);
		await repository.upsertServerWindow({
			...firstWindow,
			windowStartSec: 60,
			windowEndSec: 120,
			hasPrevious: true,
			hasNext: false,
			nextWindowStartSec: null,
			segments: [
				{
					id: "102",
					startSec: 60,
					endSec: 70,
					text: "second saved segment",
					words: [],
				},
			],
		});

		const windows = await repository.readOverlappingWindows({
			mediaId: 42,
			startSec: 30,
			endSec: 90,
		});

		expect(windows).toHaveLength(2);
		expect(windows[0]).toMatchObject({
			mediaId: 42,
			windowStartSec: 0,
			windowEndSec: 60,
			transcriptUpdatedAt: new Date("2026-08-11T08:00:00.000Z"),
			segments: [
				expect.objectContaining({
					id: "101",
					text: "first saved segment",
					words: [{ word: "first", startSec: 10, endSec: 12 }],
				}),
			],
		});
		expect(windows[1]?.windowStartSec).toBe(60);
	});

	test("upserts the same server window idempotently and replaces stale segments", async () => {
		const { database, repository } = await createRepository();
		await repository.upsertServerWindow(firstWindow);

		await repository.upsertServerWindow({
			...firstWindow,
			cachedAtMs: 5678,
			segments: [
				{
					id: 103,
					startSec: 30,
					endSec: 40,
					text: "replacement segment",
				},
			],
		});
		await repository.upsertServerWindow({
			...firstWindow,
			cachedAtMs: 5678,
			segments: [
				{
					id: 103,
					startSec: 30,
					endSec: 40,
					text: "replacement segment",
				},
			],
		});

		const windows = await repository.readOverlappingWindows({
			mediaId: 42,
			startSec: 0,
			endSec: 60,
		});
		const segmentRows = await database.all<{ count: number }>(
			"SELECT COUNT(*) AS count FROM transcript_cache_segments WHERE media_id = 42",
		);

		expect(windows[0]?.segments).toEqual([
			expect.objectContaining({
				id: "103",
				text: "replacement segment",
			}),
		]);
		expect(segmentRows[0]?.count).toBe(1);
	});

	test("evicts older windows for a new transcript revision and ignores stale responses", async () => {
		const { repository } = await createRepository();
		await repository.upsertServerWindow(firstWindow);
		await repository.upsertServerWindow({
			...firstWindow,
			windowStartSec: 60,
			windowEndSec: 120,
			segments: [],
		});

		await repository.upsertServerWindow({
			...firstWindow,
			transcriptUpdatedAt: new Date("2026-08-11T09:00:00.000Z"),
			segments: [
				{
					id: 201,
					startSec: 1,
					endSec: 2,
					text: "new revision",
				},
			],
		});
		await repository.upsertServerWindow({
			...firstWindow,
			cachedAtMs: 9999,
			segments: [
				{
					id: 202,
					startSec: 3,
					endSec: 4,
					text: "stale response",
				},
			],
		});

		const windows = await repository.readOverlappingWindows({
			mediaId: 42,
			startSec: 0,
			endSec: 180,
		});

		expect(windows).toHaveLength(1);
		expect(windows[0]).toMatchObject({
			transcriptUpdatedAt: new Date("2026-08-11T09:00:00.000Z"),
			segments: [expect.objectContaining({ text: "new revision" })],
		});
	});

	test("does not let a null revision erase timestamped cached data", async () => {
		const { repository } = await createRepository();
		await repository.upsertServerWindow(firstWindow);

		const accepted = await repository.upsertServerWindow({
			...firstWindow,
			transcriptUpdatedAt: null,
			segments: [
				{
					id: 301,
					startSec: 30,
					endSec: 40,
					text: "unversioned response",
				},
			],
		});

		expect(accepted).toBe(false);
		expect(
			await repository.readOverlappingWindows({
				mediaId: 42,
				startSec: 0,
				endSec: 60,
			}),
		).toMatchObject([
			{
				transcriptUpdatedAt: new Date("2026-08-11T08:00:00.000Z"),
				segments: [expect.objectContaining({ text: "first saved segment" })],
			},
		]);

		await repository.invalidateMediaTranscript(42);
		expect(
			await repository.upsertServerWindow({
				...firstWindow,
				transcriptUpdatedAt: null,
			}),
		).toBe(true);
	});

	test("invalidates one media transcript without touching another media item", async () => {
		const { repository } = await createRepository();
		await repository.upsertServerWindow(firstWindow);
		await repository.upsertServerWindow({
			...firstWindow,
			mediaId: 99,
			segments: [],
		});

		await repository.invalidateMediaTranscript(42);

		expect(
			await repository.readOverlappingWindows({
				mediaId: 42,
				startSec: 0,
				endSec: 60,
			}),
		).toEqual([]);
		expect(
			await repository.readOverlappingWindows({
				mediaId: 99,
				startSec: 0,
				endSec: 60,
			}),
		).toHaveLength(1);
	});

	test("rebuilds only the disposable cache schema after logical corruption", async () => {
		const { database, repository } = await createRepository();
		await repository.upsertServerWindow(firstWindow);

		await rebuildTranscriptCacheSchema(database);

		expect(
			await repository.readOverlappingWindows({
				mediaId: 42,
				startSec: 0,
				endSec: 60,
			}),
		).toEqual([]);
		const row = await database.first<{ user_version: number }>(
			"PRAGMA user_version",
		);
		expect(row?.user_version).toBe(TRANSCRIPT_CACHE_SCHEMA_VERSION);
	});

	test("rolls back a window write when a segment violates the schema", async () => {
		const { database, repository } = await createRepository();

		await expect(
			repository.upsertServerWindow({
				...firstWindow,
				segments: [
					{
						id: 104,
						startSec: 10,
						endSec: 20,
						text: "valid row",
					},
					{
						id: 105,
						startSec: 10,
						endSec: 20,
						text: "duplicate primary key",
					},
				],
			}),
		).rejects.toThrow();

		expect(
			await repository.readOverlappingWindows({
				mediaId: 42,
				startSec: 0,
				endSec: 60,
			}),
		).toEqual([]);
		const metadataRows = await database.all<{ count: number }>(
			"SELECT COUNT(*) AS count FROM transcript_cache_metadata",
		);
		expect(metadataRows[0]?.count).toBe(0);
	});
});
