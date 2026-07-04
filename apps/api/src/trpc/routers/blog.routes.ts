import type { Prisma } from "@acme/db";
import { consoleLog } from "@acme/utils";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	checkLocalTranscriber,
	getOrTranscribeTranscriptChunk,
	transcribeRange,
	transcribeRangeSchema,
	transcriptChunkSchema,
} from "../../queries/blog";
import { posts, postsSchema } from "../../queries/posts";
// apps/api/src/routers/blog.route.ts
import { createTRPCRouter, publicProcedure } from "../init";

const blogStatusSchema = z.enum(["draft", "published"]);
const blogTypeSchema = z.enum(["text", "audio", "image", "video", "pdf"]);
const transcriptionJobStatusSchema = z.enum([
	"queued",
	"running",
	"completed",
	"failed",
	"duplicate",
	"already_transcribed",
]);
const transcriptionJobRangeSchema = z.object({
	mediaId: z.number(),
	telegramFileId: z.string().nullish(),
	audioUrl: z.string().nullish(),
	fromSec: z.number().int().nullish(),
	toSec: z.number().int().nullish(),
	language: z.string().default("ar"),
	transcriberUrl: z.string().nullish(),
});
const transcriptionJobInclude = {
	media: {
		select: {
			id: true,
			title: true,
			file: { select: { fileName: true } },
			transcript: {
				select: {
					segments: {
						orderBy: { id: "desc" },
						take: 1,
						select: { model: true },
					},
				},
			},
			blog: { select: { id: true, content: true } },
		},
	},
};
const visibleMainBlogWhere = {
	OR: [
		{ source: null },
		{ source: { not: "facebook" } },
		{
			medias: {
				some: {
					fileId: {
						not: null,
					},
				},
			},
		},
	],
} satisfies Prisma.BlogWhereInput;
const blogMediaUploadSchema = z.object({
	url: z.string().url(),
	downloadUrl: z.string().url().optional(),
	pathname: z.string().min(1),
	contentType: z.string().min(1),
	etag: z.string().optional(),
	size: z.number().nonnegative().optional(),
	name: z.string().optional(),
	title: z.string().optional(),
	width: z.number().nonnegative().optional(),
	height: z.number().nonnegative().optional(),
	duration: z.number().nonnegative().optional(),
});

type BlogMediaUpload = z.infer<typeof blogMediaUploadSchema>;
const mergeBlogsInputSchema = z.object({
	primaryBlogId: z.number(),
	secondaryBlogId: z.number(),
	contentStrategy: z
		.enum(["primary-first", "secondary-first"])
		.optional()
		.default("primary-first"),
});

