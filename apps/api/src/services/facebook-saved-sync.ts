import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	type FacebookSavedItem,
	canonicalizeFacebookSavedUrl,
	getFacebookSavedIdentity,
	mergeFacebookSavedExports,
	normalizeFacebookSavedItem,
	normalizeFacebookSavedText,
} from "@acme/blog/facebook-saved";
import type { Database, Prisma } from "@acme/db";
import { z } from "zod";

const FACEBOOK_SOURCE = "facebook";
const UNCATEGORIZED_COLLECTION = "Uncategorized";
const DEFAULT_BATCH_SIZE = 50;

const facebookSavedItemSchema = z
	.object({
		title: z.string().max(2_000).optional(),
		link: z.string().max(4_000).optional(),
		url: z.string().max(4_000).optional(),
		sourcePostUrl: z.string().max(4_000).optional(),
		sourceTitle: z.string().max(2_000).optional(),
		collection: z.string().max(500).optional(),
		avatar: z.string().max(8_000).optional(),
		caption: z.string().max(100_000).optional(),
		blogId: z.number().int().positive().optional(),
	})
	.superRefine((item, context) => {
		const candidate = item.url || item.sourcePostUrl || item.link;
		if (!candidate) {
			context.addIssue({
				code: "custom",
				message: "A saved item must include a Facebook post URL.",
			});
			return;
		}

		try {
			const hostname = new URL(candidate).hostname.toLowerCase();
			if (hostname !== "facebook.com" && !hostname.endsWith(".facebook.com")) {
				context.addIssue({
					code: "custom",
					message: "Saved item URLs must use a Facebook domain.",
				});
			}
		} catch {
			context.addIssue({
				code: "custom",
				message: "Saved item URLs must be valid absolute URLs.",
			});
		}
	});

export const facebookSavedCaptureSchema = z.object({
	exportedAt: z.string().datetime(),
	source: z.object({
		type: z.literal("facebook-saved"),
		url: z.string().url(),
		title: z.string().nullable(),
	}),
	items: z.array(facebookSavedItemSchema).max(5_000),
	capture: z.object({
		complete: z.boolean(),
		stopReason: z.enum([
			"known_boundary",
			"natural_end",
			"safety_cap",
			"no_known_overlap",
			"authentication_required",
			"unexpected_page",
			"extraction_failed",
		]),
		scannedCount: z.number().int().nonnegative(),
		knownCount: z.number().int().nonnegative(),
		newCount: z.number().int().nonnegative(),
		consecutiveKnownCount: z.number().int().nonnegative(),
		noGrowthPasses: z.number().int().nonnegative(),
		atEnd: z.boolean(),
		passes: z.number().int().nonnegative(),
		boundaryThreshold: z.literal(20),
	}),
	validation: z.object({
		errors: z.array(z.string()).max(100),
	}),
});

export const syncFacebookSavedCaptureSchema = z.object({
	capture: facebookSavedCaptureSchema,
	dryRun: z.boolean().default(false),
	batchSize: z.number().int().min(1).max(100).default(DEFAULT_BATCH_SIZE),
});

export type FacebookSavedCapture = z.infer<typeof facebookSavedCaptureSchema>;
export type SyncFacebookSavedCaptureInput = {
	canonicalFilePath?: string;
	capture: FacebookSavedCapture;
	dryRun?: boolean;
	batchSize?: number;
};

type FacebookSavedExport = {
	exportedAt?: string;
	source?: {
		type?: string;
		url?: string;
		title?: string | null;
	};
	count?: number;
	items: FacebookSavedItem[];
	validation?: {
		errors?: string[];
	};
	lastSync?: {
		completedAt: string;
		stopReason: "known_boundary" | "natural_end";
		scannedCount: number;
		newCount: number;
		importedCount: number;
		existingCount: number;
		invalidCount: number;
	};
};

type FacebookSavedImportResult = {
	status: "imported" | "existing" | "invalid";
	blogId: number | null;
};

function getDefaultCanonicalFilePath() {
	const configured = process.env.FACEBOOK_SAVED_EXPORT_PATH?.trim();
	if (configured) return resolve(configured);

	const fromCurrentDirectory = resolve(
		process.cwd(),
		"exports/facebook-saved.json",
	);
	if (existsSync(fromCurrentDirectory)) return fromCurrentDirectory;

	return resolve(process.cwd(), "../../exports/facebook-saved.json");
}

