import type { Database } from "@acme/db";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";

function getDefaultLibraryUserId(): number {
	return 1;
}

function getCurrentLibraryUserId(ctx: { userId?: number | null }): number {
	return ctx.userId ?? getDefaultLibraryUserId();
}

const libraryVolumeInput = z.object({
	volumeNumber: z.number().int().min(1),
	title: z.string().trim().optional().nullable(),
	locationId: z.number().int().optional().nullable(),
	shelfNumber: z.string().trim().optional().nullable(),
	catalogCode: z.string().trim().optional().nullable(),
	condition: z.string().trim().optional().nullable(),
	status: z.string().trim().optional().nullable(),
	notes: z.string().trim().optional().nullable(),
});

const libraryItemInput = z.object({
	bookId: z.number().int().optional().nullable(),
	titleAr: z.string().trim().min(1),
	titleEn: z.string().trim().optional().nullable(),
	authorText: z.string().trim().optional().nullable(),
	publisher: z.string().trim().optional().nullable(),
	edition: z.string().trim().optional().nullable(),
	printYear: z.string().trim().optional().nullable(),
	isbn: z.string().trim().optional().nullable(),
	description: z.string().trim().optional().nullable(),
	notes: z.string().trim().optional().nullable(),
	volumeCount: z.number().int().min(1).max(999).default(1),
	locationId: z.number().int().optional().nullable(),
	shelfNumber: z.string().trim().optional().nullable(),
	catalogCode: z.string().trim().optional().nullable(),
	purchaseDate: z.string().trim().optional().nullable(),
	purchasePriceAmount: z.number().nonnegative().optional().nullable(),
	purchaseCurrency: z.string().trim().optional().nullable(),
	purchaseSource: z.string().trim().optional().nullable(),
	condition: z.string().trim().optional().nullable(),
	status: z.string().trim().optional().nullable(),
	coverImageUrl: z.string().trim().optional().nullable(),
	labelIds: z.array(z.number().int()).default([]),
	volumes: z.array(libraryVolumeInput).optional(),
});

function normalizeOptionalDate(value?: string | null): Date | null | undefined {
	if (value === undefined) return undefined;
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date;
}

function toItemData(input: z.infer<typeof libraryItemInput>) {
	return {
		bookId: input.bookId ?? null,
		titleAr: input.titleAr,
		titleEn: input.titleEn ?? null,
		authorText: input.authorText ?? null,
		publisher: input.publisher ?? null,
		edition: input.edition ?? null,
		printYear: input.printYear ?? null,
		isbn: input.isbn ?? null,
		description: input.description ?? null,
		notes: input.notes ?? null,
		volumeCount: input.volumeCount,
		locationId: input.locationId ?? null,
		shelfNumber: input.shelfNumber ?? null,
		catalogCode: input.catalogCode ?? null,
		purchaseDate: normalizeOptionalDate(input.purchaseDate),
		purchasePriceAmount: input.purchasePriceAmount ?? null,
		purchaseCurrency: input.purchaseCurrency?.toUpperCase() ?? null,
		purchaseSource: input.purchaseSource ?? null,
		condition: input.condition ?? null,
		status: input.status ?? "owned",
		coverImageUrl: input.coverImageUrl ?? null,
	};
}

function toVolumeData(volume: z.infer<typeof libraryVolumeInput>) {
	return {
		volumeNumber: volume.volumeNumber,
		title: volume.title ?? null,
		locationId: volume.locationId ?? null,
		shelfNumber: volume.shelfNumber ?? null,
		catalogCode: volume.catalogCode ?? null,
		condition: volume.condition ?? null,
		status: volume.status ?? "owned",
		notes: volume.notes ?? null,
		deletedAt: null,
	};
}

const libraryItemInclude = {
	location: true,
	labels: true,
	volumes: {
		where: { deletedAt: null },
		include: { location: true },
		orderBy: { volumeNumber: "asc" },
	},
	book: {
		select: {
			id: true,
			nameAr: true,
			nameEn: true,
			coverUrl: true,
			coverColor: true,
			shamelaId: true,
			shamelaUrl: true,
			sourceType: true,
			editable: true,
			authors: true,
			pages: {
				where: { status: "fetched" },
				orderBy: { shamelaPageNo: "asc" },
				take: 1,
				select: { id: true, shamelaPageNo: true },
			},
		},
	},
} as const;

