import { createHash } from "node:crypto";
import { Prisma, type Database } from "@acme/db";
import {
	convertKetabOnlinePageHtml,
	flattenKetabOnlineIndex,
	KETABONLINE_PROVIDER,
	KetabOnlineError,
	type KetabOnlineBookMetadata,
	type KetabOnlineIndexNode,
	type KetabOnlineIndexPart,
	type KetabOnlineSourcePage,
	normalizeKetabOnlineContent,
} from "@acme/document/book/ketabonline";
import { rebindPageAnnotations } from "./book-page-annotations";
import { createKetabOnlineClient, type KetabOnlineClient } from "./ketabonline-client";

export const SOURCE_IMPORT_TASK = "import-book-source";
export const SOURCE_IMPORT_PAGE_BATCH = 100;
export const SOURCE_IMPORT_ACTIVE_STATUSES = ["queued", "running"] as const;

const CONVERTER_VERSION = "ketabonline-html-1";
const LIBRARY_USER_ID = 1;
// Reading order lives in BookPage.shamelaPageNo (the legacy name of the per-book page
// sequence). Provisional/retired ranges keep the (bookId, shamelaPageNo) key unique
// while a refresh reorders pages, and are never visible as fetched pages.
const PROVISIONAL_SEQUENCE_BASE = 1_000_000_000;
const RETIRED_SEQUENCE_BASE = -1_000_000;

export type SourceImportPayload = { importId: string; generation: number };

export const sourceImportActiveKey = (provider: string, sourceBookId: number) =>
	`${provider}:${sourceBookId}`;

/** The run was cancelled or superseded by a newer generation; stop without publishing. */
class ImportStopped extends Error {}

type Tx = Prisma.TransactionClient;

type PagePlan = {
	sourcePageId: number;
	desiredSequence: number;
	sequence: number;
	status: "fetched" | "pending";
	current: ExistingPage | undefined;
};

type ExistingPage = {
	id: number;
	sourcePageId: number | null;
	shamelaPageNo: number;
	sourceContentHash: string | null;
	status: string;
	deletedAt: Date | null;
};