function normalizeTagTitle(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

function extractHashTags(content: string) {
	return [...(content.match(/#([\p{L}\p{N}_\u0600-\u06FF]+)/gu) ?? [])].map(
		(tag) => tag.slice(1),
	);
}

function inferBlogType(
	requestedType: "text" | "audio" | "image" | "video" | "pdf" | undefined,
	mediaUploads: BlogMediaUpload[],
) {
	if (requestedType && requestedType !== "text") return requestedType;
	const firstMedia = mediaUploads[0];
	if (!firstMedia) return requestedType ?? "text";
	const contentType = firstMedia.contentType.toLowerCase();
	if (contentType.startsWith("audio/")) return "audio";
	if (contentType.startsWith("image/")) return "image";
	if (contentType.startsWith("video/")) return "video";
	if (
		contentType === "application/pdf" ||
		firstMedia.pathname.endsWith(".pdf")
	) {
		return "pdf";
	}
	return "text";
}

function buildBlogSearchWhere(q: string): Prisma.BlogWhereInput {
	const term = q.trim();
	if (!term) return {};

	return {
		OR: [
			{ content: { contains: term, mode: "insensitive" } },
			{
				channel: {
					is: {
						OR: [
							{ title: { contains: term, mode: "insensitive" } },
							{ username: { contains: term, mode: "insensitive" } },
						],
					},
				},
			},
			{
				blogTags: {
					some: {
						tags: { title: { contains: term, mode: "insensitive" } },
					},
				},
			},
			{
				medias: {
					some: {
						OR: [
							{ title: { contains: term, mode: "insensitive" } },
							{
								file: {
									fileName: {
										contains: term,
										mode: "insensitive",
									},
								},
							},
							{
								file: {
									blobPathname: {
										contains: term,
										mode: "insensitive",
									},
								},
							},
							{
								transcript: {
									segments: {
										some: {
											text: {
												contains: term,
												mode: "insensitive",
											},
										},
									},
								},
							},
						],
					},
				},
			},
		],
	};
}

async function attachTagsToBlog(
	db: any,
	blogId: number,
	values: Array<string | null | undefined>,
) {
	const uniqueTags = Array.from(
		new Set(values.map((tag) => normalizeTagTitle(tag ?? "")).filter(Boolean)),
	).slice(0, 10);

	for (const title of uniqueTags) {
		const tag = await db.tags.upsert({
			where: { title },
			create: { title },
			update: {},
		});
		const exists = await db.blogTags.findFirst({
			where: { blogId, tagId: tag.id, deletedAt: null },
		});
		if (!exists) {
			await db.blogTags.create({ data: { blogId, tagId: tag.id } });
		}
	}

	return uniqueTags;
}

async function attachBlobMediaToBlog(
	db: any,
	blogId: number,
	mediaUploads: BlogMediaUpload[],
) {
	for (const upload of mediaUploads) {
		const fileUniqueId = `vercel:${upload.etag || upload.pathname}`;
		const file = await db.file.upsert({
			where: { fileUniqueId },
			create: {
				source: "vercel_blob",
				fileType: upload.contentType.split("/")[0] || "file",
				fileId: upload.pathname,
				fileUniqueId,
				fileSize: upload.size ?? null,
				fileName: upload.name ?? upload.pathname.split("/").pop() ?? null,
				mimeType: upload.contentType,
				width: upload.width ?? null,
				height: upload.height ?? null,
				duration: upload.duration ?? null,
				blobUrl: upload.url,
				blobDownloadUrl: upload.downloadUrl ?? upload.url,
				blobPathname: upload.pathname,
				blobContentType: upload.contentType,
				blobEtag: upload.etag ?? null,
				storageMetadata: upload as any,
			},
			update: {
				source: "vercel_blob",
				fileType: upload.contentType.split("/")[0] || "file",
				fileId: upload.pathname,
				fileSize: upload.size ?? null,
				fileName: upload.name ?? upload.pathname.split("/").pop() ?? null,
				mimeType: upload.contentType,
				width: upload.width ?? null,
				height: upload.height ?? null,
				duration: upload.duration ?? null,
				blobUrl: upload.url,
				blobDownloadUrl: upload.downloadUrl ?? upload.url,
				blobPathname: upload.pathname,
				blobContentType: upload.contentType,
				blobEtag: upload.etag ?? null,
				storageMetadata: upload as any,
			},
		});

		const existing = await db.media.findFirst({
			where: { blogId, fileId: file.id },
		});
		if (!existing) {
			await db.media.create({
				data: {
					blogId,
					fileId: file.id,
					mimeType: upload.contentType,
					title: upload.title ?? upload.name ?? null,
				},
			});
		}
	}
}

export const blogRoutes = createTRPCRouter({
	posts: publicProcedure.input(postsSchema).query(async (props) => {
		consoleLog("Fetching posts with input:", props.input);
		return posts(props.ctx, props.input);
	}),

	getBlog: publicProcedure
		.input(z.object({ id: z.number() }))
		.query(async ({ ctx, input }) => {
			const { db } = ctx;
			return db.blog.findFirstOrThrow({
				where: { id: input.id, deletedAt: null },
				include: {
					medias: {
						include: {
							file: true,
							author: true,
							album: { select: { id: true, name: true } },
							albumAudioIndex: { select: { index: true } },
						},
					},
					blogTags: {
						include: { tags: true },
					},
					channel: {
						select: {
							id: true,
							title: true,
							username: true,
						},
					},
					thumbnail: {
						include: {
							file: true,
						},
					},
					// comments = BlogComments where blog is parent, include the comment blog
					blogs: {
						include: {
							comment: {
								select: { id: true, content: true, createdAt: true },
							},
						},
					},
				},
			});
		}),

	deleteBlog: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.blog.update({
				where: { id: input.id },
				data: { deletedAt: new Date() },
			});
		}),

	restoreBlog: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.blog.update({
				where: { id: input.id },
				data: { deletedAt: null },
			});
		}),

	mergeBlogs: publicProcedure
		.input(mergeBlogsInputSchema)
		.mutation(async ({ ctx, input }) => {
			if (input.primaryBlogId === input.secondaryBlogId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Select two different blogs to merge.",
				});
			}

			const { db } = ctx;
			return db.$transaction(async (tx) => {
				const blogs = await tx.blog.findMany({
					where: {
						id: { in: [input.primaryBlogId, input.secondaryBlogId] },
						deletedAt: null,
					},
					include: {
						medias: true,
						blogTags: { where: { deletedAt: null } },
						blogs: true,
					},
				});

				const primary = blogs.find((blog) => blog.id === input.primaryBlogId);
				const secondary = blogs.find(
					(blog) => blog.id === input.secondaryBlogId,
				);

				if (!primary || !secondary) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "One or both selected blogs were not found.",
					});
				}

				if (
					primary.channelId &&
					secondary.channelId &&
					primary.channelId !== secondary.channelId
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Only blogs from the same channel can be merged.",
					});
				}

				const primaryContent = primary.content?.trim();
				const secondaryContent = secondary.content?.trim();
				const contentParts =
					input.contentStrategy === "secondary-first"
						? [secondaryContent, primaryContent]
						: [primaryContent, secondaryContent];
				const mergedContent = Array.from(
					new Set(contentParts.filter(Boolean)),
				).join("\n\n");

				const secondaryTagIds = secondary.blogTags
					.map((blogTag) => blogTag.tagId)
					.filter((tagId): tagId is number => typeof tagId === "number");

				for (const tagId of secondaryTagIds) {
					const exists = await tx.blogTags.findFirst({
						where: {
							blogId: primary.id,
							tagId,
							deletedAt: null,
						},
						select: { id: true },
					});
					if (!exists) {
						await tx.blogTags.create({
							data: {
								blogId: primary.id,
								tagId,
							},
						});
					}
				}

				await tx.media.updateMany({
					where: { blogId: secondary.id },
					data: { blogId: primary.id },
				});

				await tx.blogComments.updateMany({
					where: { blogId: secondary.id, deletedAt: null },
					data: { blogId: primary.id },
				});

				const secondaryMeta = (secondary.meta ?? {}) as Record<string, unknown>;
				const primaryMeta = (primary.meta ?? {}) as Record<string, unknown>;
				const previousMergedBlogIds = Array.isArray(primaryMeta.mergedBlogIds)
					? primaryMeta.mergedBlogIds.filter(
							(id): id is number =>
								typeof id === "number" && Number.isFinite(id),
						)
					: [];
				const hasAudioMedia = [...primary.medias, ...secondary.medias].some(
					(media) => media.mimeType?.toLowerCase().startsWith("audio/"),
				);

				const merged = await tx.blog.update({
					where: { id: primary.id },
					data: {
						content: mergedContent || primary.content || secondary.content,
						type: hasAudioMedia ? "audio" : primary.type,
						channelId: primary.channelId ?? secondary.channelId,
						meta: {
							...primaryMeta,
							mergedBlogIds: [...previousMergedBlogIds, secondary.id],
							lastMerge: {
								secondaryBlogId: secondary.id,
								secondaryMeta,
								mergedAt: new Date().toISOString(),
							},
						},
					},
					include: {
						medias: {
							include: {
								file: true,
								author: true,
								album: true,
								albumAudioIndex: true,
							},
						},
						blogTags: { include: { tags: true }, where: { deletedAt: null } },
						channel: { select: { id: true, title: true, username: true } },
					},
				});

				await tx.blog.update({
					where: { id: secondary.id },
					data: {
						deletedAt: new Date(),
						meta: {
							...secondaryMeta,
							mergedIntoBlogId: primary.id,
							mergedAt: new Date().toISOString(),
						},
					},
				});

				return merged;
			});
		}),

	// ── Tags ────────────────────────────────────────────────────────────────────

	getTags: publicProcedure.query(async ({ ctx }) => {
		return ctx.db.tags.findMany({
			where: { deletedAt: null },
			orderBy: { title: "asc" },
			select: { id: true, title: true },
		});
	}),

	addTag: publicProcedure
		.input(z.object({ blogId: z.number(), title: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;

			// Upsert tag by title
			const tag = await db.tags.upsert({
				where: { title: input.title },
				create: { title: input.title },
				update: {},
			});

			// Link to blog (skip if already linked)
			const existing = await db.blogTags.findFirst({
				where: { blogId: input.blogId, tagId: tag.id, deletedAt: null },
			});
			if (existing) return existing;

			return db.blogTags.create({
				data: { blogId: input.blogId, tagId: tag.id },
			});
		}),

	removeTag: publicProcedure
		.input(z.object({ blogTagId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.blogTags.update({
				where: { id: input.blogTagId },
				data: { deletedAt: new Date() },
			});
		}),

	// ── Comments ────────────────────────────────────────────────────────────────
	// Blog model uses BlogComments join table (blog = parent, comment = child Blog)
	// A comment is itself a Blog record of type "text" linked via BlogComments

	addComment: publicProcedure
		.input(
			z.object({
				blogId: z.number(),
				content: z.string().min(1),
				timestampSeconds: z.number().int().min(0).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;

			// Create the comment as a Blog record
			const comment = await db.blog.create({
				data: {
					content: input.content,
					type: "text",
					published: true,
					status: "published",
					meta:
						typeof input.timestampSeconds === "number"
							? { audioTimestampSeconds: input.timestampSeconds }
							: undefined,
				},
			});

			// Link via BlogComments
			return db.blogComments.create({
				data: {
					blogId: input.blogId,
					commentId: comment.id,
				},
			});
		}),

	getComments: publicProcedure
		.input(
			z.object({
				blogId: z.number(),
				search: z.string().optional(),
				tagId: z.number().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const blog = await ctx.db.blog.findFirstOrThrow({
				where: { id: input.blogId },
				select: { arrangementMode: true },
			});

			const links = await ctx.db.blogComments.findMany({
				where: { blogId: input.blogId, deletedAt: null },
				orderBy:
					blog.arrangementMode === "indexed"
						? { order: "asc" }
						: { createdAt: "asc" },
				include: {
					comment: {
						select: {
							id: true,
							content: true,
							deletedAt: true,
							createdAt: true,
							meta: true,
							blogTags: { include: { tags: true }, where: { deletedAt: null } },
						},
					},
				},
			});

			// Collect all unique tags from all (unfiltered) comments for the filter chips
			const allLinks = await ctx.db.blogComments.findMany({
				where: { blogId: input.blogId, deletedAt: null },
				include: {
					comment: {
						select: {
							blogTags: { include: { tags: true }, where: { deletedAt: null } },
						},
					},
				},
			});
			const tagMap = new Map<number, string>();
			allLinks.forEach((l) =>
				l.comment?.blogTags.forEach((bt) => {
					if (bt.tags) tagMap.set(bt.tags.id, bt.tags.title);
				}),
			);

			const filteredLinks = links.filter((link) => {
				const comment = link.comment;
				if (!comment || comment.deletedAt) return false;
				if (
					input.search &&
					!comment.content?.toLowerCase().includes(input.search.toLowerCase())
				) {
					return false;
				}
				if (
					input.tagId &&
					!comment.blogTags.some((blogTag) => blogTag.tagId === input.tagId)
				) {
					return false;
				}
				return true;
			});

			return {
				comments: filteredLinks,
				arrangementMode: blog.arrangementMode,
				availableTags: [...tagMap.entries()].map(([id, title]) => ({
					id,
					title,
				})),
			};
		}),

	editComment: publicProcedure
		.input(z.object({ commentId: z.number(), content: z.string().min(1) }))
		.mutation(({ ctx, input }) =>
			ctx.db.blog.update({
				where: { id: input.commentId },
				data: { content: input.content },
			}),
		),

	deleteComment: publicProcedure
		.input(z.object({ blogId: z.number(), commentId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const link = await ctx.db.blogComments.findFirst({
				where: {
					blogId: input.blogId,
					commentId: input.commentId,
					deletedAt: null,
				},
			});
			if (!link) throw new Error("Comment not found");
			return ctx.db.blogComments.update({
				where: { id: link.id },
				data: { deletedAt: new Date() },
			});
		}),

	reorderComments: publicProcedure
		.input(
			z.object({
				blogId: z.number(),
				order: z.array(z.object({ commentId: z.number(), order: z.number() })),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await Promise.all(
				input.order.map(({ commentId, order }) =>
					ctx.db.blogComments.updateMany({
						where: { blogId: input.blogId, commentId },
						data: { order },
					}),
				),
			);
			return { updated: input.order.length };
		}),

	setBlogArrangementMode: publicProcedure
		.input(
			z.object({ blogId: z.number(), mode: z.enum(["default", "indexed"]) }),
		)
		.mutation(({ ctx, input }) =>
			ctx.db.blog.update({
				where: { id: input.blogId },
				data: { arrangementMode: input.mode },
			}),
		),

	transcribeRange: publicProcedure
		.input(transcribeRangeSchema)
		.mutation(async (props) => {
			return transcribeRange(props.ctx, props.input);
		}),

	getTranscriptChunk: publicProcedure
		.input(transcriptChunkSchema)
		.mutation(async (props) => {
			return getOrTranscribeTranscriptChunk(props.ctx, props.input);
		}),

	testTranscriptRange: publicProcedure
		.input(
			z.object({
				fileId: z.string().min(1),
				localTranscriberBaseUrl: z.string().url().optional(),
				language: z.string().min(2).max(8).optional(),
				model: z.enum(["whisper-local", "grok-whisper"]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const startedAt = Date.now();
			const result = await transcribeRange(ctx, {
				fileId: input.fileId,
				fromSec: 0,
				toSec: 20,
				model: input.model ?? "whisper-local",
				localTranscriberBaseUrl: input.localTranscriberBaseUrl,
				language: input.language,
			});

			return {
				...result,
				fromSec: 0,
				toSec: 20,
				elapsedMs: Date.now() - startedAt,
			};
		}),

	checkLocalTranscriber: publicProcedure
		.input(z.object({ baseUrl: z.string().url().optional() }).optional())
		.query(async ({ input }) => {
			try {
				const health = await checkLocalTranscriber(input?.baseUrl);
				return {
					ok: health.ok !== false,
					service: health.service ?? "local-transcriber",
					model: health.model ?? "unknown",
					device: health.device ?? "local",
					status: health.status ?? (health.ok === false ? "offline" : "ready"),
					ready: health.ready ?? health.ok !== false,
					error: health.error ?? null,
					loadSeconds: health.loadSeconds ?? null,
				};
			} catch (error) {
				return {
					ok: false,
					service: "local-transcriber",
					model: "unknown",
					device: "local",
					status: "offline",
					ready: false,
					error:
						error instanceof Error
							? error.message
							: "Local transcriber is not reachable.",
					loadSeconds: null,
				};
			}
		}),

	// ── Transcript ──────────────────────────────────────────────────────────────

	getTranscript: publicProcedure
		.input(z.object({ mediaId: z.number() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.transcript.findUnique({
				where: { mediaId: input.mediaId },
				include: {
					segments: { orderBy: { startSec: "asc" } },
				},
			});
		}),

	saveTranscript: publicProcedure
		.input(
			z.object({
				mediaId: z.number(),
				segments: z.array(
					z.object({
						startSec: z.number(),
						endSec: z.number(),
						text: z.string(),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			// Upsert transcript record
			const transcript = await db.transcript.upsert({
				where: { mediaId: input.mediaId },
				create: { mediaId: input.mediaId, status: "done" },
				update: { status: "done", updatedAt: new Date() },
			});
			// Replace all segments
			await db.transcriptSegment.deleteMany({
				where: { transcriptId: transcript.id },
			});
			await db.transcriptSegment.createMany({
				data: input.segments.map((s) => ({
					transcriptId: transcript.id,
					startSec: s.startSec,
					endSec: s.endSec,
					text: s.text,
				})),
			});
			return transcript;
		}),

	resetTranscript: publicProcedure
		.input(z.object({ mediaId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			const transcript = await db.transcript.findUnique({
				where: { mediaId: input.mediaId },
				select: { id: true },
			});

			return db.$transaction(async (tx: any) => {
				const deletedSegments = transcript
					? await tx.transcriptSegment.deleteMany({
							where: { transcriptId: transcript.id },
						})
					: { count: 0 };
				const deletedTranscript = await tx.transcript.deleteMany({
					where: { mediaId: input.mediaId },
				});
				const deletedJobs = await tx.transcriptionJob.deleteMany({
					where: { mediaId: input.mediaId },
				});

				return {
					mediaId: input.mediaId,
					deletedSegments: deletedSegments.count,
					deletedTranscripts: deletedTranscript.count,
					deletedJobs: deletedJobs.count,
				};
			});
		}),

	getTranscriptionJobs: publicProcedure
		.input(
			z
				.object({
					mediaId: z.number().optional(),
					statuses: z.array(transcriptionJobStatusSchema).optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const db = ctx.db as any;
			return db.transcriptionJob.findMany({
				where: {
					...(input?.mediaId ? { mediaId: input.mediaId } : {}),
					...(input?.statuses?.length
						? { status: { in: input.statuses } }
						: {}),
				},
				include: transcriptionJobInclude,
				orderBy: { createdAt: "desc" },
			});
		}),

	deleteTranscriptionJob: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			const job = await db.transcriptionJob.findUnique({
				where: { id: input.id },
				select: { id: true, status: true },
			});

			if (!job) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Transcription job was not found.",
				});
			}

			if (job.status !== "queued" && job.status !== "failed") {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Only queued or failed transcription jobs can be deleted.",
				});
			}

			const deleted = await db.transcriptionJob.deleteMany({
				where: {
					id: input.id,
					status: { in: ["queued", "failed"] },
				},
			});

			if (deleted.count === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"This transcription job changed status before it could be deleted.",
				});
			}

			return { id: input.id, deleted: true };
		}),

	enqueueTranscriptionJob: publicProcedure
		.input(transcriptionJobRangeSchema)
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			const fromSec = input.fromSec ?? null;
			const toSec = input.toSec ?? null;
			const telegramFileId = input.telegramFileId || null;
			const audioUrl = input.audioUrl || null;

			if (!telegramFileId && !audioUrl) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Queued transcription requires a reachable audio URL or Telegram file ID.",
				});
			}

			return db.$transaction(async (tx: any) => {
				const rangeWhere = {
					mediaId: input.mediaId,
					fromSec,
					toSec,
				};

				await tx.transcriptionJob.deleteMany({
					where: {
						...rangeWhere,
						status: "failed",
					},
				});

				const existing = await tx.transcriptionJob.findFirst({
					where: {
						...rangeWhere,
						status: { in: ["queued", "running"] },
					},
					include: transcriptionJobInclude,
					orderBy: { createdAt: "desc" },
				});
				if (existing) return existing;

				return tx.transcriptionJob.create({
					data: {
						mediaId: input.mediaId,
						telegramFileId,
						audioUrl,
						fromSec,
						toSec,
						language: input.language || "ar",
						transcriberUrl: input.transcriberUrl || null,
						status: "queued",
						progressPercent: 0,
						stage: "queued",
						workerId: null,
						lockedAt: null,
						heartbeatAt: null,
						currentChunk: null,
						totalChunks: null,
						completedAt: null,
						errorMessage: null,
					},
					include: transcriptionJobInclude,
				});
			});
		}),

	updateTranscriptionJob: publicProcedure
		.input(
			z.object({
				id: z.number(),
				status: transcriptionJobStatusSchema,
				errorMessage: z.string().nullish(),
				progressPercent: z.number().int().min(0).max(100).optional(),
				stage: z.string().nullish(),
				currentChunk: z.number().int().positive().nullish(),
				totalChunks: z.number().int().positive().nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const db = ctx.db as any;
			const progressPercent =
				input.progressPercent ??
				(input.status === "completed"
					? 100
					: input.status === "queued"
						? 0
						: undefined);
			return db.transcriptionJob.update({
				where: { id: input.id },
				data: {
					status: input.status,
					progressPercent,
					stage:
						input.stage === undefined
							? input.status === "completed"
								? "completed"
								: input.status === "failed"
									? "failed"
									: undefined
							: input.stage,
					currentChunk: input.currentChunk,
					totalChunks: input.totalChunks,
					updatedAt: new Date(),
					completedAt: input.status === "completed" ? new Date() : undefined,
					heartbeatAt: input.status === "running" ? new Date() : undefined,
					errorMessage:
						input.status === "failed" ? input.errorMessage || null : null,
					retryCount: input.status === "failed" ? { increment: 1 } : undefined,
				},
			});
		}),

	// ── Play History ─────────────────────────────────────────────────────────

	getRecentlyPlayed: publicProcedure
		.input(z.object({ limit: z.number().min(1).max(50).default(20) }))
		.query(async ({ ctx, input }) => {
			const { db } = ctx;
			return db.recentlyPlayed.findMany({
				where: { userId: 1 },
				orderBy: { playedAt: "desc" },
				take: input.limit,
				include: {
					Media: {
						include: {
							file: true,
							blog: {
								select: { id: true, content: true, type: true, blogDate: true },
							},
						},
					},
				},
			});
		}),

	savePlayHistory: publicProcedure
		.input(
			z.object({
				mediaId: z.number(),
				// progress in milliseconds
				progressMs: z.number().min(0),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			// Ensure default user exists
			await db.user.upsert({
				where: { id: 1 },
				create: { id: 1, name: "Default User" },
				update: {},
			});
			// Upsert: one record per media per user
			const existing = await db.recentlyPlayed.findFirst({
				where: { mediaId: input.mediaId, userId: 1 },
			});
			if (existing) {
				return db.recentlyPlayed.update({
					where: { id: existing.id },
					data: { progress: input.progressMs, playedAt: new Date() },
				});
			}
			return db.recentlyPlayed.create({
				data: {
					mediaId: input.mediaId,
					userId: 1,
					progress: input.progressMs,
					playedAt: new Date(),
				},
			});
		}),

	// ── Analytics ────────────────────────────────────────────────────────────

	getAnalytics: publicProcedure.query(async ({ ctx }) => {
		const { db } = ctx;
		const [totalPosts, audioPosts, textPosts, totalViews, totalReactions] =
			await Promise.all([
				db.blog.count({ where: { deletedAt: null } }),
				db.blog.count({ where: { type: "audio", deletedAt: null } }),
				db.blog.count({ where: { type: "text", deletedAt: null } }),
				db.blogViews.count({ where: { type: "view" } }),
				db.reaction.count(),
			]);
		return { totalPosts, audioPosts, textPosts, totalViews, totalReactions };
	}),

	// ── Reactions ────────────────────────────────────────────────────────────

	getReactions: publicProcedure
		.input(z.object({ blogId: z.number() }))
		.query(async ({ ctx, input }) => {
			const rows = await ctx.db.reaction.groupBy({
				by: ["emoji"],
				where: { blogId: input.blogId },
				_count: { emoji: true },
			});
			// Also check which ones current user (id=1) reacted to
			const mine = await ctx.db.reaction.findMany({
				where: { blogId: input.blogId, userId: 1 },
				select: { emoji: true },
			});
			const myEmojis = new Set(mine.map((r) => r.emoji));
			return rows.map((r) => ({
				emoji: r.emoji,
				count: r._count.emoji,
				reacted: myEmojis.has(r.emoji),
			}));
		}),

	addReaction: publicProcedure
		.input(z.object({ blogId: z.number(), emoji: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			// Ensure default user exists
			await db.user.upsert({
				where: { id: 1 },
				create: { id: 1, name: "Default User" },
				update: {},
			});
			// Toggle: if exists delete, else create
			const existing = await db.reaction.findFirst({
				where: { blogId: input.blogId, userId: 1, emoji: input.emoji },
			});
			if (existing) {
				await db.reaction.delete({ where: { id: existing.id } });
				return { action: "removed" };
			}
			await db.reaction.create({
				data: { blogId: input.blogId, userId: 1, emoji: input.emoji },
			});
			return { action: "added" };
		}),

	// ── Recently Viewed ───────────────────────────────────────────────────────

	markViewed: publicProcedure
		.input(z.object({ blogId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			await db.user.upsert({
				where: { id: 1 },
				create: { id: 1, name: "Default User" },
				update: {},
			});
			// Upsert: one record per blog per user, update viewedAt
			const existing = await db.recentlyViewed.findFirst({
				where: { blogId: input.blogId, userId: 1 },
			});
			if (existing) {
				return db.recentlyViewed.update({
					where: { id: existing.id },
					data: { viewedAt: new Date() },
				});
			}
			return db.recentlyViewed.create({
				data: { blogId: input.blogId, userId: 1 },
			});
		}),

	getRecentlyViewed: publicProcedure
		.input(z.object({ limit: z.number().min(1).max(30).default(10) }))
		.query(async ({ ctx, input }) => {
			return ctx.db.recentlyViewed.findMany({
				where: { userId: 1 },
				orderBy: { viewedAt: "desc" },
				take: input.limit,
				include: {
					blog: {
						select: {
							id: true,
							content: true,
							type: true,
							blogDate: true,
							medias: { include: { file: true }, take: 1 },
						},
					},
				},
			});
		}),

	// ── Search ───────────────────────────────────────────────────────────────

	search: publicProcedure
		.input(
			z.object({
				q: z.string().default(""),
				limit: z.number().min(1).max(50).default(20),
				cursor: z.number().nullish(),
				channelIds: z.array(z.number()).optional(),
				type: blogTypeSchema.optional(),
				album: z.enum(["in", "not"]).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { db } = ctx;
			const q = input.q.trim();
			const searchWhere = buildBlogSearchWhere(q);
			const channelWhere: Prisma.BlogWhereInput = input.channelIds?.length
				? { channelId: { in: input.channelIds } }
				: {};
			const albumWhere: Prisma.BlogWhereInput =
				input.album === "in"
					? { medias: { some: { albumId: { not: null } } } }
					: input.album === "not"
						? { medias: { some: { albumId: null } } }
						: {};
			const baseWhere: Prisma.BlogWhereInput = {
				deletedAt: null,
				...searchWhere,
				...channelWhere,
				...albumWhere,
				AND: [visibleMainBlogWhere],
			};
			const itemWhere: Prisma.BlogWhereInput = {
				...baseWhere,
				...(input.type ? { type: input.type } : {}),
			};
			const limit = input.limit;

			const [rows, totalCount, allCount, typeGroups] = await Promise.all([
				db.blog.findMany({
					where: itemWhere,
					take: limit + 1,
					...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
					orderBy: [{ blogDate: "desc" }, { id: "desc" }],
					select: {
						id: true,
						content: true,
						type: true,
						blogDate: true,
						medias: {
							include: {
								file: true,
								album: { select: { id: true, name: true } },
								albumAudioIndex: { select: { index: true } },
								transcript: {
									select: {
										status: true,
										segments: {
											...(q
												? {
														where: {
															text: { contains: q, mode: "insensitive" },
														},
													}
												: {}),
											orderBy: { startSec: "asc" },
											take: 2,
										},
									},
								},
								transcriptionJobs: {
									select: { status: true },
									orderBy: { createdAt: "desc" },
									take: 1,
								},
							},
						},
						blogTags: { include: { tags: true } },
						channel: { select: { id: true, title: true, username: true } },
					},
				}),
				db.blog.count({ where: itemWhere }),
				db.blog.count({ where: baseWhere }),
				db.blog.groupBy({
					by: ["type"],
					where: baseWhere,
					_count: { _all: true },
				}),
			]);

			const hasNextPage = rows.length > limit;
			const data = hasNextPage ? rows.slice(0, limit) : rows;
			const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;

			return {
				data,
				meta: {
					allCount,
					cursor: nextCursor ?? null,
					totalCount,
					typeCounts: typeGroups
						.map((group) => ({
							type: group.type,
							count: group._count._all,
						}))
						.sort((a, b) => a.type.localeCompare(b.type)),
				},
			};
		}),

	searchChannels: publicProcedure
		.input(
			z.object({
				q: z.string().default(""),
				limit: z.number().min(1).max(50).default(20),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { db } = ctx;
			const q = input.q.trim();
			if (!q) return [];

			const searchWhere = buildBlogSearchWhere(q);
			const where: Prisma.BlogWhereInput = {
				deletedAt: null,
				channelId: { not: null },
				...searchWhere,
				AND: [visibleMainBlogWhere],
			};

			const rows = await db.blog.findMany({
				where,
				distinct: ["channelId"],
				take: input.limit,
				orderBy: { blogDate: "desc" },
				select: {
					channel: { select: { id: true, title: true, username: true } },
				},
			});

			const channels = rows
				.map((row) => row.channel)
				.filter(
					(
						channel,
					): channel is {
						id: number;
						title: string | null;
						username: string;
					} => Boolean(channel),
				);

			const counts = await Promise.all(
				channels.map((channel) =>
					db.blog.count({
						where: {
							deletedAt: null,
							channelId: channel.id,
							...searchWhere,
							AND: [visibleMainBlogWhere],
						},
					}),
				),
			);

			return channels.map((channel, index) => ({
				...channel,
				count: counts[index] ?? 0,
			}));
		}),

	suggestSearchKeywords: publicProcedure
		.input(
			z.object({
				q: z.string().trim().default(""),
				limit: z.number().int().min(1).max(20).default(8),
			}),
		)
		.query(async ({ ctx, input }) => {
			const q = input.q.trim();
			if (q.length < 2) return [];

			const [recent, tags, blogs] = await Promise.all([
				ctx.db.search.findMany({
					where: { searchTerm: { contains: q, mode: "insensitive" } },
					distinct: ["searchTerm"],
					orderBy: { createdAt: "desc" },
					take: input.limit,
					select: { searchTerm: true },
				}),
				ctx.db.tags.findMany({
					where: {
						deletedAt: null,
						title: { contains: q, mode: "insensitive" },
					},
					orderBy: { title: "asc" },
					take: input.limit,
					select: { title: true },
				}),
				ctx.db.blog.findMany({
					where: {
						deletedAt: null,
						content: { contains: q, mode: "insensitive" },
					},
					orderBy: { blogDate: "desc" },
					take: input.limit,
					select: { content: true },
				}),
			]);

			const suggestions = new Map<
				string,
				{ keyword: string; source: string }
			>();
			const add = (keyword?: string | null, source = "suggestion") => {
				const normalized = keyword?.trim().replace(/\s+/g, " ");
				if (!normalized || normalized.length < 2) return;
				const key = normalized.toLowerCase();
				if (!suggestions.has(key)) {
					suggestions.set(key, { keyword: normalized.slice(0, 80), source });
				}
			};

			recent.forEach((item) => add(item.searchTerm, "recent"));
			tags.forEach((tag) => add(tag.title, "tag"));
			blogs.forEach((blog) => {
				const content = blog.content ?? "";
				const idx = content.toLowerCase().indexOf(q.toLowerCase());
				if (idx === -1) return;
				const start = Math.max(0, idx - 24);
				add(content.slice(start, idx + q.length + 36), "post");
			});

			return Array.from(suggestions.values()).slice(0, input.limit);
		}),

	// ── Create / Update text blogs ────────────────────────────────────────────

	createBlog: publicProcedure
		.input(
			z.object({
				title: z.string().trim().max(180).optional(),
				content: z.string().trim().max(20000).optional(),
				tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
				type: z.enum(["text", "audio", "image", "video", "pdf"]).optional(),
				published: z.boolean().optional(),
				status: blogStatusSchema.optional(),
				channelId: z.number().optional(),
				mediaUploads: z.array(blogMediaUploadSchema).max(10).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			const now = new Date();
			const title = input.title?.trim() ?? "";
			const body = input.content?.trim() ?? "";
			const mediaUploads = input.mediaUploads ?? [];
			const normalizedContent = [title, body]
				.filter(Boolean)
				.join("\n\n")
				.trim();

			if (!normalizedContent && mediaUploads.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Title, content, or media is required.",
				});
			}

			const status =
				input.status ?? (input.published === false ? "draft" : "published");
			const type = inferBlogType(input.type, mediaUploads);

			return db.$transaction(async (tx) => {
				const blog = await tx.blog.create({
					data: {
						content: normalizedContent || null,
						type,
						published: status === "published",
						publishedAt: status === "published" ? now : null,
						blogDate: now,
						status,
						...(input.channelId ? { channelId: input.channelId } : {}),
						meta: {
							title: title || null,
							mediaSource: mediaUploads.length > 0 ? "vercel_blob" : null,
						},
					},
				});

				await attachBlobMediaToBlog(tx, blog.id, mediaUploads);
				await attachTagsToBlog(tx, blog.id, [
					...(input.tags ?? []),
					...extractHashTags(normalizedContent),
				]);

				return blog;
			});
		}),

	updateBlog: publicProcedure
		.input(
			z.object({
				id: z.number(),
				content: z.string().min(1),
				status: blogStatusSchema.optional(),
				tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
				mediaUploads: z.array(blogMediaUploadSchema).max(10).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { db } = ctx;
			return db.$transaction(async (tx) => {
				const blog = await tx.blog.update({
					where: { id: input.id },
					data: {
						content: input.content,
						...(input.status
							? {
									status: input.status,
									published: input.status === "published",
									publishedAt:
										input.status === "published" ? new Date() : undefined,
								}
							: {}),
					},
				});

				await attachBlobMediaToBlog(tx, blog.id, input.mediaUploads ?? []);
				await attachTagsToBlog(tx, blog.id, [
					...(input.tags ?? []),
					...extractHashTags(input.content),
				]);

				return blog;
			});
		}),

	confirmBlobUpload: publicProcedure
		.input(
			z.object({
				blogId: z.number(),
				media: blogMediaUploadSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await attachBlobMediaToBlog(ctx.db, input.blogId, [input.media]);
			return ctx.db.blog.findFirstOrThrow({
				where: { id: input.blogId },
				include: { medias: { include: { file: true } } },
			});
		}),

	saveSearch: publicProcedure
		.input(z.object({ term: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.search.create({ data: { searchTerm: input.term } });
		}),

	getRecentSearches: publicProcedure
		.input(z.object({ limit: z.number().default(10) }))
		.query(async ({ ctx, input }) => {
			return ctx.db.search.findMany({
				orderBy: { createdAt: "desc" },
				take: input.limit,
				distinct: ["searchTerm"],
				select: { id: true, searchTerm: true, createdAt: true },
			});
		}),
});
