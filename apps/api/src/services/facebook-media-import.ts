import type { Database, Prisma } from "@acme/db";
import { z } from "zod";

const FACEBOOK_SOURCE = "facebook";
const DEFAULT_FACEBOOK_MEDIA_BRIDGE_BASE_URL = "http://127.0.0.1:8790";
const MAX_IMPORT_LIMIT = 10_000;
const LOCAL_ONLY_BRIDGE_MESSAGE =
	"Facebook media bridge is local-only. Run the API and bridge on your local machine to import Facebook media.";
const LOCAL_BRIDGE_URL_MESSAGE =
	"Facebook media bridge URL must point to localhost or a private LAN host.";

export const facebookMediaImportStatusSchema = z.enum([
	"not_started",
	"running",
	"imported",
	"failed",
	"skipped",
]);

export type FacebookMediaImportStatus = z.infer<
	typeof facebookMediaImportStatusSchema
>;

export const startFacebookMediaImportSchema = z.object({
	blogIds: z.array(z.number().int().positive()).max(100).optional(),
	channelIds: z.array(z.number().int().positive()).max(100).optional(),
	status: facebookMediaImportStatusSchema.or(z.literal("all")).default("all"),
	limit: z
		.number()
		.int()
		.min(1)
		.max(MAX_IMPORT_LIMIT)
		.default(MAX_IMPORT_LIMIT),
	force: z.boolean().default(false),
	baseUrl: z.string().url().optional(),
});

export const facebookMediaImportSummarySchema = z
	.object({
		channelIds: z.array(z.number().int().positive()).max(100).optional(),
	})
	.optional();

export const listFacebookMediaImportsSchema = z
	.object({
		status: facebookMediaImportStatusSchema.or(z.literal("all")).default("all"),
		channelIds: z.array(z.number().int().positive()).max(100).optional(),
		limit: z.number().int().min(1).max(100).default(50),
		cursor: z.number().int().positive().optional(),
	})
	.optional();

export const checkFacebookMediaBridgeSchema = z
	.object({
		baseUrl: z.string().url().optional(),
	})
	.optional();

const telegramFileSchema = z.object({
	fileId: z.string().min(1),
	fileUniqueId: z.string().min(1).nullable().optional(),
	fileType: z.string().min(1).optional(),
	fileName: z.string().nullable().optional(),
	mimeType: z.string().nullable().optional(),
	fileSize: z.number().nullable().optional(),
	width: z.number().nullable().optional(),
	height: z.number().nullable().optional(),
	duration: z.number().nullable().optional(),
});

const bridgeProcessResponseSchema = z.object({
	ok: z.boolean().default(true),
	blogId: z.number().int().optional(),
	status: z.string().optional(),
	mediaType: z.enum(["image", "video", "document"]).optional(),
	mimeType: z.string().nullable().optional(),
	fileName: z.string().nullable().optional(),
	fileSize: z.number().nullable().optional(),
	telegram: z.object({
		messageId: z.number().int(),
		chatId: z.string().or(z.number()).optional(),
		file: telegramFileSchema,
		thumbnail: telegramFileSchema.nullable().optional(),
		raw: z.unknown().optional(),
	}),
	diagnostics: z.unknown().optional(),
});

const bridgeHealthResponseSchema = z
	.object({
		ok: z.boolean().optional(),
		service: z.string().optional(),
		status: z.string().optional(),
		ytDlpAvailable: z.boolean().optional(),
		telegramConfigured: z.boolean().optional(),
		channelConfigured: z.boolean().optional(),
		error: z.string().nullable().optional(),
	})
	.passthrough();

type StartFacebookMediaImportInput = z.infer<
	typeof startFacebookMediaImportSchema
>;
type FacebookMediaImportSummaryInput = z.infer<
	typeof facebookMediaImportSummarySchema
>;
type ListFacebookMediaImportsInput = z.infer<
	typeof listFacebookMediaImportsSchema
>;
type BridgeProcessResponse = z.infer<typeof bridgeProcessResponseSchema>;

