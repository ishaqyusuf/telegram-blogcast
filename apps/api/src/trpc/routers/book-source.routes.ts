import type { Database } from "@acme/db";
import {
	KETABONLINE_LIMITS,
	KETABONLINE_PROVIDER,
	KetabOnlineError,
} from "@acme/document/book/ketabonline";
import { sourceImportActiveKey } from "@acme/jobs/book-source-import";
import { dispatchSourceImport } from "@acme/jobs/dispatch-source-import";
import { createKetabOnlineClient } from "@acme/jobs/ketabonline-client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";

const RETRY_LIMIT = 10;
const STARTS_PER_HOUR = 20;

const publicImport = {
	id: true,
	provider: true,
	sourceBookId: true,
	bookId: true,
	status: true,
	phase: true,
	generation: true,
	title: true,
	pagesTotal: true,
	pagesSaved: true,
	volumesTotal: true,
	volumesIndexed: true,
	chaptersTotal: true,
	chaptersSaved: true,
	createdAt: true,
	updatedAt: true,
	completedAt: true,
} as const;

const importSelect = { ...publicImport, ownerHash: true, errorCode: true, errorMessage: true } as const;

const sourceBookId = z.number().int().positive().max(KETABONLINE_LIMITS.maxBookId);

// Interactive requests get one short upstream attempt; the worker owns long transfers.
const interactiveClient = () => createKetabOnlineClient({ attempts: 1, requestTimeoutMs: 10_000 });

const importProcedure = publicProcedure.use(({ ctx, next }) => {
	if (!ctx.bookImportOwnerHash)
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Update the app to import books securely." });
	return next({ ctx: { ...ctx, bookImportOwnerHash: ctx.bookImportOwnerHash } });
});

function upstreamError(error: unknown): never {
	if (!(error instanceof KetabOnlineError)) throw error;
	const code =
		error.code === "invalid_id"
			? "BAD_REQUEST"
			: error.code === "not_found" || error.code === "unavailable"
				? "NOT_FOUND"
				: error.code === "rate_limited"
					? "TOO_MANY_REQUESTS"
					: error.code === "too_large"
						? "PAYLOAD_TOO_LARGE"
						: "BAD_GATEWAY";
	throw new TRPCError({ code, message: error.message, cause: error });
}

type ImportRow = { ownerHash: string; errorCode: string | null; errorMessage: string | null; bookId: number | null } & Record<string, unknown>;

/** Only the starting installation sees failure details or may manage the job. */
async function toView<T extends ImportRow>(db: Database, job: T, ownerHash: string | undefined) {
	const { ownerHash: jobOwner, errorCode, errorMessage, ...visible } = job;
	const canManage = Boolean(ownerHash && jobOwner === ownerHash);
	const firstPage = job.bookId
		? await db.bookPage.findFirst({
				where: { bookId: job.bookId, deletedAt: null, status: "fetched" },
				orderBy: { shamelaPageNo: "asc" },
				select: { id: true },
			})
		: null;
	return {
		...visible,
		canManage,
		errorCode: canManage ? errorCode : null,
		errorMessage: canManage ? errorMessage : null,
		firstPageId: firstPage?.id ?? null,
	};
}

async function dispatchSaved(db: Database, job: { id: string; generation: number; status: string }) {
	if (job.status !== "queued") return;
	try {
		await dispatchSourceImport(db, { importId: job.id, generation: job.generation });
	} catch {
		// The recovery schedule dispatches saved jobs even after the app closes.
		await db.bookSourceImport.updateMany({
			where: { id: job.id, generation: job.generation, status: "queued", runId: null },
			data: { errorMessage: "Saved. Waiting for the import worker; you can leave this screen." },
		});
	}
}

async function localBooks(db: Database, ids: number[]) {
	if (!ids.length) return new Map<number, number>();
	const books = await db.book.findMany({
		where: { sourceProvider: KETABONLINE_PROVIDER, sourceBookId: { in: ids }, deletedAt: null },
		select: { id: true, sourceBookId: true },
	});
	return new Map(books.map((book) => [book.sourceBookId!, book.id]));
}

