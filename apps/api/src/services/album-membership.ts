import { Prisma } from "@acme/db";
import { TRPCError } from "@trpc/server";
const uniqueNumbers = (values: number[]) => [
	...new Set(values.filter(Number.isFinite)),
];

export async function addAlbumMedia(
	db: Prisma.TransactionClient,
	input: {
		albumId: number;
		mediaIds: number[];
	},
	options: {
		strictMissing?: boolean;
		unalbumedOnly?: boolean;
		channelId?: number;
		// Manual picker only. Automated callers retain the single-channel rule.
		allowCrossChannel?: boolean;
		expectedMembership?: { mediaId: number; albumId: number | null }[];
	} = {},
) {
	const strictMissing = options.strictMissing ?? true;
	const mediaIds = uniqueNumbers(input.mediaIds);
	await db.$queryRaw`SELECT "id" FROM "Album" WHERE "id" = ${input.albumId} FOR UPDATE`;
	if (mediaIds.length)
		await db.$queryRaw`SELECT "id" FROM "Media" WHERE "id" IN (${Prisma.join(mediaIds)}) ORDER BY "id" FOR UPDATE`;
	const mediaItems = await db.media.findMany({
		where: { id: { in: mediaIds } },
		include: {
			blog: { select: { channelId: true, deletedAt: true } },
			file: { select: { mimeType: true } },
		},
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
	if (
		options.expectedMembership?.some(
			(expected) =>
				mediaById.get(expected.mediaId)?.albumId !== expected.albumId &&
				mediaById.get(expected.mediaId)?.albumId !== input.albumId,
		)
	) {
		throw new TRPCError({
			code: "CONFLICT",
			message:
				"Album membership changed. Close the picker and review the audio again.",
		});
	}

	if (
		options.channelId != null &&
		orderedMediaItems.some(
			(media) =>
				media.blog?.channelId !== options.channelId ||
				media.blog?.deletedAt ||
				!(
					media.mimeType?.toLowerCase().startsWith("audio/") ||
					media.file?.mimeType?.toLowerCase().startsWith("audio/")
				),
		)
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Some tracks no longer belong to this channel.",
		});
	}
	if (
		options.unalbumedOnly &&
		orderedMediaItems.some(
			(media) => media.albumId != null && media.albumId !== input.albumId,
		)
	) {
		throw new TRPCError({
			code: "CONFLICT",
			message:
				"Some tracks were added to another album. Refresh and review them again.",
		});
	}
	const itemsToAdd = orderedMediaItems.filter(
		(media) => media.albumId !== input.albumId,
	);
	if (orderedMediaItems.some((media) => !media.blog || media.blog.deletedAt)) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Some audio posts are no longer available.",
		});
	}
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
			(media) =>
				!(
					media.mimeType?.toLowerCase().startsWith("audio/") ||
					media.file?.mimeType?.toLowerCase().startsWith("audio/")
				),
		)
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Only audio media can be added to an album.",
		});
	}

	if (!options.allowCrossChannel && channelIds.length > 1) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Album media must come from one channel.",
		});
	}

	if (
		!options.allowCrossChannel &&
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

	const maxIdx = await db.albumAudioIndex.aggregate({
		where: { albumId: input.albumId },
		_max: { index: true },
	});
	const nextIndex = (maxIdx._max.index ?? 0) + 1;

	if (!album.channelId && inferredChannelId) {
		await db.album.update({
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

		await db.$executeRaw`
			UPDATE "Media" AS media
			SET "albumId" = ${input.albumId},
				"mediaIndexId" = COALESCE(media."mediaIndexId", media."id")
			WHERE media."id" IN (${Prisma.join(itemIds)})
		`;

		await db.$executeRaw`
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