export type SourceImportDeps = {
	client?: KetabOnlineClient;
	pageBatchSize?: number;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const rssMb = () => Math.round(process.memoryUsage().rss / 1_000_000);

function friendlyFailure(error: KetabOnlineError, phase: string) {
	if (phase === "chapters")
		return `Text is saved and readable, but the chapter list could not be completed. ${error.message} Retry to finish chapters.`;
	return error.message;
}

export async function runBookSourceImport(
	db: Database,
	payload: SourceImportPayload,
	deps: SourceImportDeps = {},
) {
	const client = deps.client ?? createKetabOnlineClient();
	const batchSize = deps.pageBatchSize ?? SOURCE_IMPORT_PAGE_BATCH;
	const job = await db.bookSourceImport.findUnique({ where: { id: payload.importId } });
	if (
		!job ||
		job.generation !== payload.generation ||
		!SOURCE_IMPORT_ACTIVE_STATUSES.includes(job.status as "queued")
	)
		return { skipped: true as const };
	if (job.provider !== KETABONLINE_PROVIDER) throw new Error("Unsupported book source provider.");

	const claimed = await db.bookSourceImport.updateMany({
		where: { id: job.id, generation: payload.generation, status: { in: [...SOURCE_IMPORT_ACTIVE_STATUSES] } },
		data: { status: "running", phase: "metadata", errorCode: null, errorMessage: null, startedAt: new Date() },
	});
	if (claimed.count !== 1) return { skipped: true as const };

	const guard = async (data: Prisma.BookSourceImportUncheckedUpdateManyInput, tx: Tx | Database = db) => {
		const updated = await tx.bookSourceImport.updateMany({
			where: { id: job.id, generation: payload.generation, status: "running" },
			data,
		});
		if (updated.count !== 1) throw new ImportStopped();
	};

	const started = Date.now();
	const metrics: Record<string, number> = {};
	const mark = (name: string, since: number) => {
		metrics[`${name}Ms`] = Date.now() - since;
		metrics.peakRssMb = Math.max(metrics.peakRssMb ?? 0, rssMb());
	};
	let phase = "metadata";
	try {
		let since = Date.now();
		const metadata = await client.metadata(job.sourceBookId);
		if (!metadata.contentUrl || metadata.pagesCount === 0)
			throw new KetabOnlineError("unavailable", "KetabOnline does not provide readable text for this book.");
		mark("metadata", since);
		await guard({
			phase: "download",
			title: metadata.title,
			pagesTotal: metadata.pagesCount,
			volumesTotal: metadata.parts.length,
			chaptersTotal: metadata.indexCount,
		});

		phase = "download";
		since = Date.now();
		const { pages, archiveBytes, archiveSha256, jsonChars } = await downloadPages(client, metadata);
		Object.assign(metrics, { archiveBytes, jsonChars, pages: pages.length });
		mark("download", since);
		await guard({ phase: "pages", snapshotHash: archiveSha256, pagesTotal: pages.length });

		phase = "pages";
		since = Date.now();
		const bookId = await ensureBook(db, metadata);
		const volumeIds = await ensureVolumes(db, bookId, metadata);
		await guard({ bookId, pagesSaved: 0 });
		const plan = await planPageSequences(db, bookId, pages);
		let paragraphs = 0;
		let footnotes = 0;
		for (let offset = 0; offset < pages.length; offset += batchSize) {
			const batch = pages.slice(offset, offset + batchSize);
			const written = await writePageBatch(db, {
				bookId,
				batch,
				plan,
				volumeIds,
				progress: (tx) => guard({ pagesSaved: offset + batch.length }, tx),
			});
			paragraphs += written.paragraphs;
			footnotes += written.footnotes;
		}
		Object.assign(metrics, { paragraphs, footnotes });
		await db.$transaction(
			async (tx) => {
				await publishPages(tx, bookId, plan);
				await guard({ phase: "chapters", volumesIndexed: 0, chaptersSaved: 0 }, tx);
			},
			{ timeout: 60_000, maxWait: 10_000 },
		);
		mark("pages", since);

		phase = "chapters";
		since = Date.now();
		const parts: KetabOnlineIndexPart[] = [];
		if (metadata.indexCount > 0) {
			for (const [index, part] of metadata.parts.entries()) {
				parts.push(await client.indexPart(metadata.id, part.name));
				await guard({ volumesIndexed: index + 1 });
			}
		}
		const nodes = flattenKetabOnlineIndex({
			parts,
			volumes: metadata.parts,
			pageIds: new Set(pages.map((page) => page.sourcePageId)),
			expectedCount: metadata.indexCount,
		});
		metrics.chapterNodes = nodes.length;
		mark("chapters", since);
		metrics.totalMs = Date.now() - started;
		await db.$transaction(
			async (tx) => {
				await publishChapters(tx, bookId, nodes);
				await guard(
					{
						status: "complete",
						phase: "done",
						activeKey: null,
						chaptersSaved: nodes.length,
						volumesIndexed: metadata.indexCount > 0 ? metadata.parts.length : 0,
						completedAt: new Date(),
						metricsJson: metrics,
					},
					tx,
				);
			},
			{ timeout: 120_000, maxWait: 10_000 },
		);
		return { bookId, pages: pages.length, chapters: nodes.length, metrics };
	} catch (error) {
		if (error instanceof ImportStopped) return { stopped: true as const };
		if (error instanceof KetabOnlineError) {
			const unavailable = error.code === "not_found" || error.code === "unavailable";
			// Retryable failures before pages are saved go back to Trigger's bounded retry policy.
			// After pages are saved, fail fast so a user retry repairs chapters without the
			// worker re-downloading the whole book on every automatic attempt.
			if (error.retryable && !unavailable && phase !== "chapters") throw error;
			await finishSourceImport(db, payload, {
				status: unavailable ? "unavailable" : "failed",
				errorCode: error.code,
				errorMessage: friendlyFailure(error, phase),
				metricsJson: metrics,
			});
			return { failed: error.code };
		}
		throw error;
	}
}

/** Records a terminal state for the current generation only and releases the active key. */
export async function finishSourceImport(
	db: Database,
	payload: SourceImportPayload,
	data: { status: "failed" | "unavailable" | "cancelled"; errorCode?: string | null; errorMessage: string; metricsJson?: Prisma.InputJsonValue },
) {
	return db.bookSourceImport.updateMany({
		where: { id: payload.importId, generation: payload.generation, status: { in: [...SOURCE_IMPORT_ACTIVE_STATUSES] } },
		data: { ...data, errorCode: data.errorCode ?? null, activeKey: null },
	});
}

async function downloadPages(client: KetabOnlineClient, metadata: KetabOnlineBookMetadata) {
	const archive = await client.archive(metadata.contentUrl!, metadata.id);
	const jsonChars = archive.text.length;
	let parsed: unknown;
	try {
		parsed = JSON.parse(archive.text);
	} catch {
		throw new KetabOnlineError("invalid_archive", "The book archive is not valid JSON.", true);
	}
	return {
		pages: normalizeKetabOnlineContent(parsed, metadata),
		archiveBytes: archive.archiveBytes,
		archiveSha256: archive.archiveSha256,
		jsonChars,
	};
}

async function ensureBook(db: Database, metadata: KetabOnlineBookMetadata) {
	const identity = { sourceProvider: KETABONLINE_PROVIDER, sourceBookId: metadata.id };
	const details = {
		nameAr: metadata.title,
		coverColor: metadata.colors[0] ?? null,
		category: metadata.categories[0] ?? null,
	};
	const authorIds: { id: number }[] = [];
	for (const name of metadata.authors.slice(0, 5)) {
		const author = await db.bookAuthor.upsert({
			where: { name },
			create: { name, nameAr: name },
			update: {},
			select: { id: true },
		});
		authorIds.push(author);
	}
	const existing = await db.book.findUnique({
		where: { sourceProvider_sourceBookId: identity },
		select: { id: true },
	});
	if (existing) {
		await db.book.update({
			where: { id: existing.id },
			data: { ...details, deletedAt: null, authors: { set: authorIds } },
		});
		return existing.id;
	}
	try {
		return await db.$transaction(async (tx) => {
			const blog = await tx.blog.create({
				data: {
					type: "book",
					content: metadata.description ?? metadata.title,
					published: true,
					status: "published",
				},
			});
			const book = await tx.book.create({
				data: {
					...identity,
					...details,
					blogId: blog.id,
					ownerUserId: LIBRARY_USER_ID,
					sourceType: KETABONLINE_PROVIDER,
					editable: false,
					tocStatus: "pending",
					authors: { connect: authorIds },
				},
				select: { id: true },
			});
			return book.id;
		});
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
			const book = await db.book.findUniqueOrThrow({
				where: { sourceProvider_sourceBookId: identity },
				select: { id: true },
			});
			return book.id;
		}
		throw error;
	}
}