type FacebookImportBlog = {
	id: number;
	content: string | null;
	type: string;
	sourceId: string | null;
	sourceUrl: string | null;
	channelId: number | null;
	channel: {
		id: number;
		title: string | null;
		username: string | null;
	} | null;
	meta: unknown;
	createdAt: Date | null;
	sourceSyncedAt: Date | null;
	medias: Array<{
		id: number;
		mimeType: string;
		file: {
			id: number;
			source: string;
			fileId: string;
			fileUniqueId: string | null;
			fileType: string;
			mimeType: string | null;
			fileName: string | null;
			fileSize: number | null;
		} | null;
	}>;
};

export type FacebookMediaImportItem = {
	blogId: number;
	title: string;
	previewText: string | null;
	sourceUrl: string | null;
	sourceId: string | null;
	channel: {
		id: number | null;
		title: string;
		username: string | null;
	};
	status: FacebookMediaImportStatus;
	mediaType: string | null;
	mimeType: string | null;
	messageId: number | null;
	fileId: string | null;
	fileUniqueId: string | null;
	error: string | null;
	lastAttemptAt: string | null;
	importedAt: string | null;
	createdAt: Date | null;
	sourceSyncedAt: Date | null;
};

type FacebookMediaImportJobItem = {
	blogId: number;
	title: string;
	sourceUrl: string | null;
	status: FacebookMediaImportStatus;
	mediaId: number | null;
	error: string | null;
};

export type FacebookMediaImportChannel = {
	id: number;
	title: string;
	username: string | null;
	totalCount: number;
	importedCount: number;
	failedCount: number;
	pendingCount: number;
};

export type FacebookMediaImportJob = {
	id: string;
	status: "running" | "completed" | "failed" | "cancelled";
	baseUrl: string;
	startedAt: string;
	finishedAt: string | null;
	cancelRequested: boolean;
	selectedCount: number;
	processedCount: number;
	importedCount: number;
	failedCount: number;
	skippedCount: number;
	error: string | null;
	items: FacebookMediaImportJobItem[];
};

let activeMediaImportJob: FacebookMediaImportJob | null = null;
let latestMediaImportJob: FacebookMediaImportJob | null = null;
let activeMediaImportAbortController: AbortController | null = null;

function isHostedServerRuntime() {
	return (
		process.env.VERCEL === "1" ||
		Boolean(process.env.VERCEL_ENV) ||
		process.env.FACEBOOK_MEDIA_IMPORT_DISABLED === "true"
	);
}

function isFacebookMediaBridgeAllowed() {
	return !isHostedServerRuntime();
}

function getFacebookMediaBridgeBaseUrl(baseUrl?: string | null) {
	return (
		baseUrl ||
		process.env.FACEBOOK_MEDIA_BRIDGE_BASE_URL ||
		DEFAULT_FACEBOOK_MEDIA_BRIDGE_BASE_URL
	).replace(/\/+$/, "");
}

function isPrivateNetworkHost(hostname: string) {
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "0.0.0.0" ||
		hostname === "::1" ||
		hostname.startsWith("10.") ||
		hostname.startsWith("192.168.") ||
		/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
	);
}

function getFacebookMediaBridgeBlockReason(baseUrl: string) {
	if (!isFacebookMediaBridgeAllowed()) return LOCAL_ONLY_BRIDGE_MESSAGE;

	try {
		const hostname = new URL(baseUrl).hostname;
		if (!isPrivateNetworkHost(hostname)) return LOCAL_BRIDGE_URL_MESSAGE;
	} catch {
		return "Facebook media bridge URL is invalid.";
	}

	return null;
}

