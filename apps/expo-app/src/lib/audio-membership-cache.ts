import { reconcileSearchMembership } from "./search-membership";
import type { QueryClient } from "@tanstack/react-query";
import { _trpc } from "@/components/static-trpc";
import type { SearchPage } from "./search-results";
import { updateBlogPostByMediaIdInCache } from "./blog-post-cache";

// Patch successful writes immediately, then reconcile only audio-related queries.
// Filtered pages must lose moved tracks before the background request finishes.
export async function reconcileAudioMembership(
	client: QueryClient,
	mediaIds: number[],
	album: { id: number; name: string } | null,
) {
	const ids = new Set(mediaIds);
	await client.cancelQueries({
		queryKey: _trpc.blog.search.infiniteQueryKey(),
	});
	for (const query of client
		.getQueryCache()
		.findAll({ queryKey: _trpc.blog.search.infiniteQueryKey() })) {
		const membership = (
			query.queryKey[1] as { input?: { album?: "in" | "not" } } | undefined
		)?.input?.album;
		client.setQueryData(
			query.queryKey,
			(old: { pages: SearchPage[] } | undefined) => {
				if (!old?.pages) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						data: reconcileSearchMembership(page.data, ids, album, membership),
					})),
				};
			},
		);
	}
	mediaIds.forEach((id) =>
		updateBlogPostByMediaIdInCache(id, (post) => ({
			...post,
			audio: post.audio
				? { ...post.audio, albumId: album?.id ?? null, albumName: album?.name }
				: post.audio,
		})),
	);
	void invalidateAudioQueries(client);
}

export function invalidateAudioQueries(client: QueryClient) {
	return client.invalidateQueries({
		predicate: (query) => {
			const path = query.queryKey[0];
			if (!Array.isArray(path)) return false;
			return (
				path[0] === "album" ||
				(path[0] === "blog" &&
					["search", "searchFacets", "posts", "getBlog"].includes(path[1]))
			);
		},
	});
}
