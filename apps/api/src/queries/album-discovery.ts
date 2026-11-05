import type { Database, Prisma } from "@acme/db";
import { z } from "zod";

export const albumSearchInput = z.object({
	q: z.string().trim().max(500).default(""),
	channelIds: z.array(z.number().int().positive()).max(50).optional(),
	group: z.enum(["same", "other"]).optional(),
	cursor: z.number().int().positive().nullish(),
	limit: z.number().int().min(1).max(50).default(30),
});

export function albumSearchWhere(
	input: z.infer<typeof albumSearchInput>,
): Prisma.AlbumWhereInput {
	const ids = [...new Set(input.channelIds ?? [])];
	return {
		deletedAt: null,
		...(input.q ? { name: { contains: input.q, mode: "insensitive" } } : {}),
		...(input.group === "other"
			? { OR: [{ channelId: null }, { channelId: { notIn: ids } }] }
			: input.group === "same" || ids.length
				? { channelId: { in: ids } }
				: {}),
	};
}

export async function searchAlbums(
	db: Database,
	input: z.infer<typeof albumSearchInput>,
) {
	const rows = await db.album.findMany({
		where: albumSearchWhere(input),
		orderBy: { id: "desc" },
		take: input.limit + 1,
		...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
		select: {
			id: true,
			name: true,
			channelId: true,
			channel: { select: { id: true, title: true, username: true } },
			_count: { select: { medias: { where: { blog: { deletedAt: null } } } } },
		},
	});
	const data = rows.slice(0, input.limit);
	return {
		data,
		cursor: rows.length > input.limit ? data.at(-1)?.id : undefined,
	};
}