function assertFacebookMediaBridgeIsAllowed(baseUrl: string) {
	const blockReason = getFacebookMediaBridgeBlockReason(baseUrl);
	if (blockReason) throw new Error(blockReason);
}

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function truncate(value: string, maxLength: number) {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, maxLength - 3)}...`;
}

function getFacebookMediaDownloadMeta(meta: unknown) {
	const root = asRecord(meta);
	const facebook = asRecord(root.facebook);
	return asRecord(facebook.mediaDownload);
}

function getMetaString(meta: unknown, key: string) {
	const value = getFacebookMediaDownloadMeta(meta)[key];
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getMetaNumber(meta: unknown, key: string) {
	const value = getFacebookMediaDownloadMeta(meta)[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBlogTitle(
	blog: Pick<FacebookImportBlog, "content" | "meta" | "id">,
) {
	const root = asRecord(blog.meta);
	const title = root.title;
	if (typeof title === "string" && title.trim()) return title.trim();

	const facebook = asRecord(root.facebook);
	const facebookTitle = facebook.title;
	if (typeof facebookTitle === "string" && facebookTitle.trim()) {
		return facebookTitle.trim();
	}

	const firstContentLine = (blog.content ?? "")
		.split("\n")
		.map((line) => line.trim())
		.find(Boolean);
	return firstContentLine
		? truncate(firstContentLine, 120)
		: `Facebook blog #${blog.id}`;
}

function getBlogCaption(blog: Pick<FacebookImportBlog, "content" | "meta">) {
	const root = asRecord(blog.meta);
	const facebook = asRecord(root.facebook);
	const caption = facebook.caption;
	if (typeof caption === "string" && caption.trim()) return caption.trim();
	return blog.content ?? "";
}

function getBlogChannel(
	blog: Pick<FacebookImportBlog, "channel" | "channelId">,
) {
	return {
		id: blog.channel?.id ?? blog.channelId,
		title: blog.channel?.title?.trim() || "Unassigned",
		username: blog.channel?.username ?? null,
	};
}

function normalizeChannelIds(channelIds: number[] | undefined) {
	if (!channelIds?.length) return undefined;
	const normalized = Array.from(
		new Set(channelIds.filter((id) => Number.isInteger(id) && id > 0)),
	);
	return normalized.length ? normalized : undefined;
}

function hasImportedTelegramMedia(blog: FacebookImportBlog) {
	return blog.medias.some((media) => Boolean(media.file?.fileId));
}

function getExistingMediaFile(blog: FacebookImportBlog) {
	return blog.medias.find((media) => media.file?.fileId)?.file ?? null;
}

function getFacebookMediaImportStatus(
	blog: FacebookImportBlog,
): FacebookMediaImportStatus {
	if (hasImportedTelegramMedia(blog)) return "imported";
	const savedStatus = getMetaString(blog.meta, "status");
	if (
		savedStatus &&
		facebookMediaImportStatusSchema.safeParse(savedStatus).success
	) {
		return savedStatus as FacebookMediaImportStatus;
	}
	return "not_started";
}

function buildImportItem(blog: FacebookImportBlog): FacebookMediaImportItem {
	const file = getExistingMediaFile(blog);
	return {
		blogId: blog.id,
		title: getBlogTitle(blog),
		previewText: truncate(getBlogCaption(blog), 500) || null,
		sourceUrl: blog.sourceUrl,
		sourceId: blog.sourceId,
		channel: getBlogChannel(blog),
		status: getFacebookMediaImportStatus(blog),
		mediaType: file?.fileType ?? getMetaString(blog.meta, "mediaType"),
		mimeType: file?.mimeType ?? getMetaString(blog.meta, "mimeType"),
		messageId: getMetaNumber(blog.meta, "messageId"),
		fileId: file?.fileId ?? getMetaString(blog.meta, "fileId"),
		fileUniqueId:
			file?.fileUniqueId ?? getMetaString(blog.meta, "fileUniqueId"),
		error: getMetaString(blog.meta, "error"),
		lastAttemptAt: getMetaString(blog.meta, "lastAttemptAt"),
		importedAt: getMetaString(blog.meta, "importedAt"),
		createdAt: blog.createdAt,
		sourceSyncedAt: blog.sourceSyncedAt,
	};
}

function mergeFacebookMediaDownloadMeta(
	meta: unknown,
	patch: Record<string, unknown>,
) {
	const root = asRecord(meta);
	const facebook = asRecord(root.facebook);
	const mediaDownload = asRecord(facebook.mediaDownload);
	return {
		...root,
		facebook: {
			...facebook,
			mediaDownload: {
				...mediaDownload,
				...patch,
			},
		},
	};
}

