import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MAX_CHAPTER_HTML_BYTES } from "@acme/jobs/book-chapter-import";
import { dispatchChapterImport } from "@acme/jobs/dispatch-chapter-import";
import { createTRPCRouter, publicProcedure } from "../init";

const publicImport = {
	id: true,
	bookId: true,
	returnPageId: true,
	status: true,
	generation: true,
	nodeCount: true,
	errorMessage: true,
	createdAt: true,
	updatedAt: true,
	completedAt: true,
} as const;

const importProcedure = publicProcedure.use(({ ctx, next }) => {
	if (!ctx.bookImportOwnerHash)
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Update the app to manage chapter imports securely.",
		});
	return next({
		ctx: { ...ctx, bookImportOwnerHash: ctx.bookImportOwnerHash },
	});
});

export const bookChapterRoutes = createTRPCRouter({
	tree: publicProcedure
		.input(z.object({ bookId: z.number().int().positive() }))
		.query(async ({ ctx, input }) => {
			// One lean snapshot lets the client expand every branch without N+1 requests.
			const rows = await ctx.db.bookTocNode.findMany({
				where: {
					bookId: input.bookId,
					deletedAt: null,
					book: { deletedAt: null },
				},
				select: {
					id: true,
					parentId: true,
					title: true,
					sortOrder: true,
					shamelaPageNo: true,
				},
			});
			return {
				items: rows.map(({ shamelaPageNo, ...node }) => ({
					...node,
					sourcePageNo: shamelaPageNo,
				})),
			};
		}),
	list: publicProcedure
		.input(
			z.object({
				bookId: z.number().int().positive(),
				parentId: z.number().int().positive().nullable().default(null),
				q: z.string().trim().max(200).default(""),
				cursor: z.number().int().positive().optional(),
				limit: z.number().int().min(1).max(100).default(40),
			}),
		)
		.query(async ({ ctx, input }) => {
			const pageNo = /^\d+$/.test(input.q) ? Number(input.q) : undefined;
			const rows = await ctx.db.bookTocNode.findMany({
				where: {
					bookId: input.bookId,
					deletedAt: null,
					...(input.q
						? {
								OR: [
									{
										title: { contains: input.q, mode: "insensitive" as const },
									},
									...(pageNo !== undefined ? [{ shamelaPageNo: pageNo }] : []),
								],
							}
						: { parentId: input.parentId }),
					book: { deletedAt: null },
				},
				orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
				...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
				take: input.limit + 1,
				select: {
					id: true,
					parentId: true,
					title: true,
					depth: true,
					sortOrder: true,
					shamelaPageNo: true,
					parent: { select: { title: true } },
					page: { select: { id: true, status: true, deletedAt: true } },
					_count: { select: { children: { where: { deletedAt: null } } } },
				},
			});
			const hasMore = rows.length > input.limit;
			const items = rows.slice(0, input.limit).map((row) => ({
				id: row.id,
				parentId: row.parentId,
				title: row.title,
				depth: row.depth,
				sortOrder: row.sortOrder,
				sourcePageNo: row.shamelaPageNo,
				parentTitle: row.parent?.title ?? null,
				childCount: row._count.children,
				pageId:
					row.page?.status === "fetched" && !row.page.deletedAt
						? row.page.id
						: null,
			}));
			return { items, nextCursor: hasMore ? items.at(-1)?.id : undefined };
		}),

	resolvePage: publicProcedure
		.input(
			z.object({
				bookId: z.number().int().positive(),
				sourcePageNo: z.number().int().positive(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const book = await ctx.db.book.findFirstOrThrow({
				where: { id: input.bookId, deletedAt: null },
				select: { shamelaId: true, shamelaUrl: true },
			});
			const page = await ctx.db.bookPage.findFirst({
				where: {
					bookId: input.bookId,
					shamelaPageNo: input.sourcePageNo,
					deletedAt: null,
					status: "fetched",
				},
				select: { id: true },
			});
			if (page) return { pageId: page.id, sourceUrl: null };
			let sourceBookId = book.shamelaId;
			if (!sourceBookId && book.shamelaUrl) {
				try {
					const url = new URL(book.shamelaUrl, "https://shamela.ws");
					if (url.hostname === "shamela.ws" && url.protocol === "https:") {
						sourceBookId =
							Number(url.pathname.match(/^\/book\/(\d+)(?:\/|$)/)?.[1]) || null;
					}
				} catch {}
			}
			if (!sourceBookId)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "This page has no Shamela source.",
				});
			return {
				pageId: null,
				sourceUrl: `https://shamela.ws/book/${sourceBookId}/${input.sourcePageNo}`,
			};
		}),
	bookState: publicProcedure
		.input(z.object({ bookId: z.number().int().positive() }))
		.query(({ ctx, input }) =>
			ctx.db.book.findFirstOrThrow({
				where: { id: input.bookId, deletedAt: null },
				select: {
					id: true,
					shamelaId: true,
					tocStatus: true,
					chapterImports: {
						orderBy: { createdAt: "desc" },
						take: 1,
						select: publicImport,
					},
					pages: {
						where: { status: "fetched", deletedAt: null },
						orderBy: { shamelaPageNo: "asc" },
						take: 1,
						select: { id: true },
					},
				},
			}),
		),
	capture: importProcedure
		.input(
			z.object({
				bookId: z.number().int().positive(),
				pageId: z.number().int().positive(),
				finalUrl: z.string().url(),
				html: z.string().min(1).max(MAX_CHAPTER_HTML_BYTES),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const url = new URL(input.finalUrl);
			const match = url.pathname.match(/^\/book\/(\d+)\/?$/);
			if (
				url.protocol !== "https:" ||
				url.hostname !== "shamela.ws" ||
				!match ||
				url.username ||
				url.password
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Capture chapters from the Shamela book root.",
				});
			}
			if (Buffer.byteLength(input.html, "utf8") > MAX_CHAPTER_HTML_BYTES) {
				throw new TRPCError({
					code: "PAYLOAD_TOO_LARGE",
					message: "Chapter capture is too large.",
				});
			}
			const book = await ctx.db.book.findFirstOrThrow({
				where: { id: input.bookId, deletedAt: null },
				select: { shamelaId: true },
			});
			if (book.shamelaId !== Number(match[1])) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This chapter index belongs to a different book.",
				});
			}
			await ctx.db.bookPage.findFirstOrThrow({
				where: {
					id: input.pageId,
					bookId: input.bookId,
					deletedAt: null,
					status: "fetched",
				},
				select: { id: true },
			});
			const captureHash = createHash("sha256").update(input.html).digest("hex");
			const job = await ctx.db.$transaction(async (tx) => {
				// Prisma cannot deserialize PostgreSQL's void return type.
				await tx.$queryRaw`SELECT pg_advisory_xact_lock(8173, ${input.bookId})::text`;
				const existing = await tx.bookChapterImport.findUnique({
					where: { bookId_captureHash: { bookId: input.bookId, captureHash } },
					select: { ...publicImport, runId: true, ownerHash: true },
				});
				const replaceTerminal =
					existing &&
					["failed", "cancelled"].includes(existing.status) &&
					(existing.ownerHash !== ctx.bookImportOwnerHash ||
						existing.generation >= 5);
				if (existing && !replaceTerminal) return existing;
				const count = await tx.bookChapterImport.count({
					where: {
						bookId: input.bookId,
						createdAt: { gt: new Date(Date.now() - 60 * 60_000) },
					},
				});
				if (count >= 10)
					throw new TRPCError({
						code: "TOO_MANY_REQUESTS",
						message:
							"This book has too many recent captures. Use the saved import or retry later.",
					});
				if (existing) {
					// Retain the old attempt and its ownership while releasing the deduplication key.
					await tx.bookChapterImport.update({
						where: { id: existing.id },
						data: { captureHash: `${captureHash}:${existing.id}` },
					});
				}
				return tx.bookChapterImport.upsert({
					where: { bookId_captureHash: { bookId: input.bookId, captureHash } },
					create: {
						ownerHash: ctx.bookImportOwnerHash,
						bookId: input.bookId,
						returnPageId: input.pageId,
						captureHash,
						rawHtml: input.html,
					},
					update: {},
					select: { ...publicImport, runId: true },
				});
			});
			if (job.status === "queued" && !job.runId) {
				try {
					await dispatchChapterImport(ctx.db, {
						importId: job.id,
						generation: job.generation,
					});
				} catch {
					// The durable outbox sweeper retries dispatch even after the app closes.
					await ctx.db.bookChapterImport.updateMany({
						where: { id: job.id, status: "queued", runId: null },
						data: {
							errorMessage:
								"Capture saved. Waiting for the chapter worker; you may leave this screen.",
						},
					});
				}
			}
			return ctx.db.bookChapterImport.findUniqueOrThrow({
				where: { id: job.id },
				select: publicImport,
			});
		}),

	status: publicProcedure
		.input(z.object({ importId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const job = await ctx.db.bookChapterImport.findUniqueOrThrow({
				where: { id: input.importId },
				select: { ...publicImport, ownerHash: true },
			});
			const { ownerHash, ...visible } = job;
			return {
				...visible,
				canManage: Boolean(ownerHash && ownerHash === ctx.bookImportOwnerHash),
			};
		}),

	latest: publicProcedure
		.input(z.object({ bookId: z.number().int().positive() }))
		.query(({ ctx, input }) =>
			ctx.db.bookChapterImport.findFirst({
				where: { bookId: input.bookId },
				orderBy: { createdAt: "desc" },
				select: publicImport,
			}),
		),

	retry: importProcedure
		.input(z.object({ importId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const job = await ctx.db.$transaction(async (tx) => {
				const existing = await tx.bookChapterImport.findUniqueOrThrow({
					where: { id: input.importId },
				});
				if (existing.ownerHash !== ctx.bookImportOwnerHash)
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Only the device that started this import can retry it.",
					});
				await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${existing.bookId} FOR UPDATE`;
				const current = await tx.bookChapterImport.findUniqueOrThrow({
					where: { id: input.importId },
				});
				if (!["failed", "cancelled"].includes(current.status)) return current;
				if (current.generation >= 5)
					throw new TRPCError({
						code: "TOO_MANY_REQUESTS",
						message: "Retry limit reached. Capture the book root again later.",
					});
				return tx.bookChapterImport.update({
					where: { id: current.id },
					data: {
						generation: { increment: 1 },
						status: "queued",
						runId: null,
						errorMessage: null,
						completedAt: null,
					},
				});
			});
			if (job.status === "queued") {
				try {
					await dispatchChapterImport(ctx.db, {
						importId: job.id,
						generation: job.generation,
					});
				} catch {
					/* Saved outbox entry will be dispatched by the worker sweeper. */
				}
			}
			return ctx.db.bookChapterImport.findUniqueOrThrow({
				where: { id: job.id },
				select: publicImport,
			});
		}),

	cancel: importProcedure
		.input(z.object({ importId: z.string().uuid() }))
		.mutation(({ ctx, input }) =>
			ctx.db.$transaction(async (tx) => {
				const job = await tx.bookChapterImport.findUniqueOrThrow({
					where: { id: input.importId },
				});
				if (job.ownerHash !== ctx.bookImportOwnerHash)
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Only the device that started this import can cancel it.",
					});
				await tx.bookChapterImport.updateMany({
					where: { id: job.id, status: { in: ["queued", "running"] } },
					data: { status: "cancelled" },
				});
				return tx.bookChapterImport.findUniqueOrThrow({
					where: { id: job.id },
					select: publicImport,
				});
			}),
		),
});
