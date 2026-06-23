import { _qc, _trpc } from "@/components/static-trpc";
import type { BlogItem } from "@/components/blog-card/types";

type BlogPostUpdater = (post: BlogItem) => BlogItem;

function updateBlogPostsCache(
	match: (post: BlogItem) => boolean,
	update: BlogPostUpdater,
) {
	_qc.setQueriesData(
		{ queryKey: _trpc.blog.posts.infiniteQueryKey() },
		(old: any) => {
			if (!old?.pages) return old;

			let changed = false;
			const pages = old.pages.map((page: any) => {
				if (!Array.isArray(page?.data)) return page;

				let pageChanged = false;
				const data = page.data.map((post: BlogItem) => {
					if (!match(post)) return post;
					changed = true;
					pageChanged = true;
					return update(post);
				});

				return pageChanged ? { ...page, data } : page;
			});

			return changed ? { ...old, pages } : old;
		},
	);
}

export function updateBlogPostInCache(blogId: number, update: BlogPostUpdater) {
	updateBlogPostsCache((post) => post.id === blogId, update);
}

export function updateBlogPostByMediaIdInCache(
	mediaId: number,
	update: BlogPostUpdater,
) {
	updateBlogPostsCache((post) => post.audio?.mediaId === mediaId, update);
}