function inferBlogTypeFromBridge(result: BridgeProcessResponse) {
	const mimeType = result.telegram.file.mimeType ?? result.mimeType ?? "";
	const fileType = result.telegram.file.fileType || result.mediaType || "";
	if (mimeType.startsWith("image/") || fileType === "image") return "image";
	if (mimeType.startsWith("video/") || fileType === "video") return "video";
	return "text";
}

async function updateBlogImportMeta(
	db: Database,
	blog: FacebookImportBlog,
	patch: Record<string, unknown>,
) {
	return db.blog.update({
		where: { id: blog.id },
		data: {
			meta: toInputJson(
				mergeFacebookMediaDownloadMeta(blog.meta, {
					...patch,
					lastAttemptAt: new Date().toISOString(),
				}),
			),
		},
	});
}

async function findFacebookImportBlogs(
	db: Database,
	input: {
		blogIds?: number[];
		channelIds?: number[];
		limit?: number;
		cursor?: number;
	},
) {
	const channelIds = normalizeChannelIds(input.channelIds);
	return db.blog.findMany({
		where: {
			id: input.cursor
				? { gt: input.cursor }
				: input.blogIds
					? { in: input.blogIds }
					: undefined,
			channelId: channelIds ? { in: channelIds } : undefined,
			source: FACEBOOK_SOURCE,
			deletedAt: null,
			sourceUrl: { not: null },
		},
		orderBy: { id: "asc" },
		take: input.limit,
		select: {
			id: true,
			content: true,
			type: true,
			sourceId: true,
			sourceUrl: true,
			channelId: true,
			channel: {
				select: {
					id: true,
					title: true,
					username: true,
				},
			},
			meta: true,
			createdAt: true,
			sourceSyncedAt: true,
			medias: {
				select: {
					id: true,
					mimeType: true,
					file: {
						select: {
							id: true,
							source: true,
							fileId: true,
							fileUniqueId: true,
							fileType: true,
							mimeType: true,
							fileName: true,
							fileSize: true,
						},
					},
				},
			},
		},
	});
}

async function findAllFacebookImportBlogs(
	db: Database,
	input?: { channelIds?: number[] },
) {
	const blogs: FacebookImportBlog[] = [];
	let cursor: number | undefined;

	for (;;) {
		const batch = await findFacebookImportBlogs(db, {
			limit: 1000,
			cursor,
			channelIds: input?.channelIds,
		});
		blogs.push(...batch);

		if (batch.length < 1000) break;
		cursor = batch.at(-1)?.id;
		if (!cursor) break;
	}

	return blogs;
}

async function selectBlogsForImport(
	db: Database,
	input: StartFacebookMediaImportInput,
) {
	if (input.blogIds?.length) {
		const blogs = await findFacebookImportBlogs(db, {
			blogIds: input.blogIds,
			channelIds: input.channelIds,
			limit: input.blogIds.length,
		});

		return blogs
			.filter(
				(blog) =>
					input.force || getFacebookMediaImportStatus(blog) !== "imported",
			)
			.slice(0, input.limit);
	}

	if (
		input.status === "failed" ||
		input.status === "imported" ||
		input.status === "running"
	) {
		return [];
	}

	const blogs: FacebookImportBlog[] = [];
	let cursor: number | undefined;

	for (;;) {
		const batch = await findFacebookImportBlogs(db, {
			channelIds: input.channelIds,
			limit: 500,
			cursor,
		});
		if (batch.length === 0) break;

		for (const blog of batch) {
			const status = getFacebookMediaImportStatus(blog);
			const matchesStatus =
				input.status === "skipped"
					? status === "skipped"
					: status === "not_started" || status === "skipped";
			if (!input.force && !matchesStatus) continue;
			blogs.push(blog);
			if (blogs.length >= input.limit) break;
		}

		if (blogs.length >= input.limit || batch.length < 500) break;
		cursor = batch.at(-1)?.id;
		if (!cursor) break;
	}

	return blogs;
}