async function ensureVolumes(db: Database, bookId: number, metadata: KetabOnlineBookMetadata) {
	const ids = new Map<number, number>();
	for (const part of metadata.parts) {
		const volume = await db.bookVolume.upsert({
			where: { bookId_number: { bookId, number: part.ordinal } },
			create: { bookId, number: part.ordinal, title: part.name, sourcePartId: part.sourcePartId },
			update: { title: part.name, sourcePartId: part.sourcePartId, deletedAt: null },
			select: { id: true },
		});
		ids.set(part.ordinal, volume.id);
	}
	return ids;
}

/**
 * Keeps existing local page IDs and sequences during the write phase. New pages take
 * their final sequence when free; otherwise they stay provisional until publication.
 */
async function planPageSequences(db: Database, bookId: number, pages: KetabOnlineSourcePage[]) {
	const existing: ExistingPage[] = await db.bookPage.findMany({
		where: { bookId },
		select: { id: true, sourcePageId: true, shamelaPageNo: true, sourceContentHash: true, status: true, deletedAt: true },
	});
	const bySource = new Map(existing.filter((page) => page.sourcePageId != null).map((page) => [page.sourcePageId!, page]));
	const occupied = new Set(existing.map((page) => page.shamelaPageNo));
	const plan = new Map<number, PagePlan>();
	for (const [index, page] of pages.entries()) {
		const desiredSequence = index + 1;
		const current = bySource.get(page.sourcePageId);
		if (current && !current.deletedAt) {
			plan.set(page.sourcePageId, {
				sourcePageId: page.sourcePageId,
				desiredSequence,
				sequence: current.shamelaPageNo,
				status: current.status === "fetched" ? "fetched" : "pending",
				current,
			});
			continue;
		}
		if (current) occupied.delete(current.shamelaPageNo);
		const free = !occupied.has(desiredSequence);
		const sequence = free ? desiredSequence : PROVISIONAL_SEQUENCE_BASE + desiredSequence;
		occupied.add(sequence);
		plan.set(page.sourcePageId, {
			sourcePageId: page.sourcePageId,
			desiredSequence,
			sequence,
			status: free ? "fetched" : "pending",
			current,
		});
	}
	return { pages: plan, existing };
}