export const bookSourceRoutes = createTRPCRouter({
	search: publicProcedure
		.input(
			z.object({
				query: z.string().trim().min(2).max(KETABONLINE_LIMITS.maxSearchQueryLength),
				page: z.number().int().min(1).max(500).default(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			const result = await interactiveClient()
				.search({ query: input.query, page: input.page, limit: 10 })
				.catch(upstreamError);
			const local = await localBooks(ctx.db, result.items.map((item) => item.id));
			return {
				...result,
				items: result.items.map((item) => ({ ...item, localBookId: local.get(item.id) ?? null })),
			};
		}),

	preview: publicProcedure.input(z.object({ sourceBookId })).query(async ({ ctx, input }) => {
		const [local, latest] = await Promise.all([
			localBooks(ctx.db, [input.sourceBookId]),
			ctx.db.bookSourceImport.findFirst({
				where: { provider: KETABONLINE_PROVIDER, sourceBookId: input.sourceBookId },
				orderBy: { createdAt: "desc" },
				select: importSelect,
			}),
		]);
		const latestImport = latest ? await toView(ctx.db, latest, ctx.bookImportOwnerHash) : null;
		const localBookId = local.get(input.sourceBookId) ?? null;
		try {
			const book = await interactiveClient().metadata(input.sourceBookId);
			const available = Boolean(book.contentUrl) && book.pagesCount > 0;
			return {
				sourceBookId: book.id,
				title: book.title,
				authors: book.authors,
				categories: book.categories,
				publisher: book.publisher,
				source: book.source,
				description: book.description?.slice(0, 600) ?? null,
				pagesCount: book.pagesCount,
				volumesCount: book.parts.length,
				chaptersCount: book.indexCount,
				coverColor: book.colors[0] ?? null,
				available,
				unavailableReason: available ? null : "KetabOnline does not provide readable text for this book.",
				localBookId,
				latestImport,
			};
		} catch (error) {
			if (error instanceof KetabOnlineError && (error.code === "not_found" || error.code === "unavailable")) {
				// A missing book is an explained outcome, not a transport failure.
				return {
					sourceBookId: input.sourceBookId,
					title: null,
					authors: [],
					categories: [],
					publisher: null,
					source: null,
					description: null,
					pagesCount: 0,
					volumesCount: 0,
					chaptersCount: 0,
					coverColor: null,
					available: false,
					unavailableReason: error.message,
					localBookId,
					latestImport,
				};
			}
			upstreamError(error);
		}
	}),

	start: importProcedure.input(z.object({ sourceBookId })).mutation(async ({ ctx, input }) => {
		const activeKey = sourceImportActiveKey(KETABONLINE_PROVIDER, input.sourceBookId);
		const job = await ctx.db.$transaction(async (tx) => {
			// Prisma cannot deserialize PostgreSQL's void return type.
			await tx.$queryRaw`SELECT pg_advisory_xact_lock(8174, ${input.sourceBookId})::text`;
			const active = await tx.bookSourceImport.findUnique({
				where: { activeKey },
				select: { ...importSelect, runId: true },
			});
			if (active) return active;
			const recent = await tx.bookSourceImport.count({
				where: { ownerHash: ctx.bookImportOwnerHash, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
			});
			if (recent >= STARTS_PER_HOUR)
				throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many imports this hour. Try again later." });
			return tx.bookSourceImport.create({
				data: {
					provider: KETABONLINE_PROVIDER,
					sourceBookId: input.sourceBookId,
					ownerHash: ctx.bookImportOwnerHash,
					activeKey,
				},
				select: { ...importSelect, runId: true },
			});
		});
		if (!job.runId) await dispatchSaved(ctx.db, job);
		const current = await ctx.db.bookSourceImport.findUniqueOrThrow({ where: { id: job.id }, select: importSelect });
		return toView(ctx.db, current, ctx.bookImportOwnerHash);
	}),

	status: publicProcedure.input(z.object({ importId: z.string().uuid() })).query(async ({ ctx, input }) => {
		const job = await ctx.db.bookSourceImport.findUnique({ where: { id: input.importId }, select: importSelect });
		if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "This import no longer exists." });
		return toView(ctx.db, job, ctx.bookImportOwnerHash);
	}),

	mine: publicProcedure
		.input(z.object({ limit: z.number().int().min(1).max(20).default(10) }))
		.query(async ({ ctx, input }) => {
			if (!ctx.bookImportOwnerHash) return [];
			const jobs = await ctx.db.bookSourceImport.findMany({
				where: { ownerHash: ctx.bookImportOwnerHash },
				orderBy: { createdAt: "desc" },
				take: input.limit,
				select: importSelect,
			});
			return Promise.all(jobs.map((job) => toView(ctx.db, job, ctx.bookImportOwnerHash)));
		}),

	latestForBook: publicProcedure.input(z.object({ bookId: z.number().int().positive() })).query(async ({ ctx, input }) => {
		const job = await ctx.db.bookSourceImport.findFirst({
			where: { bookId: input.bookId },
			orderBy: { createdAt: "desc" },
			select: importSelect,
		});
		return job ? toView(ctx.db, job, ctx.bookImportOwnerHash) : null;
	}),

	retry: importProcedure.input(z.object({ importId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
		const job = await ctx.db.$transaction(async (tx) => {
			const existing = await tx.bookSourceImport.findUnique({ where: { id: input.importId } });
			if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "This import no longer exists." });
			if (existing.ownerHash !== ctx.bookImportOwnerHash)
				throw new TRPCError({ code: "FORBIDDEN", message: "Only the device that started this import can retry it." });
			await tx.$queryRaw`SELECT pg_advisory_xact_lock(8174, ${existing.sourceBookId})::text`;
			const current = await tx.bookSourceImport.findUniqueOrThrow({ where: { id: existing.id } });
			if (!["failed", "cancelled", "unavailable"].includes(current.status)) return current;
			if (current.generation >= RETRY_LIMIT)
				throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Retry limit reached. Start a new import later." });
			const activeKey = sourceImportActiveKey(current.provider, current.sourceBookId);
			const other = await tx.bookSourceImport.findUnique({ where: { activeKey }, select: { id: true } });
			if (other)
				throw new TRPCError({ code: "CONFLICT", message: "This book is already being imported." });
			return tx.bookSourceImport.update({
				where: { id: current.id },
				data: {
					generation: { increment: 1 },
					status: "queued",
					phase: "queued",
					activeKey,
					runId: null,
					errorCode: null,
					errorMessage: null,
					completedAt: null,
					pagesSaved: 0,
					volumesIndexed: 0,
					chaptersSaved: 0,
				},
			});
		});
		if (!job.runId) await dispatchSaved(ctx.db, job);
		const current = await ctx.db.bookSourceImport.findUniqueOrThrow({ where: { id: job.id }, select: importSelect });
		return toView(ctx.db, current, ctx.bookImportOwnerHash);
	}),

	cancel: importProcedure.input(z.object({ importId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
		const job = await ctx.db.bookSourceImport.findUnique({ where: { id: input.importId }, select: { ownerHash: true } });
		if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "This import no longer exists." });
		if (job.ownerHash !== ctx.bookImportOwnerHash)
			throw new TRPCError({ code: "FORBIDDEN", message: "Only the device that started this import can cancel it." });
		// The worker checks its generation before every write batch, so it stops publishing.
		await ctx.db.bookSourceImport.updateMany({
			where: { id: input.importId, status: { in: ["queued", "running"] } },
			data: { status: "cancelled", activeKey: null, errorCode: null, errorMessage: "Cancelled. Saved pages stay readable." },
		});
		const current = await ctx.db.bookSourceImport.findUniqueOrThrow({ where: { id: input.importId }, select: importSelect });
		return toView(ctx.db, current, ctx.bookImportOwnerHash);
	}),
});