async function callFacebookMediaBridge(
	baseUrl: string,
	blog: FacebookImportBlog,
	signal?: AbortSignal,
) {
	if (!blog.sourceUrl) {
		throw new Error("Facebook source URL is missing.");
	}

	const response = await fetch(`${baseUrl}/process`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		signal,
		body: JSON.stringify({
			blogId: blog.id,
			sourceUrl: blog.sourceUrl,
			sourceId: blog.sourceId,
			title: getBlogTitle(blog),
			caption: getBlogCaption(blog),
			channelName:
				blog.channel?.title?.trim() ||
				blog.channel?.username?.trim() ||
				undefined,
		}),
	});

	const bodyText = await response.text();
	let body: unknown = null;
	try {
		body = bodyText ? JSON.parse(bodyText) : null;
	} catch {
		body = null;
	}

	if (!response.ok) {
		const message =
			typeof body === "object" && body && "detail" in body
				? String((body as { detail?: unknown }).detail)
				: bodyText;
		throw new Error(
			`Facebook media bridge failed (${response.status}): ${truncate(
				message || "No response body",
				500,
			)}`,
		);
	}

	const parsed = bridgeProcessResponseSchema.safeParse(body);
	if (!parsed.success) {
		throw new Error(`Unexpected bridge response: ${parsed.error.message}`);
	}
	if (!parsed.data.ok) {
		throw new Error("Facebook media bridge returned ok=false.");
	}
	return parsed.data;
}

async function persistBridgeResult(
	db: Database,
	blog: FacebookImportBlog,
	result: BridgeProcessResponse,
	baseUrl: string,
) {
	const resultFile = result.telegram.file;
	const fileUniqueId = resultFile.fileUniqueId || resultFile.fileId;
	const fileType =
		resultFile.fileType ||
		result.mediaType ||
		(resultFile.mimeType?.split("/")[0] ?? "document");
	const mimeType = resultFile.mimeType ?? result.mimeType ?? null;
	const fileName = resultFile.fileName ?? result.fileName ?? null;
	const fileSize = resultFile.fileSize ?? result.fileSize ?? null;

	const file = await db.file.upsert({
		where: { fileUniqueId },
		create: {
			source: "telegram",
			fileId: resultFile.fileId,
			fileUniqueId,
			fileType,
			mimeType,
			fileName,
			fileSize,
			width: resultFile.width ?? null,
			height: resultFile.height ?? null,
			duration: resultFile.duration ?? null,
		},
		update: {
			source: "telegram",
			fileId: resultFile.fileId,
			fileType,
			mimeType,
			fileName,
			fileSize,
			width: resultFile.width ?? null,
			height: resultFile.height ?? null,
			duration: resultFile.duration ?? null,
		},
	});

	const existingMedia = await db.media.findFirst({
		where: { blogId: blog.id, fileId: file.id },
		select: { id: true },
	});

	const blogType = inferBlogTypeFromBridge(result);
	const thumbnailFileData = result.telegram.thumbnail ?? null;
	let thumbnailId: number | null = null;

	if (thumbnailFileData?.fileId) {
		const thumbnailUniqueId =
			thumbnailFileData.fileUniqueId || thumbnailFileData.fileId;
		const thumbnailFile = await db.file.upsert({
			where: { fileUniqueId: thumbnailUniqueId },
			create: {
				source: "telegram",
				fileId: thumbnailFileData.fileId,
				fileUniqueId: thumbnailUniqueId,
				fileType: thumbnailFileData.fileType || "image",
				mimeType: thumbnailFileData.mimeType ?? "image/jpeg",
				fileName: thumbnailFileData.fileName ?? "video-thumbnail.jpg",
				fileSize: thumbnailFileData.fileSize ?? null,
				width: thumbnailFileData.width ?? null,
				height: thumbnailFileData.height ?? null,
				duration: null,
			},
			update: {
				source: "telegram",
				fileId: thumbnailFileData.fileId,
				fileType: thumbnailFileData.fileType || "image",
				mimeType: thumbnailFileData.mimeType ?? "image/jpeg",
				fileName: thumbnailFileData.fileName ?? "video-thumbnail.jpg",
				fileSize: thumbnailFileData.fileSize ?? null,
				width: thumbnailFileData.width ?? null,
				height: thumbnailFileData.height ?? null,
				duration: null,
			},
		});

		const existingThumbnail = await db.thumbnail.findFirst({
			where: { blogId: blog.id, fileId: thumbnailFile.id, deletedAt: null },
			select: { id: true },
		});
		const thumbnail =
			existingThumbnail ??
			(await db.thumbnail.create({
				data: {
					blogId: blog.id,
					fileId: thumbnailFile.id,
				},
				select: { id: true },
			}));
		thumbnailId = thumbnail.id;
	}

	const media = existingMedia
		? await db.media.update({
				where: { id: existingMedia.id },
				data: {
					mimeType: mimeType ?? blogType,
					title: getBlogTitle(blog),
				},
			})
		: await db.media.create({
				data: {
					blogId: blog.id,
					fileId: file.id,
					mimeType: mimeType ?? blogType,
					title: getBlogTitle(blog),
				},
			});

	await db.blog.update({
		where: { id: blog.id },
		data: {
			type: blogType,
			...(thumbnailId ? { thumbnailId } : {}),
			meta: toInputJson(
				mergeFacebookMediaDownloadMeta(blog.meta, {
					status: "imported",
					stage: "telegram_uploaded",
					importedAt: new Date().toISOString(),
					lastAttemptAt: new Date().toISOString(),
					baseUrl,
					sourceUrl: blog.sourceUrl,
					mediaType: fileType,
					mimeType,
					fileId: resultFile.fileId,
					fileUniqueId,
					messageId: result.telegram.messageId,
					chatId: result.telegram.chatId ?? null,
					fileName,
					fileSize,
					thumbnailFileId: thumbnailFileData?.fileId ?? null,
					thumbnailId,
					error: null,
				}),
			),
		},
	});

	return { mediaId: media.id, fileId: file.id, blogType };
}