async function replaceLibraryVolumes(
	db: Database,
	libraryItemId: number,
	volumes?: z.infer<typeof libraryVolumeInput>[],
) {
	if (!volumes) return;

	const activeNumbers = volumes.map((volume) => volume.volumeNumber);
	await db.libraryVolume.updateMany({
		where: {
			libraryItemId,
			volumeNumber: { notIn: activeNumbers.length ? activeNumbers : [-1] },
			deletedAt: null,
		},
		data: { deletedAt: new Date() },
	});

	for (const volume of volumes) {
		await db.libraryVolume.upsert({
			where: {
				libraryItemId_volumeNumber: {
					libraryItemId,
					volumeNumber: volume.volumeNumber,
				},
			},
			create: {
				libraryItemId,
				...toVolumeData(volume),
			},
			update: toVolumeData(volume),
		});
	}
}

export const libraryRoutes = createTRPCRouter({
	getLocations: publicProcedure.query(async ({ ctx }) => {
		const ownerUserId = getCurrentLibraryUserId(ctx);
		return ctx.db.libraryLocation.findMany({
			where: { ownerUserId, deletedAt: null },
			orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
		});
	}),

	createLocation: publicProcedure
		.input(
			z.object({
				name: z.string().trim().min(1),
				room: z.string().trim().optional().nullable(),
				bookcase: z.string().trim().optional().nullable(),
				shelf: z.string().trim().optional().nullable(),
				row: z.string().trim().optional().nullable(),
				position: z.string().trim().optional().nullable(),
				description: z.string().trim().optional().nullable(),
				sortOrder: z.number().int().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			return ctx.db.libraryLocation.create({
				data: {
					ownerUserId,
					name: input.name,
					room: input.room ?? null,
					bookcase: input.bookcase ?? null,
					shelf: input.shelf ?? null,
					row: input.row ?? null,
					position: input.position ?? null,
					description: input.description ?? null,
					sortOrder: input.sortOrder ?? 0,
				},
			});
		}),

	getLabels: publicProcedure.query(async ({ ctx }) => {
		const ownerUserId = getCurrentLibraryUserId(ctx);
		return ctx.db.libraryLabel.findMany({
			where: { ownerUserId, deletedAt: null },
			orderBy: { name: "asc" },
		});
	}),

	createLabel: publicProcedure
		.input(
			z.object({
				name: z.string().trim().min(1),
				color: z.string().trim().optional().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			return ctx.db.libraryLabel.upsert({
				where: { ownerUserId_name: { ownerUserId, name: input.name } },
				create: {
					ownerUserId,
					name: input.name,
					color: input.color ?? null,
				},
				update: {
					color: input.color ?? null,
					deletedAt: null,
				},
			});
		}),

	getItems: publicProcedure
		.input(
			z.object({
				query: z.string().trim().optional(),
				locationId: z.number().int().optional(),
				labelIds: z.array(z.number().int()).optional(),
				linked: z.boolean().optional(),
				status: z.string().trim().optional(),
				cursor: z.number().int().optional(),
				limit: z.number().int().min(1).max(100).default(40),
			}),
		)
		.query(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			const search = input.query?.trim();
			const db = ctx.db;
			const items = await db.libraryItem.findMany({
				where: {
					ownerUserId,
					deletedAt: null,
					...(input.cursor ? { id: { lt: input.cursor } } : {}),
					...(input.locationId ? { locationId: input.locationId } : {}),
					...(input.status ? { status: input.status } : {}),
					...(input.linked === true ? { bookId: { not: null } } : {}),
					...(input.linked === false ? { bookId: null } : {}),
					...(input.labelIds?.length
						? { labels: { some: { id: { in: input.labelIds } } } }
						: {}),
					...(search
						? {
								OR: [
									{ titleAr: { contains: search, mode: "insensitive" } },
									{ titleEn: { contains: search, mode: "insensitive" } },
									{ authorText: { contains: search, mode: "insensitive" } },
									{ publisher: { contains: search, mode: "insensitive" } },
									{ shelfNumber: { contains: search, mode: "insensitive" } },
									{ catalogCode: { contains: search, mode: "insensitive" } },
									{ notes: { contains: search, mode: "insensitive" } },
									{
										book: {
											OR: [
												{ nameAr: { contains: search, mode: "insensitive" } },
												{ nameEn: { contains: search, mode: "insensitive" } },
											],
										},
									},
								],
							}
						: {}),
				},
				include: libraryItemInclude,
				take: input.limit + 1,
				orderBy: { id: "desc" },
			});

			const hasMore = items.length > input.limit;
			const data = hasMore ? items.slice(0, -1) : items;
			return {
				data,
				nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
			};
		}),

	getItem: publicProcedure
		.input(z.object({ id: z.number().int() }))
		.query(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			return ctx.db.libraryItem.findFirstOrThrow({
				where: { id: input.id, ownerUserId, deletedAt: null },
				include: libraryItemInclude,
			});
		}),

	createItem: publicProcedure
		.input(libraryItemInput)
		.mutation(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			const db = ctx.db;
			const item = await db.libraryItem.create({
				data: {
					ownerUserId,
					...toItemData(input),
					labels: {
						connect: input.labelIds.map((id) => ({ id })),
					},
				},
				include: libraryItemInclude,
			});
			await replaceLibraryVolumes(db, item.id, input.volumes);
			return db.libraryItem.findFirstOrThrow({
				where: { id: item.id },
				include: libraryItemInclude,
			});
		}),

	updateItem: publicProcedure
		.input(libraryItemInput.extend({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			const db = ctx.db;
			await db.libraryItem.findFirstOrThrow({
				where: { id: input.id, ownerUserId, deletedAt: null },
				select: { id: true },
			});
			const item = await db.libraryItem.update({
				where: { id: input.id },
				data: {
					...toItemData(input),
					labels: {
						set: input.labelIds.map((id) => ({ id })),
					},
				},
				include: libraryItemInclude,
			});
			await replaceLibraryVolumes(db, item.id, input.volumes);
			return db.libraryItem.findFirstOrThrow({
				where: { id: item.id },
				include: libraryItemInclude,
			});
		}),

	deleteItem: publicProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			const db = ctx.db;
			await db.libraryItem.findFirstOrThrow({
				where: { id: input.id, ownerUserId, deletedAt: null },
				select: { id: true },
			});
			return db.libraryItem.update({
				where: { id: input.id },
				data: { deletedAt: new Date() },
			});
		}),

	linkDigitalBook: publicProcedure
		.input(z.object({ id: z.number().int(), bookId: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			const db = ctx.db;
			await db.book.findFirstOrThrow({
				where: { id: input.bookId, deletedAt: null },
				select: { id: true },
			});
			await db.libraryItem.findFirstOrThrow({
				where: { id: input.id, ownerUserId, deletedAt: null },
				select: { id: true },
			});
			return db.libraryItem.update({
				where: { id: input.id },
				data: { bookId: input.bookId },
				include: libraryItemInclude,
			});
		}),

	unlinkDigitalBook: publicProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const ownerUserId = getCurrentLibraryUserId(ctx);
			const db = ctx.db;
			await db.libraryItem.findFirstOrThrow({
				where: { id: input.id, ownerUserId, deletedAt: null },
				select: { id: true },
			});
			return db.libraryItem.update({
				where: { id: input.id },
				data: { bookId: null },
				include: libraryItemInclude,
			});
		}),

	searchDigitalBookCandidates: publicProcedure
		.input(
			z.object({
				query: z.string().trim().min(1),
				limit: z.number().int().min(1).max(30).default(12),
			}),
		)
		.query(async ({ ctx, input }) => {
			const search = input.query.trim();
			return ctx.db.book.findMany({
				where: {
					deletedAt: null,
					OR: [
						{ nameAr: { contains: search, mode: "insensitive" } },
						{ nameEn: { contains: search, mode: "insensitive" } },
						{ category: { contains: search, mode: "insensitive" } },
						{
							authors: {
								some: {
									OR: [
										{ name: { contains: search, mode: "insensitive" } },
										{ nameAr: { contains: search, mode: "insensitive" } },
									],
								},
							},
						},
					],
				},
				select: {
					id: true,
					nameAr: true,
					nameEn: true,
					coverUrl: true,
					coverColor: true,
					shamelaId: true,
					shamelaUrl: true,
					sourceType: true,
					editable: true,
					authors: true,
					pages: {
						where: { status: "fetched" },
						orderBy: { shamelaPageNo: "asc" },
						take: 1,
						select: { id: true, shamelaPageNo: true },
					},
				},
				take: input.limit,
				orderBy: { id: "desc" },
			});
		}),
});
