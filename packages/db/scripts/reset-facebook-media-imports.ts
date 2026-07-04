import { db } from "../src/index";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");

async function main() {
	const blogs = await db.blog.findMany({
		where: {
			source: "facebook",
			deletedAt: null,
		},
		select: {
			id: true,
			type: true,
			meta: true,
			thumbnailId: true,
			medias: {
				select: {
					id: true,
					mediaIndexId: true,
				},
			},
		},
	});

	const blogIds = blogs.map((blog) => blog.id);
	const mediaIds = blogs.flatMap((blog) =>
		blog.medias.map((media) => media.id),
	);
	const mediaIndexIds = blogs
		.flatMap((blog) => blog.medias.map((media) => media.mediaIndexId))
		.filter((id): id is number => typeof id === "number");
	const thumbnailIds = blogs
		.map((blog) => blog.thumbnailId)
		.filter((id): id is number => typeof id === "number");

	const transcripts = mediaIds.length
		? await db.transcript.findMany({
				where: { mediaId: { in: mediaIds } },
				select: { id: true },
			})
		: [];
	const transcriptIds = transcripts.map((transcript) => transcript.id);
	const thumbnailWhere = [
		{ blogId: { in: blogIds } },
		...(thumbnailIds.length ? [{ id: { in: thumbnailIds } }] : []),
	];
	const thumbnails = blogIds.length
		? await db.thumbnail.findMany({
				where: {
					OR: thumbnailWhere,
				},
				select: { id: true },
			})
		: [];
	const resetSummary = {
		mode: execute ? "execute" : "dry-run",
		facebookBlogs: blogIds.length,
		mediaRows: mediaIds.length,
		mediaIndexRows: mediaIndexIds.length,
		thumbnailRows: thumbnails.length,
		transcriptRows: transcriptIds.length,
	};

	console.log(JSON.stringify(resetSummary, null, 2));

	if (!execute) {
		console.log("Dry run only. Re-run with --execute to reset.");
		return;
	}

	await db.$transaction(
		async (tx) => {
			if (transcriptIds.length) {
				await tx.transcriptSegment.deleteMany({
					where: { transcriptId: { in: transcriptIds } },
				});
			}

			if (mediaIds.length) {
				await tx.transcript.deleteMany({
					where: { mediaId: { in: mediaIds } },
				});
				await tx.transcriptionJob.deleteMany({
					where: { mediaId: { in: mediaIds } },
				});
				await tx.recentlyPlayed.deleteMany({
					where: { mediaId: { in: mediaIds } },
				});
				await tx.playlistEpisode.deleteMany({
					where: { episodeId: { in: mediaIds } },
				});
				await tx.mediaBookPageReference.deleteMany({
					where: { mediaId: { in: mediaIds } },
				});
			}

			if (mediaIndexIds.length) {
				await tx.albumAudioIndex.deleteMany({
					where: { blogAudioId: { in: mediaIndexIds } },
				});
			}

			await tx.blog.updateMany({
				where: { id: { in: blogIds } },
				data: {
					type: "text",
					thumbnailId: null,
				},
			});

			await tx.$executeRawUnsafe(`
			UPDATE "Blog"
			SET "meta" =
				CASE
					WHEN "meta" IS NULL THEN NULL
					WHEN ("meta"::jsonb ? 'facebook') THEN
						jsonb_set(
							"meta"::jsonb,
							'{facebook}',
							(("meta"::jsonb -> 'facebook') - 'mediaDownload'),
							false
						)
					ELSE "meta"::jsonb
				END
			WHERE "id" IN (${blogIds.join(",")})
		`);

			if (mediaIds.length) {
				await tx.media.deleteMany({ where: { id: { in: mediaIds } } });
			}

			const thumbnailDeleteIds = thumbnails.map((thumbnail) => thumbnail.id);
			if (thumbnailDeleteIds.length) {
				await tx.thumbnail.deleteMany({
					where: { id: { in: thumbnailDeleteIds } },
				});
			}
		},
		{ timeout: 60_000 },
	);

	console.log("Facebook media imports reset.");
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