async function runFacebookMediaImportJob(
	db: Database,
	job: FacebookMediaImportJob,
	input: StartFacebookMediaImportInput,
	signal: AbortSignal,
) {
	try {
		const blogs = await selectBlogsForImport(db, input);
		job.selectedCount = blogs.length;
		job.items = blogs.map((blog) => ({
			blogId: blog.id,
			title: getBlogTitle(blog),
			sourceUrl: blog.sourceUrl,
			status: "running",
			mediaId: null,
			error: null,
		}));

		for (const blog of blogs) {
			if (job.cancelRequested || signal.aborted) break;

			const item = job.items.find((entry) => entry.blogId === blog.id);
			try {
				await updateBlogImportMeta(db, blog, {
					status: "running",
					stage: "bridge_processing",
					error: null,
				});

				const result = await callFacebookMediaBridge(job.baseUrl, blog, signal);
				const saved = await persistBridgeResult(db, blog, result, job.baseUrl);

				job.importedCount += 1;
				if (item) {
					item.status = "imported";
					item.mediaId = saved.mediaId;
				}
			} catch (error) {
				if (job.cancelRequested || signal.aborted) {
					if (item) {
						item.status = "skipped";
						item.error = "Import stopped.";
					}
					await updateBlogImportMeta(db, blog, {
						status: "skipped",
						stage: "cancelled",
						error: "Import stopped.",
					}).catch(() => undefined);
					break;
				}

				const message =
					error instanceof Error
						? error.message
						: "Facebook media import failed.";
				job.failedCount += 1;
				if (item) {
					item.status = "failed";
					item.error = message;
				}
				await updateBlogImportMeta(db, blog, {
					status: "failed",
					stage: "failed",
					error: truncate(message, 1000),
				}).catch(() => undefined);
			} finally {
				job.processedCount += 1;
			}
		}

		if (job.cancelRequested || signal.aborted) {
			for (const item of job.items) {
				if (item.status !== "running") continue;
				item.status = "skipped";
				item.error = "Import stopped.";
			}
			job.skippedCount = job.items.filter(
				(item) => item.status === "skipped",
			).length;
			job.processedCount =
				job.importedCount + job.failedCount + job.skippedCount;
			job.status = "cancelled";
			job.error = "Import stopped.";
		} else {
			job.status = "completed";
		}
		job.finishedAt = new Date().toISOString();
	} catch (error) {
		job.status = "failed";
		job.finishedAt = new Date().toISOString();
		job.error =
			error instanceof Error ? error.message : "Facebook media import failed.";
	} finally {
		latestMediaImportJob = job;
		if (activeMediaImportJob?.id === job.id) {
			activeMediaImportJob = null;
		}
		if (latestMediaImportJob?.id === job.id) {
			activeMediaImportAbortController = null;
		}
	}
}

