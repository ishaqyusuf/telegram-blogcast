import { TRANSCRIPT_CACHE_TABLES } from "./transcript-cache-schema";
import type { TranscriptCacheSqliteDatabase } from "./transcript-cache-sqlite";

export const TRANSCRIPT_CACHE_WINDOW_SEC = 60;

export type TranscriptCacheWord = {
	word: string;
	startSec: number;
	endSec: number;
};

export type TranscriptCacheSegmentInput = {
	id?: number | string | null;
	startSec: number;
	endSec: number;
	text: string;
	words?: TranscriptCacheWord[];
	status?: string | null;
	model?: string | null;
};

export type TranscriptCacheSegment = {
	id: string | null;
	startSec: number;
	endSec: number;
	text: string;
	words: TranscriptCacheWord[];
	status: string;
	model: string | null;
};

export type ServerTranscriptWindow = {
	mediaId: number;
	transcriptId?: number | null;
	transcriptUpdatedAt?: Date | null;
	status?: string | null;
	windowStartSec: number;
	windowEndSec: number;
	durationSec?: number | null;
	segmentCount?: number;
	maxEndSec?: number;
	previousWindowStartSec?: number | null;
	nextWindowStartSec?: number | null;
	hasPrevious?: boolean;
	hasNext?: boolean;
	cachedAtMs?: number;
	segments: readonly TranscriptCacheSegmentInput[];
};

export type CachedTranscriptWindow = {
	mediaId: number;
	transcriptId: number | null;
	transcriptUpdatedAt: Date | null;
	status: string | null;
	windowStartSec: number;
	windowEndSec: number;
	windowDurationSec: number;
	durationSec: number | null;
	segmentCount: number;
	maxEndSec: number;
	previousWindowStartSec: number | null;
	nextWindowStartSec: number | null;
	hasPrevious: boolean;
	hasNext: boolean;
	cachedAtMs: number;
	segments: TranscriptCacheSegment[];
};

export type TranscriptCacheReadRange = {
	mediaId: number;
	startSec: number;
	endSec: number;
};

export interface TranscriptCacheRepository {
	/** Return every cached server window that overlaps the requested range. */
	readOverlappingWindows(
		range: TranscriptCacheReadRange,
	): Promise<CachedTranscriptWindow[]>;

	/** Replace one server window and its owned segments in one transaction. */
	upsertServerWindow(window: ServerTranscriptWindow): Promise<void>;

	/** Remove all cached metadata, windows, and segments for one media item. */
	invalidateMediaTranscript(mediaId: number): Promise<void>;
}

type NormalizedServerTranscriptWindow = {
	mediaId: number;
	transcriptId: number | null;
	transcriptUpdatedAtMs: number | null;
	status: string | null;
	windowStartSec: number;
	windowEndSec: number;
	durationSec: number | null;
	segmentCount: number;
	maxEndSec: number;
	previousWindowStartSec: number | null;
	nextWindowStartSec: number | null;
	hasPrevious: boolean;
	hasNext: boolean;
	cachedAtMs: number;
	segments: {
		id: string | null;
		startSec: number;
		endSec: number;
		text: string;
		wordsJson: string;
		status: string;
		model: string | null;
	}[];
};

function assertMediaId(mediaId: number) {
	if (!Number.isInteger(mediaId) || mediaId <= 0) {
		throw new Error("Transcript cache mediaId must be a positive integer.");
	}
}

function assertFiniteNonNegative(value: number, label: string) {
	if (!Number.isFinite(value) || value < 0) {
		throw new Error(
			`Transcript cache ${label} must be finite and non-negative.`,
		);
	}
}

function assertRange(startSec: number, endSec: number) {
	assertFiniteNonNegative(startSec, "window start");
	if (!Number.isFinite(endSec) || endSec <= startSec) {
		throw new Error("Transcript cache window end must be greater than start.");
	}
}

function toTimestamp(value: Date | null | undefined) {
	if (value == null) return null;
	const timestamp = value.getTime();
	if (!Number.isFinite(timestamp)) {
		throw new Error(
			"Transcript cache transcriptUpdatedAt must be a valid Date.",
		);
	}
	return timestamp;
}

