import type { Prisma } from "@acme/db";
export const visibleMainBlogWhere = {
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

export function buildBlogSearchWhere(q: string): Prisma.BlogWhereInput {
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
							{ titleOverride: { contains: term, mode: "insensitive" } },
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

export const audioSearchMediaWhere = {
	OR: [
		{ mimeType: { startsWith: "audio/", mode: "insensitive" } },
		{ file: { mimeType: { startsWith: "audio/", mode: "insensitive" } } },
	],
} satisfies Prisma.MediaWhereInput;

export function albumMembershipWhere(
	album?: "in" | "not",
): Prisma.MediaWhereInput {
	return {
		AND: [
			audioSearchMediaWhere,
			...(album ? [{ albumId: album === "in" ? { not: null } : null }] : []),
		],
	};
}
