import type { SearchResultItem } from "./search-results";

export function reconcileSearchMembership(
	posts: SearchResultItem[],
	ids: Set<number>,
	album: { id: number; name: string } | null,
	filter?: "in" | "not",
) {
	return posts.flatMap((post) => {
		if (!post.medias?.some((media) => media.id != null && ids.has(media.id)))
			return [post];
		let medias = post.medias.map((media) =>
			media.id != null && ids.has(media.id)
				? { ...media, albumId: album?.id ?? null, album }
				: media,
		);
		if (filter) {
			medias = medias.filter(
				(media) =>
					(media.mimeType || media.file?.mimeType || "")
						.toLowerCase()
						.startsWith("audio/") &&
					(filter === "in" ? media.albumId != null : media.albumId == null),
			);
			if (!medias.length) return [];
		}
		return [{ ...post, medias }];
	});
}
