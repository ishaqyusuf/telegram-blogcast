import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../init";

function uniqueNumbers(values: number[]) {
	return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
}

async function ensureDefaultUser(db: any) {
	await db.user.upsert({
		where: { id: 1 },
		create: { id: 1, name: "Default User" },
		update: {},
	});
}

export const playlistRoutes = createTRPCRouter({
	getPlaylists: publicProcedure.query(async ({ ctx }) => {
		return ctx.db.playlist.findMany({
			where: { userId: 1 },
			orderBy: { createdAt: "desc" },
			include: {
				_count: { select: { episodes: true } },
				episodes: {
					orderBy: { addedAt: "asc" },
					take: 1,
					include: {
						episode: {
							include: {
								file: true,
								blog: { select: { id: true, content: true, type: true, blogDate: true } },
							},
						},
					},
				},
			},
		});
	}),

	getPlaylist: publicProcedure
		.input(z.object({ id: z.number() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.playlist.findFirstOrThrow({
				where: { id: input.id, userId: 1 },
				include: {
					episodes: {
						orderBy: { addedAt: "asc" },
						include: {
							episode: {
								include: {
									file: true,
									author: true,
									album: { select: { id: true, name: true } },
									albumAudioIndex: true,
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
							},
						},
					},
				},
			});
		}),

	createPlaylist: publicProcedure
		.input(z.object({ name: z.string().trim().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await ensureDefaultUser(ctx.db);
			return ctx.db.playlist.create({
				data: {
					name: input.name.trim(),
					userId: 1,
				},
			});
		}),

	addMediaToPlaylist: publicProcedure
		.input(
			z.object({
				playlistId: z.number(),
				mediaIds: z.array(z.number()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const mediaIds = uniqueNumbers(input.mediaIds);
			const { db } = ctx;

			return db.$transaction(async (tx) => {
				await ensureDefaultUser(tx);
				await tx.playlist.findFirstOrThrow({
					where: { id: input.playlistId, userId: 1 },
					select: { id: true },
				});

				const mediaItems = await tx.media.findMany({
					where: { id: { in: mediaIds } },
					select: { id: true, mimeType: true },
				});
				const missingIds = mediaIds.filter(
					(id) => !mediaItems.some((media) => media.id === id),
				);
				if (missingIds.length > 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Media not found: ${missingIds.join(", ")}`,
					});
				}
				if (mediaItems.some((media) => !media.mimeType?.toLowerCase().startsWith("audio/"))) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Only audio media can be added to a playlist.",
					});
				}

				let added = 0;
				for (const mediaId of mediaIds) {
					const exists = await tx.playlistEpisode.findFirst({
						where: {
							playlistId: input.playlistId,
							episodeId: mediaId,
						},
						select: { id: true },
					});
					if (exists) continue;
					await tx.playlistEpisode.create({
						data: {
							playlistId: input.playlistId,
							episodeId: mediaId,
						},
					});
					added++;
				}

				return {
					added,
					skipped: mediaIds.length - added,
				};
			});
		}),

	removeMediaFromPlaylist: publicProcedure
		.input(z.object({ playlistId: z.number(), episodeId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.playlistEpisode.deleteMany({
				where: {
					playlistId: input.playlistId,
					episodeId: input.episodeId,
				},
			});
		}),

	reorderEpisodes: publicProcedure
		.input(
			z.object({
				playlistId: z.number(),
				episodeIds: z.array(z.number()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const now = Date.now();
			await Promise.all(
				input.episodeIds.map((episodeId, index) =>
					ctx.db.playlistEpisode.updateMany({
						where: { playlistId: input.playlistId, episodeId },
						data: { addedAt: new Date(now + index) },
					}),
				),
			);
			return { updated: input.episodeIds.length };
		}),
});