export async function startFacebookMediaImportJob(
	db: Database,
	input: StartFacebookMediaImportInput,
) {
	const baseUrl = getFacebookMediaBridgeBaseUrl(input.baseUrl);
	assertFacebookMediaBridgeIsAllowed(baseUrl);

	if (activeMediaImportJob?.status === "running") {
		return { activeJob: activeMediaImportJob, started: false };
	}

	const job: FacebookMediaImportJob = {
		id: `facebook-media-import-${Date.now()}`,
		status: "running",
		baseUrl,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		cancelRequested: false,
		selectedCount: 0,
		processedCount: 0,
		importedCount: 0,
		failedCount: 0,
		skippedCount: 0,
		error: null,
		items: [],
	};

	activeMediaImportJob = job;
	latestMediaImportJob = job;
	const abortController = new AbortController();
	activeMediaImportAbortController = abortController;
	void runFacebookMediaImportJob(db, job, input, abortController.signal);

	return { activeJob: job, started: true };
}

export function stopFacebookMediaImportJob() {
	if (!activeMediaImportJob || activeMediaImportJob.status !== "running") {
		return { activeJob: activeMediaImportJob, stopped: false };
	}

	activeMediaImportJob.cancelRequested = true;
	activeMediaImportJob.error = "Stopping import...";
	activeMediaImportAbortController?.abort();

	return { activeJob: activeMediaImportJob, stopped: true };
}

export function getFacebookMediaImportJob() {
	return {
		activeJob: activeMediaImportJob,
		latestCompletedJob: latestMediaImportJob,
	};
}

export async function getFacebookMediaImportSummary(
	db: Database,
	input?: FacebookMediaImportSummaryInput,
) {
	const parsed = facebookMediaImportSummarySchema.parse(input);
	const blogs = await findAllFacebookImportBlogs(db, {
		channelIds: parsed?.channelIds,
	});
	const items = blogs.map(buildImportItem);
	const importedCount = items.filter(
		(item) => item.status === "imported",
	).length;
	const failedCount = items.filter((item) => item.status === "failed").length;
	const runningCount = items.filter((item) => item.status === "running").length;
	const pendingCount = items.filter(
		(item) => item.status === "not_started" || item.status === "skipped",
	).length;

	return {
		totalCount: items.length,
		importedCount,
		failedCount,
		runningCount,
		pendingCount,
		baseUrl: getFacebookMediaBridgeBaseUrl(),
		job: getFacebookMediaImportJob(),
	};
}

export async function clearFailedFacebookMediaImportStatuses(
	db: Database,
	input?: FacebookMediaImportSummaryInput,
) {
	const parsed = facebookMediaImportSummarySchema.parse(input);
	const blogs = await findAllFacebookImportBlogs(db, {
		channelIds: parsed?.channelIds,
	});
	const failedBlogs = blogs.filter(
		(blog) => getFacebookMediaImportStatus(blog) === "failed",
	);

	if (failedBlogs.length) {
		const resetFailedAt = new Date().toISOString();
		for (const blog of failedBlogs) {
			await db.blog.update({
				where: { id: blog.id },
				data: {
					meta: toInputJson(
						mergeFacebookMediaDownloadMeta(blog.meta, {
							status: "skipped",
							stage: "reset_failed",
							error: null,
							resetFailedAt,
						}),
					),
				},
			});
		}
	}

	return {
		clearedCount: failedBlogs.length,
	};
}