async function readCanonicalExport(filePath: string) {
	const payload = JSON.parse(
		await readFile(filePath, "utf8"),
	) as FacebookSavedExport;
	if (!Array.isArray(payload.items)) {
		throw new Error("Facebook saved export must contain an items array.");
	}
	return payload;
}

function hashValue(value: string) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).slice(0, 10);
}

function slugifyChannel(value: string) {
	const ascii = value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return ascii || `collection-${hashValue(value)}`;
}

function getCollectionName(item: FacebookSavedItem) {
	return (
		normalizeFacebookSavedText(item.collection) || UNCATEGORIZED_COLLECTION
	);
}

function getSourceId(item: FacebookSavedItem) {
	return canonicalizeFacebookSavedUrl(item.url || item.link || "");
}

function extractHashTags(content: string) {
	return [...(content.match(/#([\p{L}\p{N}_\u0600-\u06FF]+)/gu) ?? [])].map(
		(tag) => tag.slice(1),
	);
}

function uniqueTags(values: Array<string | undefined>) {
	return Array.from(
		new Set(
			values
				.map((value) => normalizeFacebookSavedText(value))
				.map((value) => (value.startsWith("#") ? value.slice(1) : value))
				.filter(Boolean),
		),
	).slice(0, 20);
}

function buildBlogContent(item: FacebookSavedItem) {
	const normalized = normalizeFacebookSavedItem(item);
	const parts = [normalized.title, normalized.caption, normalized.url].filter(
		Boolean,
	);
	return Array.from(new Set(parts)).join("\n\n").trim();
}

function buildBlogMeta(item: FacebookSavedItem, collection: string) {
	const normalized = normalizeFacebookSavedItem(item);
	return {
		title: normalized.title || null,
		facebook: {
			url: normalized.url,
			avatar: normalized.avatar || null,
			collection,
			link: normalized.link,
			caption: normalized.caption || null,
			mediaDownload: {
				images: "auto",
				video: "manual",
				videoStatus: "not_requested",
			},
		},
	};
}

async function importFacebookSavedBatch(
	tx: Prisma.TransactionClient,
	batch: FacebookSavedItem[],
): Promise<FacebookSavedImportResult[]> {
	const prepared = batch
		.map((item) => {
			const normalized = normalizeFacebookSavedItem(item);
			const sourceId = getSourceId(normalized);
			if (!sourceId) return null;
			return {
				item: normalized,
				sourceId,
				sourceUrl: sourceId,
				collection: getCollectionName(normalized),
			};
		})
		.filter(Boolean) as Array<{
		item: FacebookSavedItem;
		sourceId: string;
		sourceUrl: string;
		collection: string;
	}>;

	const sourceIds = prepared.map((entry) => entry.sourceId);
	const existingBlogs = sourceIds.length
		? await tx.blog.findMany({
				where: { source: FACEBOOK_SOURCE, sourceId: { in: sourceIds } },
				select: { id: true, sourceId: true },
			})
		: [];
	const existingBySourceId = new Map<string, number>(
		existingBlogs.flatMap((blog) =>
			blog.sourceId ? ([[blog.sourceId, blog.id]] as const) : [],
		),
	);

	const channelByCollection = new Map<string, { id: number }>();
	for (const collection of new Set(prepared.map((entry) => entry.collection))) {
		const slug = slugifyChannel(collection);
		const channel = await tx.channel.upsert({
			where: { username: `facebook-saved-${slug}` },
			create: {
				username: `facebook-saved-${slug}`,
				title: collection,
				isFetchable: false,
				meta: {
					source: FACEBOOK_SOURCE,
					facebookSavedCollection: { name: collection, slug },
				},
			},
			update: {
				title: collection,
				meta: {
					source: FACEBOOK_SOURCE,
					facebookSavedCollection: { name: collection, slug },
				},
			},
		});
		channelByCollection.set(collection, channel);
	}

	const now = new Date();
	const newEntries = prepared.filter(
		(entry) => !existingBySourceId.has(entry.sourceId),
	);
	if (newEntries.length) {
		await tx.blog.createMany({
			data: newEntries.map((entry) => ({
				content: buildBlogContent(entry.item),
				type: "text",
				published: true,
				publishedAt: now,
				blogDate: now,
				status: "published",
				channelId: channelByCollection.get(entry.collection)?.id,
				source: FACEBOOK_SOURCE,
				sourceId: entry.sourceId,
				sourceUrl: entry.sourceUrl,
				sourceSyncedAt: now,
				meta: buildBlogMeta(entry.item, entry.collection),
			})),
			skipDuplicates: true,
		});
	}

	const allBlogs = sourceIds.length
		? await tx.blog.findMany({
				where: { source: FACEBOOK_SOURCE, sourceId: { in: sourceIds } },
				select: { id: true, sourceId: true },
			})
		: [];
	const blogBySourceId = new Map<string, number>(
		allBlogs.flatMap((blog) =>
			blog.sourceId ? ([[blog.sourceId, blog.id]] as const) : [],
		),
	);

	const newBlogEntries = newEntries
		.map((entry) => ({ ...entry, blogId: blogBySourceId.get(entry.sourceId) }))
		.filter((entry) => entry.blogId != null) as Array<
		(typeof newEntries)[number] & { blogId: number }
	>;
	const tagTitles = uniqueTags(
		newBlogEntries.flatMap((entry) => [
			FACEBOOK_SOURCE,
			"saved",
			entry.collection,
			...extractHashTags(
				`${entry.item.title ?? ""}\n${entry.item.caption ?? ""}`,
			),
		]),
	);
	const tagIdByTitle = new Map<string, number>();
	if (tagTitles.length) {
		await tx.tags.createMany({
			data: tagTitles.map((title) => ({ title })),
			skipDuplicates: true,
		});
		const tags = await tx.tags.findMany({
			where: { title: { in: tagTitles } },
			select: { id: true, title: true },
		});
		for (const tag of tags) tagIdByTitle.set(tag.title, tag.id);

		const blogTagRows = newBlogEntries.flatMap((entry) =>
			uniqueTags([
				FACEBOOK_SOURCE,
				"saved",
				entry.collection,
				...extractHashTags(
					`${entry.item.title ?? ""}\n${entry.item.caption ?? ""}`,
				),
			]).flatMap((title) => {
				const tagId = tagIdByTitle.get(title);
				return tagId ? [{ blogId: entry.blogId, tagId }] : [];
			}),
		);
		if (blogTagRows.length) {
			await tx.blogTags.createMany({
				data: blogTagRows,
				skipDuplicates: true,
			});
		}
	}

	return batch.map((item) => {
		const sourceId = getSourceId(item);
		if (!sourceId) return { status: "invalid", blogId: null };
		const blogId = blogBySourceId.get(sourceId) ?? null;
		if (!blogId) return { status: "invalid", blogId: null };
		return {
			status: existingBySourceId.has(sourceId) ? "existing" : "imported",
			blogId,
		};
	});
}

export async function importFacebookSavedItems(
	db: Database,
	items: FacebookSavedItem[],
	options?: { batchSize?: number },
) {
	const batchSize = Math.min(
		100,
		Math.max(1, options?.batchSize ?? DEFAULT_BATCH_SIZE),
	);
	const results: FacebookSavedImportResult[] = [];
	for (let offset = 0; offset < items.length; offset += batchSize) {
		const batch = items.slice(offset, offset + batchSize);
		const batchResults = await db.$transaction(
			(tx) => importFacebookSavedBatch(tx, batch),
			{ timeout: 60_000, maxWait: 10_000 },
		);
		results.push(...batchResults);
	}
	return results;
}

async function writeCanonicalExport(
	filePath: string,
	payload: FacebookSavedExport,
) {
	const temporaryPath = `${filePath}.tmp`;
	await writeFile(
		temporaryPath,
		`${JSON.stringify(payload, null, 2)}\n`,
		"utf8",
	);
	await rename(temporaryPath, filePath);
}

export async function getFacebookSavedSyncState(input?: {
	canonicalFilePath?: string;
}) {
	const canonicalFilePath =
		input?.canonicalFilePath ?? getDefaultCanonicalFilePath();
	const payload = await readCanonicalExport(canonicalFilePath);
	const knownIdentities = Array.from(
		new Set(
			payload.items
				.map((item) => getFacebookSavedIdentity(item.url || item.link))
				.filter(Boolean),
		),
	);
	return {
		count: payload.items.length,
		knownIdentities,
		exportedAt: payload.exportedAt ?? null,
		lastSync: payload.lastSync ?? null,
	};
}

export async function syncFacebookSavedCapture(
	db: Database,
	input: SyncFacebookSavedCaptureInput,
) {
	const parsedCapture = facebookSavedCaptureSchema.parse(input.capture);
	if (!parsedCapture.capture.complete) {
		throw new Error(
			`Facebook saved capture is incomplete (${parsedCapture.capture.stopReason}).`,
		);
	}
	if (
		!["known_boundary", "natural_end"].includes(
			parsedCapture.capture.stopReason,
		)
	) {
		throw new Error(
			`Facebook saved capture cannot be committed (${parsedCapture.capture.stopReason}).`,
		);
	}
	const committedStopReason =
		parsedCapture.capture.stopReason === "natural_end"
			? ("natural_end" as const)
			: ("known_boundary" as const);
	if (parsedCapture.validation.errors.length) {
		throw new Error(
			`Facebook saved capture failed validation: ${parsedCapture.validation.errors.join(
				"; ",
			)}`,
		);
	}
	if (
		parsedCapture.capture.scannedCount !==
			parsedCapture.capture.knownCount + parsedCapture.capture.newCount ||
		parsedCapture.capture.newCount !== parsedCapture.items.length
	) {
		throw new Error("Facebook saved capture counts are inconsistent.");
	}
	if (
		parsedCapture.capture.stopReason === "known_boundary" &&
		(parsedCapture.capture.knownCount <
			parsedCapture.capture.boundaryThreshold ||
			parsedCapture.capture.consecutiveKnownCount <
				parsedCapture.capture.boundaryThreshold)
	) {
		throw new Error(
			"Facebook saved capture has no verified known-post boundary.",
		);
	}
	if (
		parsedCapture.capture.stopReason === "natural_end" &&
		(!parsedCapture.capture.atEnd || parsedCapture.capture.noGrowthPasses < 8)
	) {
		throw new Error("Facebook saved capture has no verified natural end.");
	}

	const canonicalFilePath =
		input.canonicalFilePath ?? getDefaultCanonicalFilePath();
	const batchSize = Math.min(
		100,
		Math.max(1, input.batchSize ?? DEFAULT_BATCH_SIZE),
	);
	const canonical = await readCanonicalExport(canonicalFilePath);
	if (
		parsedCapture.capture.stopReason === "natural_end" &&
		canonical.items.length > 0 &&
		parsedCapture.capture.knownCount === 0
	) {
		throw new Error(
			"Facebook saved capture reached the end without overlapping the existing export.",
		);
	}
	const merged = mergeFacebookSavedExports(canonical, parsedCapture.items);

	if (input.dryRun || merged.newItems.length === 0) {
		return {
			ok: true,
			dryRun: Boolean(input.dryRun),
			scanned: parsedCapture.capture.scannedCount,
			capturedNew: merged.newItems.length,
			imported: 0,
			existing: parsedCapture.items.length - merged.newItems.length,
			invalid: 0,
			jsonUpdated: false,
			stopReason: parsedCapture.capture.stopReason,
		};
	}

	let imported = 0;
	let existing = 0;
	let invalid = 0;
	const results = await importFacebookSavedItems(db, merged.newItems, {
		batchSize,
	});
	for (const [index, result] of results.entries()) {
		const item = merged.payload.items[index];
		if (result.status === "imported") imported += 1;
		if (result.status === "existing") existing += 1;
		if (result.status === "invalid") invalid += 1;
		if (item && result.blogId != null) item.blogId = result.blogId;
	}

	merged.payload.lastSync = {
		completedAt: new Date().toISOString(),
		stopReason: committedStopReason,
		scannedCount: parsedCapture.capture.scannedCount,
		newCount: merged.newItems.length,
		importedCount: imported,
		existingCount: existing,
		invalidCount: invalid,
	};
	merged.payload.count = merged.payload.items.length;
	await writeCanonicalExport(canonicalFilePath, merged.payload);

	return {
		ok: true,
		dryRun: false,
		scanned: parsedCapture.capture.scannedCount,
		capturedNew: merged.newItems.length,
		imported,
		existing,
		invalid,
		jsonUpdated: true,
		stopReason: parsedCapture.capture.stopReason,
	};
}
