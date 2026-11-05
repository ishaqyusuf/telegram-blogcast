import { randomUUID } from "node:crypto";
import type { Database, Prisma } from "@acme/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	albumIndexAiProviderSchema,
	buildAlbumAutoIndexSnapshot,
	getAlbumIndexAiConfig,
	normalizeAlbumIndexResponse,
	requestAlbumIndex,
} from "./album-auto-index";

const id = z.number().int().positive();
export const reviewDraftSchema = z.object({
	selectedIds: z.array(id),
	targetAlbumId: id.nullable(),
	name: z.string().max(200),
});
const scanSchema = z.object({
	version: z.literal(1),
	afterId: z.number().int().nonnegative(),
	throughId: z.number().int().nonnegative(),
	complete: z.boolean(),
	mediaIds: z.array(id),
	unassignedIds: z.array(id),
	legacyIds: z.array(id).default([]),
	lease: z.object({ token: z.string(), until: z.number() }).nullable(),
});
const reviewSchema = z.object({
	currentSuggestionId: id.nullable().default(null),
	drafts: z.record(z.string(), reviewDraftSchema).default({}),
	targets: z.record(z.string(), id).default({}),
});

export function readOrganizerState(value: unknown) {
	const object =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const scan = scanSchema.safeParse(object.scan);
	const review = reviewSchema.safeParse(object.review);
	return {
		object,
		scan: scan.success ? scan.data : null,
		review: review.success
			? review.data
			: { currentSuggestionId: null, drafts: {}, targets: {} },
	};
}

// The same short database lock serializes scan claims, draft saves and approvals.
// AI requests happen outside the transaction and have a separate expiring lease.
export async function lockChannel(
	tx: Prisma.TransactionClient,
	channelId: number,
) {
	await tx.$queryRaw`SELECT pg_advisory_xact_lock(741903, ${channelId}::int)::text`;
}
export const json = (value: unknown) => value as Prisma.InputJsonValue;
const runResult = (run: {
	id: number;
	status: string;
	inputJson: unknown;
	mediaCount: number;
}) => ({
	id: run.id,
	status: run.status,
	scan: readOrganizerState(run.inputJson).scan,
	mediaCount: run.mediaCount,
});
const candidateWhere = (channelId: number): Prisma.MediaWhereInput => ({
	albumId: null,
	mimeType: { startsWith: "audio/" },
	blog: { is: { channelId, deletedAt: null, type: "audio" } },
});

export async function startOrganizerDiscovery(
	db: Database,
	input: {
		channelId: number;
		provider: z.infer<typeof albumIndexAiProviderSchema>;
	},
) {
	return db.$transaction(
		async (tx) => {
			await lockChannel(tx, input.channelId);
			await tx.channel.findFirstOrThrow({
				where: { id: input.channelId, deletedAt: null },
			});
			const previous = await tx.albumAutoIndexRun.findMany({
				where: { channelId: input.channelId, deletedAt: null },
				orderBy: { id: "desc" },
				select: { id: true, status: true, inputJson: true, mediaCount: true },
			});
			const unfinished = previous.find((run) => {
				const scan = readOrganizerState(run.inputJson).scan;
				return scan && !scan.complete;
			});
			if (unfinished) return runResult(unfinished);
			// A cursor orders one scan. Coverage identities also find recordings that become
			// eligible later with older IDs, such as an import committed out of order.
			const afterId = 0;
			const legacyIds = [
				...new Set(
					previous.flatMap((run) => {
						const state = readOrganizerState(run.inputJson);
						if (state.scan)
							return [...state.scan.mediaIds, ...state.scan.legacyIds];
						if (run.status === "failed" || run.status === "running") return [];
						const chunks = z
							.array(z.object({ mediaIds: z.array(id) }))
							.safeParse(state.object.chunks);
						return chunks.success
							? chunks.data.flatMap((chunk) => chunk.mediaIds)
							: [];
					}),
				),
			];
			const last = await tx.media.findFirst({
				where: {
					...candidateWhere(input.channelId),
					id: { gt: afterId, notIn: legacyIds },
				},
				orderBy: { id: "desc" },
				select: { id: true },
			});
			const throughId = Math.max(afterId, last?.id ?? 0);
			if (!last) {
				const saved = previous.find(
					(run) => run.status !== "failed" && run.status !== "running",
				);
				if (saved) return runResult(saved);
			}

			const config = getAlbumIndexAiConfig(input.provider);
			const run = await tx.albumAutoIndexRun.create({
				data: {
					channelId: input.channelId,
					provider: config.provider,
					model: config.model,
					status: throughId === afterId ? "generated" : "running",
					inputJson: json({
						scan: {
							version: 1,
							afterId,
							throughId,
							complete: throughId === afterId,
							mediaIds: [],
							unassignedIds: [],
							legacyIds,
							lease: null,
						},
					}),
				},
			});
			return runResult(run);
		},
		{ timeout: 15000 },
	);
}

