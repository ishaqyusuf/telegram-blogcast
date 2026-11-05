import type { QueryClient, QueryKey } from "@tanstack/react-query";

type RecordValue = Record<string, any>;
const routes = new Set([
	"album.getAlbum",
	"album.getAlbumTracks",
	"album.getAlbumPlaybackQueue",
	"blog.getBlog",
	"blog.posts",
	"blog.search",
	"podcasts.posts",
]);
function routeOf(key: QueryKey) {
	return Array.isArray(key[0]) ? key[0].join(".") : "";
}

export function patchAudioTitleData(
	data: any,
	route: string,
	mediaId: number,
	titleOverride: string | null,
): any {
	if (!data) return data;
	const patchMedia = (media: RecordValue) =>
		media?.id === mediaId ? { ...media, titleOverride } : media;
	const patchPost = (post: RecordValue) => ({
		...post,
		...(post.audio?.mediaId === mediaId
			? { audio: { ...post.audio, titleOverride } }
			: {}),
		...(Array.isArray(post.medias)
			? { medias: post.medias.map(patchMedia) }
			: {}),
		...(Array.isArray(post.media) ? { media: post.media.map(patchMedia) } : {}),
	});
	if (route === "album.getAlbum" || route === "blog.getBlog")
		return patchPost(data);
	if (route === "album.getAlbumPlaybackQueue") return data.map(patchMedia);
	const patchPage = (page: RecordValue) => ({
		...page,
		data: page.data?.map(
			route === "album.getAlbumTracks" ? patchMedia : patchPost,
		),
	});
	return data.pages
		? { ...data, pages: data.pages.map(patchPage) }
		: patchPage(data);
}

/** Apply a successful server write before closing the editor; stale requests cannot undo it. */
export async function reconcileAudioTitle(
	client: QueryClient,
	mediaId: number,
	titleOverride: string | null,
) {
	const filters = {
		predicate: (query: { queryKey: QueryKey }) =>
			routes.has(routeOf(query.queryKey)),
	};
	await client.cancelQueries(filters);
	for (const query of client.getQueryCache().findAll(filters)) {
		client.setQueryData(query.queryKey, (old: unknown) =>
			patchAudioTitleData(old, routeOf(query.queryKey), mediaId, titleOverride),
		);
	}
	// Refresh search membership and server metadata without holding the editor open.
	void client.invalidateQueries(filters).catch(() => undefined);
}
