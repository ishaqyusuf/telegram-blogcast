import type { Database } from "@acme/db";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { addAlbumMedia } from "./album-membership";
import {
	json,
	lockChannel,
	readOrganizerState,
	type reviewDraftSchema,
} from "./album-organizer";

export async function saveOrganizerReview(
	db: Database,
	input: {
		runId: number;
		suggestionId: number;
		draft: z.infer<typeof reviewDraftSchema>;
	},
) {
	const run = await db.albumAutoIndexRun.findFirstOrThrow({
		where: { id: input.runId, deletedAt: null },
	});
	return db.$transaction(async (tx) => {
		await lockChannel(tx, run.channelId);
		const current = await tx.albumAutoIndexRun.findUniqueOrThrow({
			where: { id: run.id },
		});
		const state = readOrganizerState(current.inputJson);
		const suggestion = await tx.albumAutoIndexAlbumSuggestion.findFirstOrThrow({
			where: { id: input.suggestionId, runId: run.id, deletedAt: null },
			include: { mediaSuggestions: true },
		});
		const allowed = new Set(suggestion.mediaSuggestions.map((item) => item.id));
		if (input.draft.selectedIds.some((value) => !allowed.has(value)))
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Track selection does not belong to this suggestion.",
			});
		if (!["approved", "dismissed"].includes(suggestion.status))
			state.review.currentSuggestionId = suggestion.id;
		if (suggestion.status !== "approved")
			state.review.drafts[String(suggestion.id)] = input.draft;
		await tx.albumAutoIndexRun.update({
			where: { id: run.id },
			data: { inputJson: json({ ...state.object, review: state.review }) },
		});
		return state.review;
	});
}

export async function approveOrganizerReview(
	db: Database,
	input: {
		runId: number;
		suggestionId: number;
		draft: z.infer<typeof reviewDraftSchema>;
	},
) {
	const run = await db.albumAutoIndexRun.findFirstOrThrow({
		where: { id: input.runId, deletedAt: null },
	});
	return db.$transaction(
		async (tx) => {
			await lockChannel(tx, run.channelId);
			const current = await tx.albumAutoIndexRun.findUniqueOrThrow({
				where: { id: run.id },
			});
			const state = readOrganizerState(current.inputJson);
			if (state.scan && !state.scan.complete)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Finish discovery before reviewing albums.",
				});
			const suggestion =
				await tx.albumAutoIndexAlbumSuggestion.findFirstOrThrow({
					where: { id: input.suggestionId, runId: run.id, deletedAt: null },
					include: { mediaSuggestions: { where: { deletedAt: null } } },
				});
			if (suggestion.status === "approved") {
				const albumId =
					state.review.targets[String(suggestion.id)] ?? suggestion.albumId;
				if (albumId == null)
					throw new TRPCError({
						code: "CONFLICT",
						message:
							"This saved approval has no album destination. Refresh before continuing.",
					});
				return { albumId, added: 0, alreadyAdded: 0 };
			}
			const ids = new Set(input.draft.selectedIds);
			const allowedIds = new Set(
				suggestion.mediaSuggestions.map((item) => item.id),
			);
			if (input.draft.selectedIds.some((id) => !allowedIds.has(id)))
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Track selection does not belong to this suggestion.",
				});
			const rows = suggestion.mediaSuggestions.filter(
				(item) =>
					ids.has(item.id) && ["pending", "failed"].includes(item.status),
			);
			if (!rows.length)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Select at least one available track.",
				});
			let albumId = input.draft.targetAlbumId;
			if (albumId == null) {
				const name = input.draft.name.trim();
				if (!name)
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Enter an album name.",
					});
				const created = await tx.album.create({
					data: {
						channelId: run.channelId,
						name,
						albumType: suggestion.proposedAlbumType ?? "series",
					},
				});
				albumId = created.id;
			} else {
				const target = await tx.album.findFirstOrThrow({
					where: { id: albumId, deletedAt: null },
					select: {
						channelId: true,
						medias: { select: { blog: { select: { channelId: true } } } },
					},
				});
				if (
					(target.channelId != null && target.channelId !== run.channelId) ||
					target.medias.some((item) => item.blog?.channelId !== run.channelId)
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Choose an album from this channel.",
					});
				}
			}
			const result = await addAlbumMedia(
				tx,
				{ albumId, mediaIds: rows.map((item) => item.mediaId) },
				{ unalbumedOnly: true, channelId: run.channelId },
			);
			await tx.albumAutoIndexMediaSuggestion.updateMany({
				where: { id: { in: rows.map((item) => item.id) } },
				data: { status: "approved" },
			});
			// Unchecked tracks remain recoverable in the saved discovery, without being added.
			await tx.albumAutoIndexMediaSuggestion.updateMany({
				where: {
					suggestionId: suggestion.id,
					status: { in: ["pending", "failed"] },
				},
				data: { status: "dismissed" },
			});
			const sameTarget = await tx.albumAutoIndexAlbumSuggestion.findFirst({
				where: { runId: run.id, albumId, id: { not: suggestion.id } },
			});
			await tx.albumAutoIndexAlbumSuggestion.update({
				where: { id: suggestion.id },
				data: { status: "approved", albumId: sameTarget ? null : albumId },
			});
			state.review.targets[String(suggestion.id)] = albumId;
			const next = await tx.albumAutoIndexAlbumSuggestion.findFirst({
				where: {
					runId: run.id,
					deletedAt: null,
					status: { in: ["pending", "partial", "failed"] },
				},
				orderBy: { id: "asc" },
			});
			state.review.currentSuggestionId = next?.id ?? null;
			delete state.review.drafts[String(suggestion.id)];
			await tx.albumAutoIndexRun.update({
				where: { id: run.id },
				data: {
					status: next ? "partially-approved" : "approved",
					inputJson: json({ ...state.object, review: state.review }),
				},
			});
			return {
				albumId,
				added: result.added,
				alreadyAdded: result.alreadyAdded,
			};
		},
		{ timeout: 15000 },
	);
}