export async function continueOrganizerDiscovery(
	db: Database,
	runId: number,
	request = requestAlbumIndex,
) {
	const row = await db.albumAutoIndexRun.findFirstOrThrow({
		where: { id: runId, deletedAt: null },
	});
	const claim = await db.$transaction(async (tx) => {
		await lockChannel(tx, row.channelId);
		const run = await tx.albumAutoIndexRun.findUniqueOrThrow({
			where: { id: runId },
		});
		const state = readOrganizerState(run.inputJson);
		if (!state.scan)
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "This saved discovery is already available for review.",
			});
		if (
			state.scan.complete ||
			(state.scan.lease && state.scan.lease.until > Date.now())
		)
			return { run, token: null };
		const token = randomUUID();
		state.scan.lease = { token, until: Date.now() + 180000 };
		const updated = await tx.albumAutoIndexRun.update({
			where: { id: runId },
			data: {
				status: "running",
				error: null,
				inputJson: json({ ...state.object, scan: state.scan }),
			},
		});
		return { run: updated, token };
	});
	if (!claim.token) return runResult(claim.run);
	const scan = readOrganizerState(claim.run.inputJson).scan;
	if (!scan)
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Discovery state could not be read.",
		});
	try {
		const [channel, albums, media] = await Promise.all([
			db.channel.findFirstOrThrow({
				where: { id: row.channelId, deletedAt: null },
				select: { id: true, title: true, username: true },
			}),
			db.album.findMany({
				where: {
					deletedAt: null,
					OR: [
						{ channelId: row.channelId },
						{
							channelId: null,
							medias: {
								some: {
									blog: { is: { channelId: row.channelId, deletedAt: null } },
								},
							},
						},
					],
				},
				select: {
					id: true,
					name: true,
					albumType: true,
					description: true,
					suggestionKeywords: true,
				},
				orderBy: { id: "asc" },
			}),
			db.media.findMany({
				where: {
					...candidateWhere(row.channelId),
					id: { gt: scan.afterId, lte: scan.throughId, notIn: scan.legacyIds },
				},
				orderBy: { id: "asc" },
				take: 50,
				select: {
					id: true,
					title: true,
					file: { select: { fileName: true } },
					blog: { select: { content: true } },
				},
			}),
		]);
		const snapshot = buildAlbumAutoIndexSnapshot({
			channel,
			albums: albums.map((album) => ({ ...album, medias: [] })),
			media,
		});
		const ai = media.length
			? await request(snapshot, {
					provider: albumIndexAiProviderSchema.parse(row.provider),
				})
			: null;
		const normalized = ai
			? normalizeAlbumIndexResponse(ai.parsedResponse, snapshot)
			: { albums: [], suggestionCount: 0 };
		return await db.$transaction(
			async (tx) => {
				await lockChannel(tx, row.channelId);
				const current = await tx.albumAutoIndexRun.findUniqueOrThrow({
					where: { id: runId },
				});
				const state = readOrganizerState(current.inputJson);
				if (state.scan?.lease?.token !== claim.token) return runResult(current);
				for (const album of normalized.albums) {
					const existing = await tx.albumAutoIndexAlbumSuggestion.findFirst({
						where: {
							runId,
							deletedAt: null,
							...(album.albumId != null
								? { albumId: album.albumId }
								: {
										albumId: null,
										proposedAlbumName: {
											equals: album.proposedAlbumName ?? "",
											mode: "insensitive",
										},
									}),
						},
					});
					const suggestion =
						existing ??
						(await tx.albumAutoIndexAlbumSuggestion.create({
							data: {
								runId,
								albumId: album.albumId,
								albumNameSnapshot: album.albumNameSnapshot,
								suggestionType: album.suggestionType,
								proposedAlbumName: album.proposedAlbumName,
								proposedAlbumType: album.proposedAlbumType,
								proposedDescription: album.proposedDescription,
								proposedSuggestionKeywords: album.proposedSuggestionKeywords,
								confidence: album.confidence,
								reason: album.reason,
							},
						}));
					await tx.albumAutoIndexMediaSuggestion.createMany({
						data: album.media.map((item) => ({
							suggestionId: suggestion.id,
							mediaId: item.mediaId,
							mediaTitleSnapshot: item.mediaTitleSnapshot,
							confidence: item.confidence,
							reason: item.reason,
						})),
						skipDuplicates: true,
					});
				}
				const suggestedIds = new Set(
					normalized.albums.flatMap((album) =>
						album.media.map((item) => item.mediaId),
					),
				);
				state.scan.mediaIds.push(...media.map((item) => item.id));
				state.scan.unassignedIds.push(
					...media
						.filter((item) => !suggestedIds.has(item.id))
						.map((item) => item.id),
				);
				state.scan.afterId = media.at(-1)?.id ?? state.scan.throughId;
				state.scan.complete =
					media.length < 50 || state.scan.afterId >= state.scan.throughId;
				if (state.scan.complete) state.scan.afterId = state.scan.throughId;
				state.scan.lease = null;
				const chunks = Array.isArray(current.rawResponseJson)
					? current.rawResponseJson
					: [];
				const saved = await tx.albumAutoIndexRun.update({
					where: { id: runId },
					data: {
						status: state.scan.complete ? "generated" : "running",
						inputJson: json({ ...state.object, scan: state.scan }),
						mediaCount: state.scan.mediaIds.length,
						albumCount: albums.length,
						suggestionCount: await tx.albumAutoIndexMediaSuggestion.count({
							where: { suggestion: { runId } },
						}),
						rawResponseJson: json([
							...chunks,
							{
								mediaIds: media.map((item) => item.id),
								provider: ai?.provider ?? current.provider,
								model: ai?.model ?? current.model,
								raw: ai?.rawResponse ?? null,
								parsed: ai?.parsedResponse ?? null,
							},
						]),
					},
				});
				return runResult(saved);
			},
			{ timeout: 15000 },
		);
	} catch (error) {
		await db.$transaction(async (tx) => {
			await lockChannel(tx, row.channelId);
			const current = await tx.albumAutoIndexRun.findUniqueOrThrow({
				where: { id: runId },
			});
			const state = readOrganizerState(current.inputJson);
			if (state.scan?.lease?.token !== claim.token) return;
			state.scan.lease = null;
			await tx.albumAutoIndexRun.update({
				where: { id: runId },
				data: {
					status: "failed",
					error:
						error instanceof Error
							? error.message
							: "Discovery failed. Retry to continue.",
					inputJson: json({ ...state.object, scan: state.scan }),
				},
			});
		});
		throw error;
	}
}