async function writePageBatch(
	db: Database,
	input: {
		bookId: number;
		batch: KetabOnlineSourcePage[];
		plan: Awaited<ReturnType<typeof planPageSequences>>;
		volumeIds: Map<number, number>;
		progress: (tx: Tx) => Promise<void>;
	},
) {
	const converted = input.batch.map((page) => {
		const plan = input.plan.pages.get(page.sourcePageId)!;
		const content = convertKetabOnlinePageHtml(page.html);
		const hash = sha256(JSON.stringify([CONVERTER_VERSION, page.html, page.printedPageNo, page.partName]));
		return { page, plan, content, hash };
	});
	// Replays after a retry skip unchanged pages, keeping identities and versions stable.
	const changed = converted.filter(
		({ plan, hash }) => !plan.current || plan.current.deletedAt || plan.current.sourceContentHash !== hash,
	);
	const counts = {
		paragraphs: converted.reduce((sum, entry) => sum + entry.content.paragraphs.length, 0),
		footnotes: converted.reduce((sum, entry) => sum + entry.content.footnotes.length, 0),
	};
	await db.$transaction(
		async (tx) => {
			if (changed.length) {
				const priorIds = changed.flatMap(({ plan }) => (plan.current ? [plan.current.id] : []));
				const annotated = priorIds.length
					? new Set(
							[
								...(await tx.bookPageHighlight.findMany({ where: { pageId: { in: priorIds } }, select: { pageId: true } })),
								...(await tx.bookPageComment.findMany({ where: { pageId: { in: priorIds }, deletedAt: null }, select: { pageId: true } })),
							].map((row) => row.pageId),
						)
					: new Set<number>();
				const previousParagraphs = annotated.size
					? await tx.bookPageParagraph.findMany({
							where: { pageId: { in: [...annotated] } },
							select: { id: true, pageId: true, pid: true, text: true },
						})
					: [];
				const now = new Date().toISOString();
				const rows = changed.map(({ page, plan, content, hash }) => ({
					sourcePageId: page.sourcePageId,
					volumeId: input.volumeIds.get(page.volumeNumber) ?? null,
					sequence: plan.sequence,
					printed: page.printedPageNo,
					previous: plan.status === "fetched" && plan.sequence === plan.desiredSequence && plan.desiredSequence > 1 ? plan.desiredSequence - 1 : null,
					next: plan.status === "fetched" && plan.sequence === plan.desiredSequence ? plan.desiredSequence + 1 : null,
					status: plan.status,
					hash,
					rawJson: {
						provider: KETABONLINE_PROVIDER,
						sourcePageId: page.sourcePageId,
						partName: page.partName,
						printedPageNo: page.printedPageNo,
						converter: CONVERTER_VERSION,
						sourceParagraphIds: content.sourceParagraphIds,
						unsupportedFields: page.unsupportedFields,
						contentUpdatedAt: now,
					},
				}));
				const saved = await tx.$queryRaw<{ id: number; sourcePageId: number }[]>(Prisma.sql`
					INSERT INTO "BookPage" ("bookId", "volumeId", "shamelaPageNo", "shamelaUrl", "printedPageNo",
						"previousShamelaPageNo", "nextShamelaPageNo", "rawJson", "sourcePageId", "sourceContentHash",
						"status", "createdAt", "updatedAt")
					SELECT ${input.bookId}, r."volumeId", r.sequence, '', r.printed, r.previous, r.next,
						r."rawJson" || jsonb_build_object('contentVersion', 1), r."sourcePageId", r.hash, r.status, NOW(), NOW()
					FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r("sourcePageId" int, "volumeId" int,
						sequence int, printed int, previous int, next int, status text, hash text, "rawJson" jsonb)
					ON CONFLICT ("bookId", "sourcePageId") DO UPDATE SET
						"volumeId" = EXCLUDED."volumeId", "shamelaPageNo" = EXCLUDED."shamelaPageNo",
						"printedPageNo" = EXCLUDED."printedPageNo",
						"previousShamelaPageNo" = COALESCE(EXCLUDED."previousShamelaPageNo", "BookPage"."previousShamelaPageNo"),
						"nextShamelaPageNo" = COALESCE(EXCLUDED."nextShamelaPageNo", "BookPage"."nextShamelaPageNo"),
						"rawJson" = (EXCLUDED."rawJson" - 'contentVersion') || jsonb_build_object('contentVersion',
							COALESCE(("BookPage"."rawJson"->>'contentVersion')::int, 0) + 1),
						"sourceContentHash" = EXCLUDED."sourceContentHash", "status" = EXCLUDED.status,
						"deletedAt" = NULL, "updatedAt" = NOW()
					RETURNING id, "sourcePageId"
				`);
				const pageIds = new Map(saved.map((row) => [row.sourcePageId, row.id]));
				const ids = [...pageIds.values()];
				await tx.bookPageParagraph.deleteMany({ where: { pageId: { in: ids } } });
				await tx.bookPageFootnote.deleteMany({ where: { pageId: { in: ids } } });
				const paragraphs = changed.flatMap(({ page, content }) =>
					content.paragraphs.map((paragraph) => ({ ...paragraph, pageId: pageIds.get(page.sourcePageId)! })),
				);
				const footnotes = changed.flatMap(({ page, content }) =>
					content.footnotes.map((footnote) => ({ ...footnote, pageId: pageIds.get(page.sourcePageId)! })),
				);
				if (paragraphs.length) {
					await tx.$executeRaw(Prisma.sql`
						INSERT INTO "BookPageParagraph" ("pageId", pid, text, "footnoteIds", "sourceMarks")
						SELECT p."pageId", p.pid, p.text, p."footnoteIds", p."sourceMarks"
						FROM jsonb_to_recordset(${JSON.stringify(paragraphs)}::jsonb)
							AS p("pageId" int, pid int, text text, "footnoteIds" text, "sourceMarks" jsonb)
					`);
				}
				if (footnotes.length) {
					await tx.$executeRaw(Prisma.sql`
						INSERT INTO "BookPageFootnote" ("pageId", marker, type, content, "linkedParagraphs")
						SELECT f."pageId", f.marker, f.type, f.content, f."linkedParagraphs"
						FROM jsonb_to_recordset(${JSON.stringify(footnotes)}::jsonb)
							AS f("pageId" int, marker text, type text, content text, "linkedParagraphs" text)
					`);
				}
				for (const pageId of annotated) {
					const next = await tx.bookPageParagraph.findMany({
						where: { pageId },
						select: { id: true, pid: true, text: true },
						orderBy: { pid: "asc" },
					});
					await rebindPageAnnotations(
						tx,
						pageId,
						previousParagraphs.filter((paragraph) => paragraph.pageId === pageId),
						next,
					);
				}
				await tx.book.update({
					where: { id: input.bookId },
					data: { contentHash: `${input.bookId}-${Date.now()}`, pagesUpdatedAt: new Date() },
				});
			}
			await input.progress(tx);
		},
		{ timeout: 60_000, maxWait: 10_000 },
	);
	return counts;
}