export async function getFacebookMediaImportChannels(db: Database) {
	const blogs = await findAllFacebookImportBlogs(db);
	const byChannel = new Map<number, FacebookMediaImportChannel>();

	for (const blog of blogs) {
		if (!blog.channelId) continue;
		const channel = getBlogChannel(blog);
		if (!channel.id) continue;

		const status = getFacebookMediaImportStatus(blog);
		const current =
			byChannel.get(channel.id) ??
			({
				id: channel.id,
				title: channel.title,
				username: channel.username,
				totalCount: 0,
				importedCount: 0,
				failedCount: 0,
				pendingCount: 0,
			} satisfies FacebookMediaImportChannel);

		current.totalCount += 1;
		if (status === "imported") current.importedCount += 1;
		else if (status === "failed") current.failedCount += 1;
		else current.pendingCount += 1;

		byChannel.set(channel.id, current);
	}

	return Array.from(byChannel.values()).sort((a, b) =>
		a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
	);
}

export async function listFacebookMediaImports(
	db: Database,
	input: ListFacebookMediaImportsInput,
) {
	const parsed = listFacebookMediaImportsSchema.parse(input);
	const limit = parsed?.limit ?? 50;
	const status = parsed?.status ?? "all";
	const channelIds = parsed?.channelIds;
	const items: FacebookMediaImportItem[] = [];
	let cursor = parsed?.cursor;
	let nextCursor: number | null = null;

	for (;;) {
		const blogs = await findFacebookImportBlogs(db, {
			limit: 100,
			cursor,
			channelIds,
		});
		if (blogs.length === 0) {
			nextCursor = null;
			break;
		}

		for (const blog of blogs) {
			cursor = blog.id;
			const item = buildImportItem(blog);
			const matchesStatus =
				status === "all" ||
				item.status === status ||
				(status === "not_started" && item.status === "skipped");
			if (!matchesStatus) continue;
			items.push(item);
			if (items.length >= limit) break;
		}

		nextCursor = blogs.length === 100 ? (cursor ?? null) : null;

		if (items.length >= limit || !nextCursor) break;
	}

	return {
		items,
		nextCursor,
	};
}

export async function checkFacebookMediaBridge(input?: {
	baseUrl?: string;
}) {
	const baseUrl = getFacebookMediaBridgeBaseUrl(input?.baseUrl);
	const blockReason = getFacebookMediaBridgeBlockReason(baseUrl);
	if (blockReason) {
		return {
			ok: false,
			baseUrl,
			service: "facebook-media-bridge",
			status: "local_only",
			ytDlpAvailable: null,
			telegramConfigured: null,
			channelConfigured: null,
			error: blockReason,
		};
	}

	try {
		const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
		const data = await response.json().catch(() => null);
		const parsed = bridgeHealthResponseSchema.safeParse(data);
		return {
			ok: response.ok && (parsed.success ? parsed.data.ok !== false : true),
			baseUrl,
			service: parsed.success
				? (parsed.data.service ?? "facebook-media-bridge")
				: "facebook-media-bridge",
			status: parsed.success
				? (parsed.data.status ?? (response.ok ? "ready" : "offline"))
				: response.ok
					? "ready"
					: "offline",
			ytDlpAvailable: parsed.success
				? (parsed.data.ytDlpAvailable ?? null)
				: null,
			telegramConfigured: parsed.success
				? (parsed.data.telegramConfigured ?? null)
				: null,
			channelConfigured: parsed.success
				? (parsed.data.channelConfigured ?? null)
				: null,
			error: parsed.success ? (parsed.data.error ?? null) : null,
		};
	} catch (error) {
		return {
			ok: false,
			baseUrl,
			service: "facebook-media-bridge",
			status: "offline",
			ytDlpAvailable: null,
			telegramConfigured: null,
			channelConfigured: null,
			error:
				error instanceof Error
					? error.message
					: "Facebook media bridge is not reachable.",
		};
	}
}
