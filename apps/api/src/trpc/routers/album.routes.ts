import { createTRPCRouter, publicProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const suggestedMediaInput = z.object({
	albumId: z.number(),
	limit: z.number().int().min(1).max(100).optional().default(25),
	keyword: z.string().trim().optional(),
});

function uniqueNumbers(values: number[]) {
	return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
}

function tokenizeSearchText(value?: string | null) {
	return Array.from(
		new Set(
			(value ?? "")
				.toLowerCase()
				.match(/[\p{L}\p{N}]{3,}/gu) ?? [],
		),
	);
}

function scoreTextAgainstTerms(value: string | null | undefined, terms: string[]) {
	const text = (value ?? "").toLowerCase();
	if (!text || terms.length === 0) return 0;
	return terms.reduce((score, term) => {
		if (!text.includes(term)) return score;
		return score + Math.min(4, Math.max(1, Math.floor(term.length / 4)));
	}, 0);
}

export const albumRoutes = createTRPCRouter({
	getAlbums: publicProcedure.query(async ({ ctx }) => {
		return ctx.db.album.findMany({
			where: { deletedAt: null },
			orderBy: { createdAt: "desc" },
			include: {
				author: { select: { id: true, name: true, nameAr: true } },
				channel: { select: { id: true, title: true, username: true } },
				thumbnail: { include: { file: true } },
				_count: { select: { medias: true } },
			},
		});
	}),

	getAlbum: publicProcedure
		.input(z.object({ id: z.number() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.album.findFirstOrThrow({
				where: { id: input.id, deletedAt: null },
				include: {
					author: { select: { id: true, name: true, nameAr: true } },
					channel: { select: { id: true, title: true, username: true } },
					thumbnail: { include: { file: true } },
					bookReferences: {
						where: { deletedAt: null },
						include: {
							book: {
								select: {
									id: true,
									nameAr: true,
									nameEn: true,
									coverColor: true,
								},
							},
						},
					},
					medias: {
						include: {
							file: true,
							bookPageReferences: {
								where: { deletedAt: null },
								include: {
									book: {
										select: {
											id: true,
											nameAr: true,
											nameEn: true,
											coverColor: true,
										},
									},
									page: {
										select: {
											id: true,
											shamelaPageNo: true,
											printedPageNo: true,
											chapterTitle: true,
											topicTitle: true,
										},
									},
								},
							},
							blog: {
								select: {
									id: true,
									content: true,
									type: true,
									blogDate: true,
									channelId: true,
									blogTags: {
										where: { deletedAt: null },
										include: { tags: { select: { id: true, title: true } } },
									},
								},
							},
							albumAudioIndex: true,
						},
						orderBy: { albumAudioIndex: { index: "asc" } },
					},
				},
			});
		}),

	createAlbum: publicProcedure
		.input(
			z.object({
				name: z.string().min(1),
				albumType: z.string().optional().default("series"),
				authorId: z.number().optional(),
				channelId: z.number().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return ctx.db.album.create({
				data: {
					name: input.name,
					albumType: input.albumType,
					albumAuthorId: input.authorId,
					channelId: input.channelId,
				},
			});
		}),

	getSuggestedMedia: publicProcedure
		.input(suggestedMediaInput)
		.query(async ({ ctx, input }) => {
			const album = await ctx.db.album.findFirstOrThrow({
				where: { id: input.albumId, deletedAt: null },
				include: {
					medias: {
						include: {
							blog: {
								select: {
									id: true,
									channelId: true,
									content: true,
								},
							},
						},
					},
				},
			});

			const albumMediaIds = album.medias.map((media) => media.id);
			const channelId =
				album.channelId ??
				album.medias.find((media) => media.blog?.channelId)?.blog?.channelId;

			if (!channelId) return [];

			const rawKeyword = input.keyword?.trim().toLowerCase();
			const keywordTerms = rawKeyword
				? tokenizeSearchText(rawKeyword).length > 0
					? tokenizeSearchText(rawKeyword)
					: [rawKeyword]
				: [];
			const hasKeyword = Boolean(rawKeyword);
			const albumTitleTerms = hasKeyword ? keywordTerms : tokenizeSearchText(album.name);
			const existingAudioTerms = hasKeyword ? [] : tokenizeSearchText(
				album.medias
					.map((media) => `${media.title ?? ""} ${media.blog?.content ?? ""}`)
					.join(" "),
			);
			const terms = Array.from(
				new Set([...albumTitleTerms, ...existingAudioTerms]),
			).slice(0, 80);

			if (terms.length === 0) return [];

			const candidates = await ctx.db.media.findMany({
				where: {
					id: { notIn: albumMediaIds },
					mimeType: { startsWith: "audio/" },
					blog: {
						is: {
							deletedAt: null,
							type: "audio",
							channelId,
						},
					},
				},
				include: {
					file: true,
					blog: {
						select: {
							id: true,
							content: true,
							type: true,
							blogDate: true,
							channelId: true,
							channel: { select: { id: true, title: true, username: true } },
						},
					},
				},
				take: Math.max(input.limit * 5, 50),
			});

			return candidates
				.map((media) => {
					const titleScore =
						scoreTextAgainstTerms(media.title, albumTitleTerms) * 3 +
						scoreTextAgainstTerms(media.title, existingAudioTerms) * 2;
					const captionScore =
						scoreTextAgainstTerms(media.blog?.content, albumTitleTerms) * 2 +
						scoreTextAgainstTerms(media.blog?.content, existingAudioTerms);
					const matchScore = titleScore + captionScore;

					return {
						id: media.id,
						title: media.title,
						mimeType: media.mimeType,
						file: media.file,
						blog: media.blog
							? {
									id: media.blog.id,
									content: media.blog.content,
									type: media.blog.type,
									blogDate: media.blog.blogDate,
									channelId: media.blog.channelId,
									channel: media.blog.channel,
								}
							: null,
						matchingTerms: terms.filter((term) =>
							`${media.title ?? ""} ${media.blog?.content ?? ""}`
								.toLowerCase()
								.includes(term),
						),
						matchScore,
					};
				})
				.filter((media) => media.matchScore > 0)
				.sort((a, b) => {
					if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
					const aTime = a.blog?.blogDate?.getTime() ?? 0;
					const bTime = b.blog?.blogDate?.getTime() ?? 0;
					return bTime - aTime;
				})
				.slice(0, input.limit);
		}),

	addMediaToAlbum: publicProcedure
		.input(
			z.object({
				albumId: z.number(),
				mediaIds: z.array(z.number()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			return db.$transaction(async (tx) => {
				const mediaIds = uniqueNumbers(input.mediaIds);
				const mediaItems = await tx.media.findMany({
					where: { id: { in: mediaIds } },
					include: { blog: { select: { channelId: true } } },
				});
				const itemsToAdd = mediaItems.filter(
					(media) => media.albumId !== input.albumId,
				);
				const missingIds = mediaIds.filter(
					(id) => !mediaItems.some((media) => media.id === id),
				);
				if (missingIds.length > 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Media not found: ${missingIds.join(", ")}`,
					});
				}

				const maxIdx = await tx.albumAudioIndex.aggregate({
					where: { albumId: input.albumId },
					_max: { index: true },
				});
				let nextIndex = (maxIdx._max.index ?? 0) + 1;

				const album = await tx.album.findFirstOrThrow({
					where: { id: input.albumId, deletedAt: null },
					select: { channelId: true },
				});
				const channelIds = uniqueNumbers(
					itemsToAdd
						.map((media) => media.blog?.channelId)
						.filter((channelId): channelId is number => typeof channelId === "number"),
				);

				if (itemsToAdd.some((media) => !media.mimeType?.toLowerCase().startsWith("audio/"))) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Only audio media can be added to an album.",
					});
				}

				if (channelIds.length > 1) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Album media must come from one channel.",
					});
				}

				if (
					album.channelId &&
					channelIds.length > 0 &&
					channelIds.some((channelId) => channelId !== album.channelId)
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "This album only accepts media from its original channel.",
					});
				}

				const inferredChannelId =
					album.channelId ??
					channelIds[0];

				if (!album.channelId && inferredChannelId) {
					await tx.album.update({
						where: { id: input.albumId },
						data: { channelId: inferredChannelId },
					});
				}

				for (const media of itemsToAdd) {
					const mediaIndexId = media.mediaIndexId ?? media.id;
					await tx.media.update({
						where: { id: media.id },
						data: { albumId: input.albumId, mediaIndexId },
					});

					const existing = await tx.albumAudioIndex.findUnique({
						where: { blogAudioId: mediaIndexId },
					});

					if (existing) {
						await tx.albumAudioIndex.update({
							where: { blogAudioId: mediaIndexId },
							data: { albumId: input.albumId, index: nextIndex++ },
						});
					} else {
						await tx.albumAudioIndex.create({
							data: {
								albumId: input.albumId,
								blogAudioId: mediaIndexId,
								index: nextIndex++,
							},
						});
					}
				}

				return {
					added: itemsToAdd.length,
					skipped: mediaItems.length - itemsToAdd.length,
				};
			});
		}),

	removeMediaFromAlbum: publicProcedure
		.input(
			z.object({
				albumId: z.number(),
				mediaId: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			const media = await db.media.findFirstOrThrow({
				where: { id: input.mediaId, albumId: input.albumId },
				select: { id: true, mediaIndexId: true },
			});

			await db.media.update({
				where: { id: input.mediaId },
				data: { albumId: null },
			});

			if (media.mediaIndexId) {
				await db.albumAudioIndex.updateMany({
					where: {
						albumId: input.albumId,
						blogAudioId: media.mediaIndexId,
					},
					data: { albumId: null },
				});
			}

			return { removed: true };
		}),

	attachBook: publicProcedure
		.input(
			z.object({
				albumId: z.number(),
				bookId: z.number(),
				note: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			await db.album.findFirstOrThrow({
				where: { id: input.albumId, deletedAt: null },
				select: { id: true },
			});
			await db.book.findFirstOrThrow({
				where: { id: input.bookId, deletedAt: null },
				select: { id: true },
			});
			return db.albumBookReference.upsert({
				where: {
					albumId_bookId: {
						albumId: input.albumId,
						bookId: input.bookId,
					},
				},
				create: {
					albumId: input.albumId,
					bookId: input.bookId,
					note: input.note ?? null,
				},
				update: {
					note: input.note ?? null,
					deletedAt: null,
				},
			});
		}),

	detachBook: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			return db.albumBookReference.update({
				where: { id: input.id },
				data: { deletedAt: new Date() },
			});
		}),

	getMediaBookPageReferences: publicProcedure
		.input(z.object({ mediaId: z.number() }))
		.query(async ({ ctx, input }) => {
			const db = ctx.db as any;
			return db.mediaBookPageReference.findMany({
				where: { mediaId: input.mediaId, deletedAt: null },
				orderBy: [{ startSec: "asc" }, { createdAt: "desc" }],
				include: {
					book: {
						select: {
							id: true,
							nameAr: true,
							nameEn: true,
							coverColor: true,
						},
					},
					page: {
						select: {
							id: true,
							shamelaPageNo: true,
							printedPageNo: true,
							chapterTitle: true,
							topicTitle: true,
						},
					},
				},
			});
		}),

	addMediaBookPageReference: publicProcedure
		.input(
			z.object({
				mediaId: z.number(),
				bookId: z.number().optional(),
				pageId: z.number(),
				startSec: z.number().int().min(0).optional(),
				endSec: z.number().int().min(0).optional(),
				note: z.string().optional(),
				quoteText: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			const media = await db.media.findFirstOrThrow({
				where: { id: input.mediaId },
				select: { id: true },
			});
			const page = await db.bookPage.findFirstOrThrow({
				where: {
					id: input.pageId,
					...(input.bookId ? { bookId: input.bookId } : {}),
					deletedAt: null,
				},
				select: { id: true, bookId: true },
			});

			if (input.endSec != null && input.startSec != null && input.endSec < input.startSec) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Reference end time cannot be before the start time.",
				});
			}

			const existingReference = await db.mediaBookPageReference.findFirst({
				where: {
					mediaId: media.id,
					pageId: page.id,
					startSec: input.startSec ?? null,
					endSec: input.endSec ?? null,
					deletedAt: null,
				},
			});

			if (existingReference) {
				return db.mediaBookPageReference.update({
					where: { id: existingReference.id },
					data: {
						bookId: page.bookId,
						note: input.note ?? existingReference.note,
						quoteText: input.quoteText ?? existingReference.quoteText,
					},
				});
			}

			return db.mediaBookPageReference.create({
				data: {
					mediaId: media.id,
					bookId: page.bookId,
					pageId: page.id,
					startSec: input.startSec ?? null,
					endSec: input.endSec ?? null,
					note: input.note ?? null,
					quoteText: input.quoteText ?? null,
				},
			});
		}),

	deleteMediaBookPageReference: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			return db.mediaBookPageReference.update({
				where: { id: input.id },
				data: { deletedAt: new Date() },
			});
		}),

	updateAlbum: publicProcedure
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1).optional(),
				description: z.string().optional(),
				albumType: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			return ctx.db.album.update({
				where: { id },
				data: {
					...(data.name !== undefined ? { name: data.name } : {}),
					...(data.description !== undefined
						? { description: data.description }
						: {}),
					...(data.albumType !== undefined
						? { albumType: data.albumType }
						: {}),
				},
			});
		}),

	// Accepts the full desired order as [{mediaId, index}] and bulk-updates.
	// Client sends the list after user finishes dragging / tapping up-down.
	reorderTracks: publicProcedure
		.input(
			z.object({
				albumId: z.number(),
				order: z.array(z.object({ mediaId: z.number(), index: z.number() })),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			return db.$transaction(async (tx) => {
				let updated = 0;
				for (const { mediaId, index } of input.order) {
					const media = await tx.media.findUnique({
						where: { id: mediaId },
						select: { id: true, mediaIndexId: true },
					});
					if (!media) continue;
					const mediaIndexId = media.mediaIndexId ?? media.id;
					if (!media.mediaIndexId) {
						await tx.media.update({
							where: { id: media.id },
							data: { mediaIndexId },
						});
					}
					await tx.albumAudioIndex.update({
						where: { blogAudioId: mediaIndexId },
						data: { index },
					});
					updated++;
				}
				return { updated };
			});
		}),

	getAuthors: publicProcedure.query(async ({ ctx }) => {
		return ctx.db.author.findMany({
			where: { deletedAt: null },
			orderBy: { name: "asc" },
			select: { id: true, name: true, nameAr: true },
		});
	}),

	createAuthor: publicProcedure
		.input(z.object({ name: z.string().min(1), nameAr: z.string().optional() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.author.upsert({
				where: { name: input.name },
				create: { name: input.name, nameAr: input.nameAr },
				update: { nameAr: input.nameAr },
			});
		}),
});