function normalizeWords(words: TranscriptCacheWord[] | undefined) {
	const normalized = words ?? [];
	for (const word of normalized) {
		if (
			typeof word.word !== "string" ||
			word.word.trim().length === 0 ||
			!Number.isFinite(word.startSec) ||
			!Number.isFinite(word.endSec) ||
			word.endSec <= word.startSec
		) {
			throw new Error("Transcript cache contains an invalid transcript word.");
		}
	}
	return normalized;
}

function normalizeServerWindow(
	input: ServerTranscriptWindow,
): NormalizedServerTranscriptWindow {
	assertMediaId(input.mediaId);
	assertRange(input.windowStartSec, input.windowEndSec);

	if (
		input.durationSec != null &&
		(!Number.isFinite(input.durationSec) || input.durationSec < 0)
	) {
		throw new Error(
			"Transcript cache durationSec must be null or non-negative.",
		);
	}
	if (
		input.segmentCount != null &&
		(!Number.isInteger(input.segmentCount) || input.segmentCount < 0)
	) {
		throw new Error(
			"Transcript cache segmentCount must be a non-negative integer.",
		);
	}

	const segments = input.segments.map((segment) => {
		assertFiniteNonNegative(segment.startSec, "segment start");
		if (
			!Number.isFinite(segment.endSec) ||
			segment.endSec <= segment.startSec
		) {
			throw new Error(
				"Transcript cache segment end must be greater than start.",
			);
		}
		if (typeof segment.text !== "string" || segment.text.trim().length === 0) {
			throw new Error("Transcript cache segment text must not be empty.");
		}

		return {
			id: segment.id == null ? null : String(segment.id),
			startSec: segment.startSec,
			endSec: segment.endSec,
			text: segment.text,
			wordsJson: JSON.stringify(normalizeWords(segment.words)),
			status: segment.status ?? "done",
			model: segment.model ?? null,
		};
	});

	const segmentMaxEndSec = segments.reduce(
		(maxEndSec, segment) => Math.max(maxEndSec, segment.endSec),
		0,
	);
	const maxEndSec = Math.max(input.maxEndSec ?? 0, segmentMaxEndSec);
	assertFiniteNonNegative(maxEndSec, "maxEndSec");

	const cachedAtMs = input.cachedAtMs ?? Date.now();
	if (!Number.isFinite(cachedAtMs) || cachedAtMs < 0) {
		throw new Error("Transcript cache cachedAtMs must be non-negative.");
	}

	return {
		mediaId: input.mediaId,
		transcriptId: input.transcriptId ?? null,
		transcriptUpdatedAtMs: toTimestamp(input.transcriptUpdatedAt),
		status: input.status ?? null,
		windowStartSec: input.windowStartSec,
		windowEndSec: input.windowEndSec,
		durationSec: input.durationSec ?? null,
		segmentCount: input.segmentCount ?? segments.length,
		maxEndSec,
		previousWindowStartSec: input.previousWindowStartSec ?? null,
		nextWindowStartSec: input.nextWindowStartSec ?? null,
		hasPrevious: input.hasPrevious ?? input.windowStartSec > 0,
		hasNext: input.hasNext ?? input.nextWindowStartSec != null,
		cachedAtMs,
		segments,
	};
}

type JoinedWindowRow = {
	media_id: number;
	window_start_sec: number;
	window_end_sec: number;
	transcript_id: number | null;
	transcript_updated_at: number | null;
	window_status: string | null;
	duration_sec: number | null;
	segment_count: number;
	max_end_sec: number;
	previous_window_start_sec: number | null;
	next_window_start_sec: number | null;
	has_previous: number;
	has_next: number;
	cached_at: number;
	segment_id: string | null;
	segment_start_sec: number | null;
	segment_end_sec: number | null;
	segment_text: string | null;
	words_json: string | null;
	segment_status: string | null;
	segment_model: string | null;
};

function parseWords(wordsJson: string | null): TranscriptCacheWord[] {
	if (!wordsJson) return [];
	try {
		const parsed: unknown = JSON.parse(wordsJson);
		return Array.isArray(parsed) ? (parsed as TranscriptCacheWord[]) : [];
	} catch {
		// The cache is disposable. A malformed optional words payload should not
		// prevent the text/timing rows from being read or the cache being rebuilt.
		return [];
	}
}

function fromTimestamp(timestamp: number | null) {
	if (timestamp == null) return null;
	const date = new Date(timestamp);
	return Number.isNaN(date.getTime()) ? null : date;
}

function windowKey(mediaId: number, startSec: number, endSec: number) {
	return `${mediaId}:${startSec}:${endSec}`;
}

