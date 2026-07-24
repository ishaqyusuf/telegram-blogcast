import {
	BLOG_CONTENT_TYPES,
	type BlogContentType,
	inferBlogMediaContentType,
} from "@acme/blog";
import type { Prisma } from "@acme/db";
import { z } from "zod";

export const CHANNEL_CONTENT_TYPES = BLOG_CONTENT_TYPES;

export type ChannelContentType = BlogContentType;

export const channelContentTypeSchema = z.enum(CHANNEL_CONTENT_TYPES);

const enabledContentFilterSchema = z.object({
	channelId: z.number().int().positive(),
	enabled: z.literal(true),
	types: z
		.array(channelContentTypeSchema)
		.min(1)
		.max(CHANNEL_CONTENT_TYPES.length)
		.refine((types) => new Set(types).size === types.length, {
			message: "Content filter types must be unique.",
		}),
});

export const channelContentFilterInputSchema = z.discriminatedUnion("enabled", [
	enabledContentFilterSchema,
	z.object({
		channelId: z.number().int().positive(),
		enabled: z.literal(false),
	}),
]);

export type ChannelContentFilterInput = z.infer<
	typeof channelContentFilterInputSchema
>;

type ContentFilterConfig = {
	enabled: boolean;
	types: readonly string[];
};

type ContentFilterBlog = {
	type?: string | null;
	telegramMessageId?: number | null;
	medias?: Array<{
		mimeType?: string | null;
		title?: string | null;
		file?: {
			mimeType?: string | null;
			fileName?: string | null;
			blobContentType?: string | null;
			blobPathname?: string | null;
		} | null;
	}>;
};

export function getEffectiveChannelContentType(
	blog: ContentFilterBlog,
): ChannelContentType {
	const storedType = blog.type?.toLowerCase();
	const inferredMediaTypes = blog.medias?.map(inferBlogMediaContentType) ?? [];
	const isLegacyTelegramText =
		blog.telegramMessageId != null &&
		(storedType === "text" || storedType === "document");

	if (
		storedType === "pdf" ||
		(isLegacyTelegramText && inferredMediaTypes.includes("pdf"))
	) {
		return "pdf";
	}
	if (
		storedType === "video" ||
		(isLegacyTelegramText && inferredMediaTypes.includes("video"))
	) {
		return "video";
	}
	if (storedType === "audio") return "audio";
	if (storedType === "image") return "image";
	return "text";
}

export function isBlogAllowedByChannelContentFilter(
	config: ContentFilterConfig | undefined,
	blog: ContentFilterBlog,
) {
	if (!config?.enabled || config.types.length === 0) return true;
	return config.types.includes(getEffectiveChannelContentType(blog));
}

export function getContentFilterUpdateData(input: ChannelContentFilterInput): {
	contentFilterEnabled: boolean;
	contentFilterTypes?: ChannelContentType[];
} {
	if (!input.enabled) return { contentFilterEnabled: false };

	return {
		contentFilterEnabled: true,
		contentFilterTypes: CHANNEL_CONTENT_TYPES.filter((type) =>
			input.types.includes(type),
		),
	};
}

export const pdfBlogMediaWhere = {
	medias: {
		some: {
			OR: [
				{ mimeType: { equals: "application/pdf", mode: "insensitive" } },
				{ mimeType: { startsWith: "document/", mode: "insensitive" } },
				{ title: { endsWith: ".pdf", mode: "insensitive" } },
				{
					file: {
						mimeType: { equals: "application/pdf", mode: "insensitive" },
					},
				},
				{
					file: {
						blobContentType: {
							equals: "application/pdf",
							mode: "insensitive",
						},
					},
				},
				{ file: { fileName: { endsWith: ".pdf", mode: "insensitive" } } },
				{ file: { blobPathname: { endsWith: ".pdf", mode: "insensitive" } } },
			],
		},
	},
} satisfies Prisma.BlogWhereInput;

export const videoBlogMediaWhere = {
	medias: {
		some: {
			OR: [
				{ mimeType: { startsWith: "video/", mode: "insensitive" } },
				{
					file: {
						mimeType: { startsWith: "video/", mode: "insensitive" },
					},
				},
				{
					file: {
						blobContentType: {
							startsWith: "video/",
							mode: "insensitive",
						},
					},
				},
			],
		},
	},
} satisfies Prisma.BlogWhereInput;

const legacyTelegramMediaWhere = {
	telegramMessageId: { not: null },
	type: { in: ["text", "document"] },
} satisfies Prisma.BlogWhereInput;

export function getBlogContentTypeWhere(
	type: ChannelContentType,
): Prisma.BlogWhereInput {
	if (type === "pdf") {
		return {
			OR: [
				{ type: "pdf" },
				{ AND: [legacyTelegramMediaWhere, pdfBlogMediaWhere] },
			],
		};
	}

	if (type === "video") {
		return {
			OR: [
				{ type: "video" },
				{ AND: [legacyTelegramMediaWhere, videoBlogMediaWhere] },
			],
		};
	}

	if (type === "text") {
		return {
			OR: [
				{
					AND: [
						{ type: "text" },
						{
							NOT: {
								AND: [
									{ telegramMessageId: { not: null } },
									{ OR: [pdfBlogMediaWhere, videoBlogMediaWhere] },
								],
							},
						},
					],
				},
				{
					AND: [
						{ type: "document" },
						{
							NOT: {
								OR: [pdfBlogMediaWhere, videoBlogMediaWhere],
							},
						},
					],
				},
			],
		};
	}

	return { type };
}

export const channelContentVisibilityWhere = {
	OR: [
		{ channelId: null },
		{
			channel: {
				is: {
					OR: [
						{ contentFilterEnabled: false },
						{ contentFilterTypes: { isEmpty: true } },
					],
				},
			},
		},
		...CHANNEL_CONTENT_TYPES.map((type) => ({
			AND: [
				getBlogContentTypeWhere(type),
				{
					channel: {
						is: {
							contentFilterEnabled: true,
							contentFilterTypes: { has: type },
						},
					},
				},
			],
		})),
	],
} satisfies Prisma.BlogWhereInput;