/** Atomically retires removed pages, applies final reading order and adjacency. */
async function publishPages(tx: Tx, bookId: number, plan: Awaited<ReturnType<typeof planPageSequences>>) {
	const snapshot = [...plan.pages.values()];
	const sourceIds = snapshot.map((page) => page.sourcePageId);
	await tx.$executeRaw(Prisma.sql`
		UPDATE "BookPage" SET "deletedAt" = NOW(), "updatedAt" = NOW(),
			"shamelaPageNo" = ${RETIRED_SEQUENCE_BASE} - id
		WHERE "bookId" = ${bookId} AND "deletedAt" IS NULL
			AND ("sourcePageId" IS NULL OR NOT ("sourcePageId" = ANY(${sourceIds}::int[])))
	`);
	const moves = snapshot
		.filter((page) => page.sequence !== page.desiredSequence)
		.map((page) => ({ source: page.sourcePageId, seq: page.desiredSequence }));
	if (moves.length) {
		// Two steps through the negative range avoid transient unique-key collisions.
		await tx.$executeRaw(Prisma.sql`
			UPDATE "BookPage" AS p SET "shamelaPageNo" = -m.seq
			FROM jsonb_to_recordset(${JSON.stringify(moves)}::jsonb) AS m(source int, seq int)
			WHERE p."bookId" = ${bookId} AND p."sourcePageId" = m.source
		`);
		await tx.$executeRaw(Prisma.sql`
			UPDATE "BookPage" SET "shamelaPageNo" = -"shamelaPageNo", "updatedAt" = NOW()
			WHERE "bookId" = ${bookId} AND "shamelaPageNo" < 0 AND "shamelaPageNo" > ${RETIRED_SEQUENCE_BASE}
		`);
	}
	await tx.$executeRaw(Prisma.sql`
		UPDATE "BookPage" SET status = 'fetched', "updatedAt" = NOW()
		WHERE "bookId" = ${bookId} AND "deletedAt" IS NULL AND status <> 'fetched'
			AND "sourcePageId" = ANY(${sourceIds}::int[])
	`);
	await tx.$executeRaw(Prisma.sql`
		UPDATE "BookPage" AS p SET "previousShamelaPageNo" = a.prev, "nextShamelaPageNo" = a.next, "updatedAt" = NOW()
		FROM (
			SELECT id, LAG("shamelaPageNo") OVER w AS prev, LEAD("shamelaPageNo") OVER w AS next
			FROM "BookPage" WHERE "bookId" = ${bookId} AND "deletedAt" IS NULL AND status = 'fetched'
			WINDOW w AS (ORDER BY "shamelaPageNo")
		) AS a
		WHERE p.id = a.id AND (p."previousShamelaPageNo" IS DISTINCT FROM a.prev OR p."nextShamelaPageNo" IS DISTINCT FROM a.next)
	`);
	await tx.book.update({
		where: { id: bookId },
		data: { contentHash: `${bookId}-${Date.now()}`, pagesUpdatedAt: new Date() },
	});
}