function toCachedWindow(row: JoinedWindowRow): CachedTranscriptWindow {
	return {
		mediaId: row.media_id,
		transcriptId: row.transcript_id,
		transcriptUpdatedAt: fromTimestamp(row.transcript_updated_at),
		status: row.window_status,
		windowStartSec: row.window_start_sec,
		windowEndSec: row.window_end_sec,
		windowDurationSec: row.window_end_sec - row.window_start_sec,
		durationSec: row.duration_sec,
		segmentCount: row.segment_count,
		maxEndSec: row.max_end_sec,
		previousWindowStartSec: row.previous_window_start_sec,
		nextWindowStartSec: row.next_window_start_sec,
		hasPrevious: row.has_previous === 1,
		hasNext: row.has_next === 1,
		cachedAtMs: row.cached_at,
		segments: [],
	};
}

export class SqliteTranscriptCacheRepository
	implements TranscriptCacheRepository
{
	constructor(private readonly database: TranscriptCacheSqliteDatabase) {}

	async readOverlappingWindows(
		range: TranscriptCacheReadRange,
	): Promise<CachedTranscriptWindow[]> {
		assertMediaId(range.mediaId);
		assertRange(range.startSec, range.endSec);

		const rows = await this.database.all<JoinedWindowRow>(
			`
        SELECT
          w.media_id,
          w.window_start_sec,
          w.window_end_sec,
          w.transcript_id,
          w.transcript_updated_at,
          w.status AS window_status,
          w.duration_sec,
          w.segment_count,
          w.max_end_sec,
          w.previous_window_start_sec,
          w.next_window_start_sec,
          w.has_previous,
          w.has_next,
          w.cached_at,
          s.segment_id,
          s.start_sec AS segment_start_sec,
          s.end_sec AS segment_end_sec,
          s.text AS segment_text,
          s.words_json,
          s.status AS segment_status,
          s.model AS segment_model
        FROM ${TRANSCRIPT_CACHE_TABLES.windows} AS w
        LEFT JOIN ${TRANSCRIPT_CACHE_TABLES.segments} AS s
          ON s.media_id = w.media_id
          AND s.window_start_sec = w.window_start_sec
          AND s.window_end_sec = w.window_end_sec
        WHERE w.media_id = ?
          AND w.window_start_sec < ?
          AND w.window_end_sec > ?
        ORDER BY w.window_start_sec ASC, s.start_sec ASC, s.end_sec ASC
      `,
			[range.mediaId, range.endSec, range.startSec],
		);

		const windows = new Map<string, CachedTranscriptWindow>();
		for (const row of rows) {
			const key = windowKey(
				row.media_id,
				row.window_start_sec,
				row.window_end_sec,
			);
			let window = windows.get(key);
			if (!window) {
				window = toCachedWindow(row);
				windows.set(key, window);
			}

			if (row.segment_start_sec == null || row.segment_end_sec == null) {
				continue;
			}

			window.segments.push({
				id: row.segment_id,
				startSec: row.segment_start_sec,
				endSec: row.segment_end_sec,
				text: row.segment_text ?? "",
				words: parseWords(row.words_json),
				status: row.segment_status ?? "done",
				model: row.segment_model,
			});
		}

		return [...windows.values()];
	}

	async upsertServerWindow(window: ServerTranscriptWindow) {
		const normalized = normalizeServerWindow(window);

		await this.database.transaction(async (transaction) => {
			const existingMetadata = await transaction.first<{
				transcript_updated_at: number | null;
			}>(
				`
          SELECT transcript_updated_at
          FROM ${TRANSCRIPT_CACHE_TABLES.metadata}
          WHERE media_id = ?
        `,
				[normalized.mediaId],
			);

			const existingUpdatedAt = existingMetadata?.transcript_updated_at ?? null;
			const incomingUpdatedAt = normalized.transcriptUpdatedAtMs;
			const isOlderResponse =
				existingUpdatedAt != null &&
				incomingUpdatedAt != null &&
				incomingUpdatedAt < existingUpdatedAt;

			if (isOlderResponse) return;

			const isDifferentTranscriptRevision =
				existingMetadata != null && existingUpdatedAt !== incomingUpdatedAt;
			if (isDifferentTranscriptRevision) {
				await transaction.run(
					`DELETE FROM ${TRANSCRIPT_CACHE_TABLES.segments} WHERE media_id = ?`,
					[normalized.mediaId],
				);
				await transaction.run(
					`DELETE FROM ${TRANSCRIPT_CACHE_TABLES.windows} WHERE media_id = ?`,
					[normalized.mediaId],
				);
			}

			await transaction.run(
				`
          INSERT INTO ${TRANSCRIPT_CACHE_TABLES.metadata} (
            media_id,
            transcript_id,
            transcript_updated_at,
            status,
            duration_sec,
            segment_count,
            max_end_sec,
            cached_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(media_id) DO UPDATE SET
            transcript_id = excluded.transcript_id,
            transcript_updated_at = excluded.transcript_updated_at,
            status = excluded.status,
            duration_sec = excluded.duration_sec,
            segment_count = excluded.segment_count,
            max_end_sec = excluded.max_end_sec,
            cached_at = excluded.cached_at
        `,
				[
					normalized.mediaId,
					normalized.transcriptId,
					normalized.transcriptUpdatedAtMs,
					normalized.status,
					normalized.durationSec,
					normalized.segmentCount,
					normalized.maxEndSec,
					normalized.cachedAtMs,
				],
			);

			await transaction.run(
				`
          INSERT INTO ${TRANSCRIPT_CACHE_TABLES.windows} (
            media_id,
            window_start_sec,
            window_end_sec,
            transcript_id,
            transcript_updated_at,
            status,
            duration_sec,
            segment_count,
            max_end_sec,
            previous_window_start_sec,
            next_window_start_sec,
            has_previous,
            has_next,
            cached_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(media_id, window_start_sec, window_end_sec) DO UPDATE SET
            transcript_id = excluded.transcript_id,
            transcript_updated_at = excluded.transcript_updated_at,
            status = excluded.status,
            duration_sec = excluded.duration_sec,
            segment_count = excluded.segment_count,
            max_end_sec = excluded.max_end_sec,
            previous_window_start_sec = excluded.previous_window_start_sec,
            next_window_start_sec = excluded.next_window_start_sec,
            has_previous = excluded.has_previous,
            has_next = excluded.has_next,
            cached_at = excluded.cached_at
        `,
				[
					normalized.mediaId,
					normalized.windowStartSec,
					normalized.windowEndSec,
					normalized.transcriptId,
					normalized.transcriptUpdatedAtMs,
					normalized.status,
					normalized.durationSec,
					normalized.segmentCount,
					normalized.maxEndSec,
					normalized.previousWindowStartSec,
					normalized.nextWindowStartSec,
					normalized.hasPrevious ? 1 : 0,
					normalized.hasNext ? 1 : 0,
					normalized.cachedAtMs,
				],
			);

			await transaction.run(
				`
          DELETE FROM ${TRANSCRIPT_CACHE_TABLES.segments}
          WHERE media_id = ?
            AND window_start_sec = ?
            AND window_end_sec = ?
        `,
				[
					normalized.mediaId,
					normalized.windowStartSec,
					normalized.windowEndSec,
				],
			);

			for (const segment of normalized.segments) {
				await transaction.run(
					`
            INSERT INTO ${TRANSCRIPT_CACHE_TABLES.segments} (
              media_id,
              window_start_sec,
              window_end_sec,
              segment_id,
              start_sec,
              end_sec,
              text,
              words_json,
              status,
              model
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
					[
						normalized.mediaId,
						normalized.windowStartSec,
						normalized.windowEndSec,
						segment.id,
						segment.startSec,
						segment.endSec,
						segment.text,
						segment.wordsJson,
						segment.status,
						segment.model,
					],
				);
			}
		});
	}

	async invalidateMediaTranscript(mediaId: number) {
		assertMediaId(mediaId);

		await this.database.transaction(async (transaction) => {
			await transaction.run(
				`DELETE FROM ${TRANSCRIPT_CACHE_TABLES.segments} WHERE media_id = ?`,
				[mediaId],
			);
			await transaction.run(
				`DELETE FROM ${TRANSCRIPT_CACHE_TABLES.windows} WHERE media_id = ?`,
				[mediaId],
			);
			await transaction.run(
				`DELETE FROM ${TRANSCRIPT_CACHE_TABLES.metadata} WHERE media_id = ?`,
				[mediaId],
			);
		});
	}
}

export function createTranscriptCacheRepository(
	database: TranscriptCacheSqliteDatabase,
) {
	return new SqliteTranscriptCacheRepository(database);
}
