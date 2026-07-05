import { type Database, Prisma } from "@acme/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	type AlbumIndexAiResult,
	type AlbumIndexChunkMetadata,
	type NormalizedAlbumIndex,
	albumIndexAiProviderSchema,
	buildAlbumAutoIndexSnapshot,
	getAlbumIndexAiConfig,
	mergeAlbumIndexResponses,
	normalizeAlbumIndexResponse,
	requestAlbumIndex,
} from "../../services/album-auto-index";
import { createTRPCRouter, publicProcedure } from "../init";

const suggestedMediaInput = z.object({
	albumId: z.number(),
	limit: z.number().int().min(1).max(500).optional().default(25),
	keyword: z.string().trim().optional(),
});

const albumSuggestionGroupsInput = z.object({
	keyword: z.string().trim().min(1),
	channelId: z.number().optional(),
	albumLimit: z.number().int().min(1).max(50).optional().default(12),
	mediaLimit: z.number().int().min(1).max(100).optional().default(25),
});

const relatedAlbumForMediaInput = z.object({
	mediaId: z.number(),
});

const generateAutomaticIndexInput = z.object({
	channelId: z.number(),
	provider: albumIndexAiProviderSchema.optional().default("deepseek"),
	albumLimit: z.number().int().min(1).max(200).optional().default(100),
	mediaLimit: z.number().int().min(1).max(1000).optional().default(500),
	chunkSize: z.number().int().min(1).max(200).optional().default(100),
});

const automaticIndexRunsInput = z.object({
	channelId: z.number(),
	limit: z.number().int().min(1).max(50).optional().default(20),
});

const automaticIndexRunInput = z.object({
	id: z.number(),
});

const automaticIndexChannelSummaryInput = z.object({
	channelId: z.number(),
});

const automaticIndexMediaSuggestionInput = z.object({
	id: z.number(),
});

const approveAutomaticIndexAlbumSuggestionInput = z.object({
	suggestionId: z.number(),
	mediaSuggestionIds: z.array(z.number()).optional(),
	proposedAlbumName: z.string().trim().min(1).optional(),
	proposedAlbumType: z.string().trim().optional(),
	proposedDescription: z.string().trim().optional(),
	proposedSuggestionKeywords: z.string().trim().optional(),
});

function uniqueNumbers(values: number[]) {
	return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
}

function chunkRows<T extends { id: number }>(rows: T[], chunkSize: number) {
	const chunks: Array<{
		index: number;
		mediaOffset: number;
		media: T[];
	}> = [];

	for (let offset = 0; offset < rows.length; offset += chunkSize) {
		chunks.push({
			index: chunks.length,
			mediaOffset: offset,
			media: rows.slice(offset, offset + chunkSize),
		});
	}

	return chunks;
}

function tokenizeSearchText(value?: string | null) {
	return Array.from(
		new Set((value ?? "").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []),
	);
}

function parseKeywordTerms(value?: string | null) {
	const directTerms = (value ?? "")
		.split(",")
		.map((term) => term.trim().toLowerCase())
		.filter(Boolean);
	const tokenizedTerms = tokenizeSearchText(value);
	return Array.from(
		new Set(
			directTerms.length > 0
				? [...directTerms, ...tokenizedTerms]
				: tokenizedTerms,
		),
	);
}

function parseKeywordClauses(value?: string | null) {
	return (value ?? "")
		.split(",")
		.map((clause) => {
			const normalized = clause.trim().toLowerCase();
			if (!normalized) return [];
			const terms = tokenizeSearchText(normalized);
			return terms.length > 0 ? terms : [normalized];
		})
		.filter((terms) => terms.length > 0);
}

function scoreTextAgainstTerms(
	value: string | null | undefined,
	terms: string[],
) {
	const text = (value ?? "").toLowerCase();
	if (!text || terms.length === 0) return 0;
	return terms.reduce((score, term) => {
		if (!text.includes(term)) return score;
		return score + Math.min(4, Math.max(1, Math.floor(term.length / 4)));
	}, 0);
}

function getMediaSearchText(media: {
	title?: string | null;
	file?: { fileName?: string | null } | null;
	blog?: { content?: string | null } | null;
}) {
	return [media.title, media.file?.fileName, media.blog?.content]
		.filter(Boolean)
		.join(" ");
}

function getMediaMatchingTerms(
	media: Parameters<typeof getMediaSearchText>[0],
	terms: string[],
) {
	const text = getMediaSearchText(media).toLowerCase();
	return terms.filter((term) => text.includes(term));
}

function mediaMatchesKeywordClauses(
	media: Parameters<typeof getMediaSearchText>[0],
	clauses: string[][],
) {
	if (clauses.length === 0) return true;
	const text = getMediaSearchText(media).toLowerCase();
	return clauses.some((terms) => terms.every((term) => text.includes(term)));
}

function getAlbumSearchText(album: {
	name?: string | null;
	description?: string | null;
	suggestionKeywords?: string | null;
}) {
	return [album.suggestionKeywords, album.name, album.description]
		.filter(Boolean)
		.join(" ");
}

function getUnknownErrorMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	return String(error);
}

async function addMediaIdsToAlbum(
	db: Database,
	input: {
		albumId: number;
		mediaIds: number[];
	},
	options: { strictMissing?: boolean } = {},
) {
	const strictMissing = options.strictMissing ?? true;
	const mediaIds = uniqueNumbers(input.mediaIds);
	const mediaItems = await db.media.findMany({
		where: { id: { in: mediaIds } },
		include: { blog: { select: { channelId: true } } },
	});
	const mediaById = new Map(mediaItems.map((media) => [media.id, media]));
	const orderedMediaItems = mediaIds
		.map((id) => mediaById.get(id))
		.filter((media): media is (typeof mediaItems)[number] => Boolean(media));
	const missingIds = mediaIds.filter((id) => !mediaById.has(id));

	if (strictMissing && missingIds.length > 0) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Media not found: ${missingIds.join(", ")}`,
		});
	}

	const itemsToAdd = orderedMediaItems.filter(
		(media) => media.albumId !== input.albumId,
	);
	const album = await db.album.findFirstOrThrow({
		where: { id: input.albumId, deletedAt: null },
		select: { channelId: true },
	});
	const channelIds = uniqueNumbers(
		itemsToAdd
			.map((media) => media.blog?.channelId)
			.filter(
				(channelId): channelId is number => typeof channelId === "number",
			),
	);

	if (
		itemsToAdd.some(
			(media) => !media.mimeType?.toLowerCase().startsWith("audio/"),
		)
	) {
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

	const inferredChannelId = album.channelId ?? channelIds[0];

	await db.$transaction(async (tx) => {
		const maxIdx = await tx.albumAudioIndex.aggregate({
			where: { albumId: input.albumId },
			_max: { index: true },
		});
		const nextIndex = (maxIdx._max.index ?? 0) + 1;

		if (!album.channelId && inferredChannelId) {
			await tx.album.update({
				where: { id: input.albumId },
				data: { channelId: inferredChannelId },
			});
		}

		if (itemsToAdd.length > 0) {
			const itemIds = itemsToAdd.map((media) => media.id);
			const indexRows = itemsToAdd.map((media, offset) => ({
				blogAudioId: media.mediaIndexId ?? media.id,
				index: nextIndex + offset,
			}));

			await tx.$executeRaw`
				UPDATE "Media" AS media
				SET "albumId" = ${input.albumId},
					"mediaIndexId" = COALESCE(media."mediaIndexId", media."id")
				WHERE media."id" IN (${Prisma.join(itemIds)})
			`;

			await tx.$executeRaw`
				INSERT INTO "AlbumAudioIndex" ("albumId", "blogAudioId", "index", "updatedAt")
				VALUES ${Prisma.join(
					indexRows.map(
						(row) =>
							Prisma.sql`(${input.albumId}, ${row.blogAudioId}, ${row.index}, CURRENT_TIMESTAMP)`,
					),
				)}
				ON CONFLICT ("blogAudioId")
				DO UPDATE SET
					"albumId" = EXCLUDED."albumId",
					"index" = EXCLUDED."index",
					"updatedAt" = CURRENT_TIMESTAMP
			`;
		}
	});

	const alreadyAdded = orderedMediaItems.length - itemsToAdd.length;

	return {
		added: itemsToAdd.length,
		skipped: alreadyAdded + missingIds.length,
		alreadyAdded,
		missing: missingIds.length,
		missingIds,
		appliedMediaIds: orderedMediaItems.map((media) => media.id),
	};
}

async function refreshAutomaticIndexRunStatus(db: Database, runId: number) {
	const suggestions = await db.albumAutoIndexAlbumSuggestion.findMany({
		where: { runId, deletedAt: null },
		select: { status: true },
	});
	const hasApproved = suggestions.some((item) =>
		["approved", "partial"].includes(item.status),
	);
	const hasPending = suggestions.some((item) =>
		["pending", "partial"].includes(item.status),
	);
	const status = !suggestions.length
		? "generated"
		: !hasPending && hasApproved
			? "approved"
			: hasApproved
				? "partially-approved"
				: "generated";

	return db.albumAutoIndexRun.update({
		where: { id: runId },
		data: { status },
	});
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
							author: { select: { id: true, name: true, nameAr: true } },
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
									blogs: {
										where: { deletedAt: null },
										orderBy: { createdAt: "asc" },
										include: {
											comment: {
												select: {
													id: true,
													content: true,
													createdAt: true,
													deletedAt: true,
												},
											},
										},
									},
								},
							},
							transcript: {
								select: {
									status: true,
									segments: {
										select: { startSec: true, endSec: true, text: true },
										where: { status: "done" },
										orderBy: { startSec: "asc" },
									},
								},
							},
							transcriptionJobs: {
								where: { status: { in: ["queued", "running"] } },
								orderBy: { createdAt: "desc" },
								take: 1,
								select: { status: true },
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
							file: {
								select: { fileName: true },
							},
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
			const keywordTerms = rawKeyword ? parseKeywordTerms(rawKeyword) : [];
			const keywordClauses = rawKeyword ? parseKeywordClauses(rawKeyword) : [];
			const hasKeyword = Boolean(rawKeyword);
			const albumTitleTerms = hasKeyword
				? keywordTerms
				: tokenizeSearchText(album.name);
			const existingAudioTerms = hasKeyword
				? []
				: tokenizeSearchText(album.medias.map(getMediaSearchText).join(" "));
			const terms = Array.from(
				new Set([...albumTitleTerms, ...existingAudioTerms]),
			).slice(0, 80);

			if (terms.length === 0) return [];

			const candidates = await ctx.db.media.findMany({
				where: {
					id: { notIn: albumMediaIds },
					albumId: null,
					mimeType: { startsWith: "audio/" },
					AND: [
						{
							blog: {
								is: {
									deletedAt: null,
									type: "audio",
									channelId,
								},
							},
						},
						...(hasKeyword
							? [
									{
										OR: keywordTerms.flatMap((keywordFilter) => [
											{
												title: {
													contains: keywordFilter,
													mode: "insensitive" as const,
												},
											},
											{
												file: {
													is: {
														fileName: {
															contains: keywordFilter,
															mode: "insensitive" as const,
														},
													},
												},
											},
											{
												blog: {
													is: {
														content: {
															contains: keywordFilter,
															mode: "insensitive" as const,
														},
													},
												},
											},
										]),
									},
								]
							: []),
					],
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
					const fileNameScore =
						scoreTextAgainstTerms(media.file?.fileName, albumTitleTerms) * 3 +
						scoreTextAgainstTerms(media.file?.fileName, existingAudioTerms) * 2;
					const captionScore =
						scoreTextAgainstTerms(media.blog?.content, albumTitleTerms) * 2 +
						scoreTextAgainstTerms(media.blog?.content, existingAudioTerms);
					const matchScore = titleScore + fileNameScore + captionScore;
					const matchesKeyword = mediaMatchesKeywordClauses(
						media,
						keywordClauses,
					);

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
						matchingTerms: getMediaMatchingTerms(media, terms),
						matchScore,
						matchesKeyword,
					};
				})
				.filter(
					(media) =>
						media.matchScore > 0 && (!hasKeyword || media.matchesKeyword),
				)
				.sort((a, b) => {
					if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
					const aTime = a.blog?.blogDate?.getTime() ?? 0;
					const bTime = b.blog?.blogDate?.getTime() ?? 0;
					return bTime - aTime;
				})
				.map(({ matchesKeyword, ...media }) => media)
				.slice(0, input.limit);
		}),

	getAlbumSuggestionGroups: publicProcedure
		.input(albumSuggestionGroupsInput)
		.query(async ({ ctx, input }) => {
			const keyword = input.keyword.trim();
			const terms = parseKeywordTerms(keyword).slice(0, 40);
			const keywordClauses = parseKeywordClauses(keyword);
			if (terms.length === 0) return [];

			const albums = await ctx.db.album.findMany({
				where: {
					deletedAt: null,
					...(input.channelId ? { channelId: input.channelId } : {}),
					OR: terms.flatMap((term) => [
						{ name: { contains: term, mode: "insensitive" as const } },
						{
							suggestionKeywords: {
								contains: term,
								mode: "insensitive" as const,
							},
						},
					]),
				},
				orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
				take: input.albumLimit,
				include: {
					channel: { select: { id: true, title: true, username: true } },
					_count: { select: { medias: true } },
					medias: {
						select: {
							id: true,
							blog: { select: { channelId: true } },
						},
					},
				},
			});

			const groups = await Promise.all(
				albums.map(async (album) => {
					const albumMediaIds = album.medias.map((media) => media.id);
					const channelId =
						album.channelId ??
						album.medias.find((media) => media.blog?.channelId)?.blog
							?.channelId;
					if (!channelId) {
						return { album, suggestions: [] };
					}

					const candidates = await ctx.db.media.findMany({
						where: {
							id: { notIn: albumMediaIds },
							albumId: null,
							mimeType: { startsWith: "audio/" },
							blog: {
								is: {
									deletedAt: null,
									type: "audio",
									channelId,
								},
							},
							OR: terms.flatMap((term) => [
								{ title: { contains: term, mode: "insensitive" as const } },
								{
									file: {
										is: {
											fileName: {
												contains: term,
												mode: "insensitive" as const,
											},
										},
									},
								},
								{
									blog: {
										is: {
											content: {
												contains: term,
												mode: "insensitive" as const,
											},
										},
									},
								},
							]),
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
									channel: {
										select: { id: true, title: true, username: true },
									},
								},
							},
						},
						take: Math.max(input.mediaLimit * 3, input.mediaLimit),
					});

					const suggestions = candidates
						.map((media) => {
							const matchScore =
								scoreTextAgainstTerms(media.title, terms) * 3 +
								scoreTextAgainstTerms(media.file?.fileName, terms) * 2 +
								scoreTextAgainstTerms(media.blog?.content, terms);
							const matchesKeyword = mediaMatchesKeywordClauses(
								media,
								keywordClauses,
							);
							return {
								id: media.id,
								title: media.title,
								mimeType: media.mimeType,
								file: media.file,
								blog: media.blog,
								matchingTerms: getMediaMatchingTerms(media, terms),
								matchScore,
								matchesKeyword,
							};
						})
						.filter((media) => media.matchScore > 0 && media.matchesKeyword)
						.sort((a, b) => {
							if (b.matchScore !== a.matchScore) {
								return b.matchScore - a.matchScore;
							}
							const aTime = a.blog?.blogDate?.getTime() ?? 0;
							const bTime = b.blog?.blogDate?.getTime() ?? 0;
							return bTime - aTime;
						})
						.map(({ matchesKeyword, ...media }) => media)
						.slice(0, input.mediaLimit);

					return { album, suggestions };
				}),
			);

			return groups.filter((group) => group.suggestions.length > 0);
		}),

	getRelatedAlbumForMedia: publicProcedure
		.input(relatedAlbumForMediaInput)
		.query(async ({ ctx, input }) => {
			const media = await ctx.db.media.findFirst({
				where: {
					id: input.mediaId,
					mimeType: { startsWith: "audio/" },
				},
				include: {
					file: { select: { fileName: true } },
					blog: {
						select: {
							id: true,
							content: true,
							channelId: true,
							deletedAt: true,
						},
					},
				},
			});

			const channelId = media?.blog?.channelId;
			if (!media || media.blog?.deletedAt || !channelId) return null;

			const albums = await ctx.db.album.findMany({
				where: {
					deletedAt: null,
					...(media.albumId ? { id: { not: media.albumId } } : {}),
					OR: [
						{ channelId },
						{
							medias: {
								some: {
									blog: {
										is: {
											channelId,
											deletedAt: null,
										},
									},
								},
							},
						},
					],
				},
				orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
				take: 50,
				include: {
					channel: { select: { id: true, title: true, username: true } },
					_count: { select: { medias: true } },
				},
			});

			const mediaText = getMediaSearchText(media);
			const mediaTitleTerms = tokenizeSearchText(
				[media.title, media.file?.fileName].filter(Boolean).join(" "),
			).slice(0, 20);
			const relatedAlbums = albums
				.map((album) => {
					const keywordTerms = parseKeywordTerms(album.suggestionKeywords);
					const albumTerms = tokenizeSearchText(
						[album.name, album.description].filter(Boolean).join(" "),
					);
					const albumText = getAlbumSearchText(album);
					const matchScore =
						scoreTextAgainstTerms(mediaText, keywordTerms) * 5 +
						scoreTextAgainstTerms(mediaText, albumTerms) * 3 +
						scoreTextAgainstTerms(albumText, mediaTitleTerms) * 2;

					return { album, matchScore };
				})
				.filter((item) => item.matchScore > 0)
				.sort((a, b) => {
					if (b.matchScore !== a.matchScore) {
						return b.matchScore - a.matchScore;
					}
					const bCount = b.album._count?.medias ?? 0;
					const aCount = a.album._count?.medias ?? 0;
					return bCount - aCount;
				});

			const related = relatedAlbums[0];
			if (!related) return null;

			return {
				...related.album,
				matchScore: related.matchScore,
			};
		}),

	getAutomaticIndexChannelSummary: publicProcedure
		.input(automaticIndexChannelSummaryInput)
		.query(async ({ ctx, input }) => {
			const [channel, unalbumedAudioCount, albumCount, latestRun] =
				await Promise.all([
					ctx.db.channel.findFirstOrThrow({
						where: { id: input.channelId, deletedAt: null },
						select: { id: true, title: true, username: true },
					}),
					ctx.db.media.count({
						where: {
							albumId: null,
							mimeType: { startsWith: "audio/" },
							blog: {
								is: {
									channelId: input.channelId,
									deletedAt: null,
									type: "audio",
								},
							},
						},
					}),
					ctx.db.album.count({
						where: {
							deletedAt: null,
							OR: [
								{ channelId: input.channelId },
								{
									medias: {
										some: {
											blog: {
												is: {
													channelId: input.channelId,
													deletedAt: null,
												},
											},
										},
									},
								},
							],
						},
					}),
					ctx.db.albumAutoIndexRun.findFirst({
						where: { channelId: input.channelId, deletedAt: null },
						orderBy: { createdAt: "desc" },
						include: {
							_count: { select: { albumSuggestions: true } },
						},
					}),
				]);

			return {
				channel,
				unalbumedAudioCount,
				albumCount,
				latestRun,
			};
		}),

	generateAutomaticIndex: publicProcedure
		.input(generateAutomaticIndexInput)
		.mutation(async ({ ctx, input }) => {
			const channel = await ctx.db.channel.findFirstOrThrow({
				where: { id: input.channelId, deletedAt: null },
				select: { id: true, title: true, username: true },
			});
			const albums = await ctx.db.album.findMany({
				where: {
					deletedAt: null,
					OR: [
						{ channelId: input.channelId },
						{
							medias: {
								some: {
									blog: {
										is: {
											channelId: input.channelId,
											deletedAt: null,
										},
									},
								},
							},
						},
					],
				},
				orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
				take: input.albumLimit,
				select: {
					id: true,
					name: true,
					albumType: true,
					description: true,
					suggestionKeywords: true,
					medias: {
						where: {
							mimeType: { startsWith: "audio/" },
							blog: {
								is: {
									channelId: input.channelId,
									deletedAt: null,
								},
							},
						},
						select: { id: true, title: true },
					},
				},
			});
			const media = await ctx.db.media.findMany({
				where: {
					albumId: null,
					mimeType: { startsWith: "audio/" },
					blog: {
						is: {
							channelId: input.channelId,
							deletedAt: null,
							type: "audio",
						},
					},
				},
				take: input.mediaLimit,
				select: {
					id: true,
					title: true,
					file: { select: { fileName: true } },
					blog: { select: { content: true } },
				},
			});
			const chunks = chunkRows(media, input.chunkSize);
			const config = getAlbumIndexAiConfig(input.provider);
			const run = await ctx.db.albumAutoIndexRun.create({
				data: {
					channelId: input.channelId,
					provider: config.provider,
					model: config.model,
					status: "running",
					albumCount: albums.length,
					mediaCount: media.length,
					inputJson: {
						provider: config.provider,
						model: config.model,
						chunkSize: input.chunkSize,
						chunkCount: chunks.length,
						albumCount: albums.length,
						mediaCount: media.length,
						albums: albums.map((album) => ({
							id: album.id,
							name: album.name,
						})),
						chunks: chunks.map((chunk) => ({
							index: chunk.index,
							totalChunks: chunks.length,
							mediaOffset: chunk.mediaOffset,
							mediaLimit: chunk.media.length,
							mediaIds: chunk.media.map((item) => item.id),
						})),
					},
				},
			});

			try {
				if (albums.length === 0) {
					throw new Error("No albums found for this channel.");
				}
				if (media.length === 0) {
					throw new Error("No audio media found for this channel.");
				}

				const chunkResults: Array<{
					metadata: AlbumIndexChunkMetadata;
					aiResult: AlbumIndexAiResult;
					normalized: NormalizedAlbumIndex;
				}> = [];
				for (const chunk of chunks) {
					const chunkMetadata: AlbumIndexChunkMetadata = {
						index: chunk.index,
						totalChunks: chunks.length,
						mediaOffset: chunk.mediaOffset,
						mediaLimit: chunk.media.length,
						mediaIds: chunk.media.map((item) => item.id),
					};
					const snapshot = buildAlbumAutoIndexSnapshot({
						channel,
						albums,
						media: chunk.media,
						chunk: chunkMetadata,
					});
					const aiResult = await requestAlbumIndex(snapshot, {
						provider: input.provider,
					});
					const normalizedChunk = normalizeAlbumIndexResponse(
						aiResult.parsedResponse,
						snapshot,
					);
					chunkResults.push({
						metadata: chunkMetadata,
						aiResult,
						normalized: normalizedChunk,
					});
				}

				const normalized = mergeAlbumIndexResponses(
					chunkResults.map((result) => result.normalized),
				);
				const firstResult = chunkResults[0]?.aiResult;
				const rawResponseJson = {
					provider: firstResult?.provider ?? config.provider,
					model: firstResult?.model ?? config.model,
					chunkSize: input.chunkSize,
					chunkCount: chunks.length,
					chunks: chunkResults.map((result) => ({
						...result.metadata,
						provider: result.aiResult.provider,
						model: result.aiResult.model,
						inputTokens: result.aiResult.inputTokens,
						outputTokens: result.aiResult.outputTokens,
						rawResponse: result.aiResult.rawResponse,
						parsedResponse: result.aiResult.parsedResponse,
						suggestionCount: result.normalized.suggestionCount,
					})),
				};
				const parsedResponseJson = {
					chunkSize: input.chunkSize,
					chunkCount: chunks.length,
					chunks: chunkResults.map((result) => ({
						...result.metadata,
						parsedResponse: result.normalized.parsedResponse,
						suggestionCount: result.normalized.suggestionCount,
					})),
					merged: normalized.parsedResponse,
					suggestionCount: normalized.suggestionCount,
				};
				const updatedRun = await ctx.db.$transaction(async (tx) => {
					return tx.albumAutoIndexRun.update({
						where: { id: run.id },
						data: {
							provider: firstResult?.provider ?? config.provider,
							model: firstResult?.model ?? config.model,
							status: "generated",
							suggestionCount: normalized.suggestionCount,
							rawResponseJson: rawResponseJson as Prisma.InputJsonValue,
							parsedResponseJson: parsedResponseJson as Prisma.InputJsonValue,
							error: null,
							albumSuggestions: {
								create: normalized.albums.map((album) => ({
									albumId: album.albumId,
									albumNameSnapshot: album.albumNameSnapshot,
									suggestionType: album.suggestionType,
									proposedAlbumName: album.proposedAlbumName,
									proposedAlbumType: album.proposedAlbumType,
									proposedDescription: album.proposedDescription,
									proposedSuggestionKeywords: album.proposedSuggestionKeywords,
									confidence: album.confidence,
									reason: album.reason,
									status: "pending",
									mediaSuggestions: {
										create: album.media.map((mediaSuggestion) => ({
											mediaId: mediaSuggestion.mediaId,
											mediaTitleSnapshot: mediaSuggestion.mediaTitleSnapshot,
											confidence: mediaSuggestion.confidence,
											reason: mediaSuggestion.reason,
											status: "pending",
										})),
									},
								})),
							},
						},
					});
				});

				return {
					id: updatedRun.id,
					status: updatedRun.status,
					provider: updatedRun.provider,
					model: updatedRun.model,
					albumCount: updatedRun.albumCount,
					mediaCount: updatedRun.mediaCount,
					suggestionCount: updatedRun.suggestionCount,
				};
			} catch (error) {
				const message = getUnknownErrorMessage(error);
				await ctx.db.albumAutoIndexRun.update({
					where: { id: run.id },
					data: {
						status: "failed",
						error: message,
					},
				});
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message,
					cause: error,
				});
			}
		}),

	getAutomaticIndexRuns: publicProcedure
		.input(automaticIndexRunsInput)
		.query(async ({ ctx, input }) => {
			return ctx.db.albumAutoIndexRun.findMany({
				where: {
					channelId: input.channelId,
					deletedAt: null,
				},
				orderBy: { createdAt: "desc" },
				take: input.limit,
				include: {
					_count: {
						select: {
							albumSuggestions: true,
						},
					},
				},
			});
		}),

	getAutomaticIndexRun: publicProcedure
		.input(automaticIndexRunInput)
		.query(async ({ ctx, input }) => {
			const run = await ctx.db.albumAutoIndexRun.findFirstOrThrow({
				where: { id: input.id, deletedAt: null },
				include: {
					albumSuggestions: {
						where: { deletedAt: null },
						orderBy: { id: "asc" },
						include: {
							mediaSuggestions: {
								where: { deletedAt: null },
								orderBy: { id: "asc" },
							},
						},
					},
				},
			});
			const albumIds = uniqueNumbers(
				run.albumSuggestions
					.map((suggestion) => suggestion.albumId)
					.filter((albumId): albumId is number => typeof albumId === "number"),
			);
			const mediaIds = uniqueNumbers(
				run.albumSuggestions.flatMap((suggestion) =>
					suggestion.mediaSuggestions.map(
						(mediaSuggestion) => mediaSuggestion.mediaId,
					),
				),
			);
			const [albums, mediaItems] = await Promise.all([
				ctx.db.album.findMany({
					where: { id: { in: albumIds } },
					select: {
						id: true,
						name: true,
						albumType: true,
						description: true,
						suggestionKeywords: true,
						_count: { select: { medias: true } },
					},
				}),
				ctx.db.media.findMany({
					where: { id: { in: mediaIds } },
					select: {
						id: true,
						title: true,
						mimeType: true,
						albumId: true,
						file: true,
						author: { select: { id: true, name: true, nameAr: true } },
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
				}),
			]);
			const albumById = new Map(albums.map((album) => [album.id, album]));
			const mediaById = new Map(
				mediaItems.map((mediaItem) => [mediaItem.id, mediaItem]),
			);

			return {
				...run,
				albumSuggestions: run.albumSuggestions.map((suggestion) => ({
					...suggestion,
					album:
						typeof suggestion.albumId === "number"
							? (albumById.get(suggestion.albumId) ?? null)
							: null,
					mediaSuggestions: suggestion.mediaSuggestions.map(
						(mediaSuggestion) => ({
							...mediaSuggestion,
							media: mediaById.get(mediaSuggestion.mediaId) ?? null,
						}),
					),
				})),
			};
		}),

	dismissAutomaticIndexMediaSuggestion: publicProcedure
		.input(automaticIndexMediaSuggestionInput)
		.mutation(async ({ ctx, input }) => {
			const row = await ctx.db.albumAutoIndexMediaSuggestion.update({
				where: { id: input.id },
				data: { status: "dismissed" },
				select: {
					id: true,
					suggestionId: true,
					suggestion: { select: { runId: true } },
				},
			});
			const remainingPending = await ctx.db.albumAutoIndexMediaSuggestion.count(
				{
					where: {
						suggestionId: row.suggestionId,
						deletedAt: null,
						status: "pending",
					},
				},
			);
			await ctx.db.albumAutoIndexAlbumSuggestion.update({
				where: { id: row.suggestionId },
				data: { status: remainingPending > 0 ? "pending" : "dismissed" },
			});
			await refreshAutomaticIndexRunStatus(ctx.db, row.suggestion.runId);
			return row;
		}),

	restoreAutomaticIndexMediaSuggestion: publicProcedure
		.input(automaticIndexMediaSuggestionInput)
		.mutation(async ({ ctx, input }) => {
			const row = await ctx.db.albumAutoIndexMediaSuggestion.update({
				where: { id: input.id },
				data: { status: "pending" },
				select: {
					id: true,
					suggestionId: true,
					suggestion: { select: { runId: true } },
				},
			});
			await ctx.db.albumAutoIndexAlbumSuggestion.update({
				where: { id: row.suggestionId },
				data: { status: "pending" },
			});
			await refreshAutomaticIndexRunStatus(ctx.db, row.suggestion.runId);
			return row;
		}),

	approveAutomaticIndexAlbumSuggestion: publicProcedure
		.input(approveAutomaticIndexAlbumSuggestionInput)
		.mutation(async ({ ctx, input }) => {
			const selectedIds = input.mediaSuggestionIds
				? new Set(input.mediaSuggestionIds)
				: null;
			const suggestion =
				await ctx.db.albumAutoIndexAlbumSuggestion.findFirstOrThrow({
					where: { id: input.suggestionId, deletedAt: null },
					include: {
						run: { select: { id: true, channelId: true } },
						mediaSuggestions: {
							where: {
								deletedAt: null,
								...(selectedIds ? { id: { in: [...selectedIds] } } : {}),
								status: { in: ["pending", "failed"] },
							},
							orderBy: { id: "asc" },
						},
					},
				});
			const targetRows = suggestion.mediaSuggestions.filter(
				(row) => row.status !== "dismissed",
			);

			if (targetRows.length === 0) {
				return {
					added: 0,
					skipped: 0,
					alreadyAdded: 0,
					missing: 0,
					failed: 0,
					total: 0,
				};
			}

			let createdAlbumId: number | null = null;
			try {
				let albumId = suggestion.albumId;
				if (albumId == null) {
					const proposedAlbumName =
						input.proposedAlbumName?.trim() ||
						suggestion.proposedAlbumName ||
						suggestion.albumNameSnapshot;
					if (!proposedAlbumName) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Proposed album name is required.",
						});
					}

					const proposedAlbumType =
						input.proposedAlbumType?.trim() ||
						suggestion.proposedAlbumType ||
						"series";
					const proposedDescription =
						input.proposedDescription?.trim() ||
						suggestion.proposedDescription ||
						null;
					const proposedSuggestionKeywords =
						input.proposedSuggestionKeywords?.trim() ||
						suggestion.proposedSuggestionKeywords ||
						null;
					const createdAlbum = await ctx.db.album.create({
						data: {
							name: proposedAlbumName,
							albumType: proposedAlbumType,
							description: proposedDescription,
							suggestionKeywords: proposedSuggestionKeywords,
							channelId: suggestion.run.channelId,
						},
						select: { id: true, name: true },
					});
					createdAlbumId = createdAlbum.id;
					albumId = createdAlbum.id;
					await ctx.db.albumAutoIndexAlbumSuggestion.update({
						where: { id: suggestion.id },
						data: {
							albumId,
							albumNameSnapshot: createdAlbum.name,
							proposedAlbumName,
							proposedAlbumType,
							proposedDescription,
							proposedSuggestionKeywords,
						},
					});
				}

				const result = await addMediaIdsToAlbum(
					ctx.db,
					{
						albumId,
						mediaIds: targetRows.map((row) => row.mediaId),
					},
					{ strictMissing: false },
				);
				createdAlbumId = null;
				const appliedIds = new Set(result.appliedMediaIds);
				const missingIds = new Set(result.missingIds);
				const appliedSuggestionIds = targetRows
					.filter((row) => appliedIds.has(row.mediaId))
					.map((row) => row.id);
				const failedSuggestionIds = targetRows
					.filter((row) => missingIds.has(row.mediaId))
					.map((row) => row.id);

				await ctx.db.$transaction([
					...(appliedSuggestionIds.length > 0
						? [
								ctx.db.albumAutoIndexMediaSuggestion.updateMany({
									where: { id: { in: appliedSuggestionIds } },
									data: { status: "approved" },
								}),
							]
						: []),
					...(failedSuggestionIds.length > 0
						? [
								ctx.db.albumAutoIndexMediaSuggestion.updateMany({
									where: { id: { in: failedSuggestionIds } },
									data: { status: "failed" },
								}),
							]
						: []),
				]);

				const [remainingPending, approvedCount] = await Promise.all([
					ctx.db.albumAutoIndexMediaSuggestion.count({
						where: {
							suggestionId: suggestion.id,
							deletedAt: null,
							status: "pending",
						},
					}),
					ctx.db.albumAutoIndexMediaSuggestion.count({
						where: {
							suggestionId: suggestion.id,
							deletedAt: null,
							status: "approved",
						},
					}),
				]);
				await ctx.db.albumAutoIndexAlbumSuggestion.update({
					where: { id: suggestion.id },
					data: {
						status:
							remainingPending === 0
								? "approved"
								: approvedCount > 0
									? "partial"
									: "pending",
					},
				});
				await refreshAutomaticIndexRunStatus(ctx.db, suggestion.run.id);

				return {
					...result,
					albumId,
					failed: failedSuggestionIds.length,
					total: targetRows.length,
				};
			} catch (error) {
				if (createdAlbumId != null) {
					await ctx.db.album
						.update({
							where: { id: createdAlbumId },
							data: { deletedAt: new Date() },
						})
						.catch(() => undefined);
				}
				await ctx.db.albumAutoIndexMediaSuggestion.updateMany({
					where: { id: { in: targetRows.map((row) => row.id) } },
					data: { status: "failed" },
				});
				await ctx.db.albumAutoIndexAlbumSuggestion.update({
					where: { id: suggestion.id },
					data: {
						status: "failed",
						...(createdAlbumId != null ? { albumId: null } : {}),
					},
				});
				await refreshAutomaticIndexRunStatus(ctx.db, suggestion.run.id);
				return {
					added: 0,
					skipped: 0,
					alreadyAdded: 0,
					missing: 0,
					albumId: suggestion.albumId,
					failed: targetRows.length,
					total: targetRows.length,
					error: getUnknownErrorMessage(error),
				};
			}
		}),

	addMediaToAlbum: publicProcedure
		.input(
			z.object({
				albumId: z.number(),
				mediaIds: z.array(z.number()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return addMediaIdsToAlbum(ctx.db, input);
		}),

	removeMediaFromAlbum: publicProcedure
		.input(
			z.object({
				albumId: z.number(),
				mediaId: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
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

	removeMediaFromAlbumBulk: publicProcedure
		.input(
			z.object({
				albumId: z.number(),
				mediaIds: z.array(z.number()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			const mediaIds = uniqueNumbers(input.mediaIds);
			const mediaItems = await db.media.findMany({
				where: { id: { in: mediaIds }, albumId: input.albumId },
				select: { id: true, mediaIndexId: true },
			});
			const foundIds = new Set(mediaItems.map((media) => media.id));
			const missingIds = mediaIds.filter((mediaId) => !foundIds.has(mediaId));
			if (missingIds.length > 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Media not found in this album: ${missingIds.join(", ")}`,
				});
			}

			const mediaIndexIds = uniqueNumbers(
				mediaItems
					.map((media) => media.mediaIndexId)
					.filter(
						(mediaIndexId: unknown): mediaIndexId is number =>
							typeof mediaIndexId === "number",
					),
			);

			await db.$transaction([
				db.media.updateMany({
					where: { id: { in: mediaIds }, albumId: input.albumId },
					data: { albumId: null },
				}),
				...(mediaIndexIds.length > 0
					? [
							db.albumAudioIndex.updateMany({
								where: {
									albumId: input.albumId,
									blogAudioId: { in: mediaIndexIds },
								},
								data: { albumId: null },
							}),
						]
					: []),
			]);

			return { removed: mediaIds.length };
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
			const { db } = ctx;
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
			return ctx.db.albumBookReference.update({
				where: { id: input.id },
				data: { deletedAt: new Date() },
			});
		}),

	getMediaBookPageReferences: publicProcedure
		.input(z.object({ mediaId: z.number() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.mediaBookPageReference.findMany({
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
			const { db } = ctx;
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

			if (
				input.endSec != null &&
				input.startSec != null &&
				input.endSec < input.startSec
			) {
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
			return ctx.db.mediaBookPageReference.update({
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
				suggestionKeywords: z.string().optional(),
				authorId: z.number().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			const { db } = ctx;
			if (data.authorId != null) {
				await db.author.findFirstOrThrow({
					where: { id: data.authorId, deletedAt: null },
					select: { id: true },
				});
			}
			return db.album.update({
				where: { id },
				data: {
					...(data.name !== undefined ? { name: data.name } : {}),
					...(data.description !== undefined
						? { description: data.description }
						: {}),
					...(data.albumType !== undefined
						? { albumType: data.albumType }
						: {}),
					...(data.suggestionKeywords !== undefined
						? { suggestionKeywords: data.suggestionKeywords }
						: {}),
					...(data.authorId !== undefined
						? { albumAuthorId: data.authorId }
						: {}),
				},
			});
		}),

	updateSuggestionKeywords: publicProcedure
		.input(
			z.object({
				id: z.number(),
				suggestionKeywords: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return ctx.db.album.update({
				where: { id: input.id },
				data: { suggestionKeywords: input.suggestionKeywords.trim() },
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

	updateAuthor: publicProcedure
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1).optional(),
				nameAr: z.string().optional().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			await db.author.findFirstOrThrow({
				where: { id: input.id, deletedAt: null },
				select: { id: true },
			});
			return db.author.update({
				where: { id: input.id },
				data: {
					...(input.name !== undefined ? { name: input.name.trim() } : {}),
					...(input.nameAr !== undefined
						? { nameAr: input.nameAr?.trim() || null }
						: {}),
				},
				select: { id: true, name: true, nameAr: true },
			});
		}),
});