/** Publishes the complete validated tree and derives each page's running chapter title. */
async function publishChapters(tx: Tx, bookId: number, nodes: KetabOnlineIndexNode[]) {
	const pages = await tx.bookPage.findMany({
		where: { bookId, deletedAt: null, status: "fetched", sourcePageId: { not: null } },
		select: { id: true, sourcePageId: true, shamelaPageNo: true, chapterTitle: true, volume: { select: { number: true } } },
		orderBy: { shamelaPageNo: "asc" },
	});
	const bySource = new Map(pages.map((page) => [page.sourcePageId!, page]));
	const key = (id: number) => `${KETABONLINE_PROVIDER}:${id}`;
	const rows = nodes.map((node) => {
		const page = bySource.get(node.sourcePageId);
		if (!page) throw new KetabOnlineError("incomplete_index", "A chapter points to a page that was not saved.", true);
		return {
			key: key(node.sourceNodeId),
			title: node.title,
			pageNo: page.shamelaPageNo,
			pageId: page.id,
			depth: node.depth,
			sortOrder: node.sortOrder,
			volume: node.volumeNumber,
			metadata: {
				provider: KETABONLINE_PROVIDER,
				sourceNodeId: node.sourceNodeId,
				sourcePageId: node.sourcePageId,
				toSourcePageId: node.toSourcePageId,
				printedPageNo: node.printedPageNo,
				partName: node.partName,
			},
		};
	});
	for (let offset = 0; offset < rows.length; offset += 1000) {
		await tx.$executeRaw(Prisma.sql`
			INSERT INTO "BookTocNode" ("bookId", "pageId", kind, title, "shamelaPageNo", "volumeNumber", depth,
				"sortOrder", "treePath", "metadataJson", "updatedAt")
			SELECT ${bookId}, n."pageId", CASE WHEN n.depth = 0 THEN 'chapter' ELSE 'topic' END, n.title, n."pageNo",
				n.volume, n.depth, n."sortOrder", n.key, n.metadata, NOW()
			FROM jsonb_to_recordset(${JSON.stringify(rows.slice(offset, offset + 1000))}::jsonb)
				AS n(key text, title text, "pageNo" int, "pageId" int, depth int, "sortOrder" int, volume int, metadata jsonb)
			ON CONFLICT ("bookId", "treePath") DO UPDATE SET
				"pageId" = EXCLUDED."pageId", title = EXCLUDED.title, kind = EXCLUDED.kind,
				"shamelaPageNo" = EXCLUDED."shamelaPageNo", "volumeNumber" = EXCLUDED."volumeNumber",
				depth = EXCLUDED.depth, "sortOrder" = EXCLUDED."sortOrder", "metadataJson" = EXCLUDED."metadataJson",
				"deletedAt" = NULL, "updatedAt" = NOW(), "shamelaPath" = NULL, "isCurrent" = FALSE
		`);
	}
	const edges = nodes.map((node) => ({
		key: key(node.sourceNodeId),
		parent: node.parentSourceNodeId == null ? null : key(node.parentSourceNodeId),
	}));
	await tx.$executeRaw(Prisma.sql`
		UPDATE "BookTocNode" AS child SET "parentId" = parent.id
		FROM jsonb_to_recordset(${JSON.stringify(edges)}::jsonb) AS edge(key text, parent text)
		LEFT JOIN "BookTocNode" AS parent ON parent."bookId" = ${bookId} AND parent."treePath" = edge.parent
		WHERE child."bookId" = ${bookId} AND child."treePath" = edge.key
			AND child."parentId" IS DISTINCT FROM parent.id
	`);
	await tx.bookTocNode.updateMany({
		where: { bookId, deletedAt: null, treePath: { notIn: rows.map((row) => row.key) } },
		data: { deletedAt: new Date() },
	});

	// The latest heading at or before a page, within the same volume, is the reader's
	// running chapter title; a volume's front matter does not inherit the previous volume.
	const headings = [...rows].sort((a, b) => a.pageNo - b.pageNo || a.sortOrder - b.sortOrder);
	const titles: { id: number; title: string | null }[] = [];
	let cursor = -1;
	for (const page of pages) {
		while (cursor + 1 < headings.length && headings[cursor + 1]!.pageNo <= page.shamelaPageNo) cursor++;
		const heading = cursor >= 0 ? headings[cursor]! : null;
		const title = heading && heading.volume === page.volume?.number ? heading.title : null;
		if (title !== page.chapterTitle) titles.push({ id: page.id, title });
	}
	if (titles.length) {
		await tx.$executeRaw(Prisma.sql`
			UPDATE "BookPage" AS p SET "chapterTitle" = t.title, "updatedAt" = NOW()
			FROM jsonb_to_recordset(${JSON.stringify(titles)}::jsonb) AS t(id int, title text)
			WHERE p.id = t.id
		`);
	}
	await tx.book.update({
		where: { id: bookId },
		data: {
			tocStatus: "complete",
			tocCapturedAt: new Date(),
			...(titles.length ? { contentHash: `${bookId}-${Date.now()}`, pagesUpdatedAt: new Date() } : {}),
		},
	});
}
