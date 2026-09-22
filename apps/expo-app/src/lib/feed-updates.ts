type FeedItem = { id: number; audio?: { albumId?: number | null } | null };

export function uniqueFeedItems<T extends FeedItem>(items: T[]): T[] {
	const seenPosts = new Set<number>();
	return items.filter((item) => {
		if (seenPosts.has(item.id)) return false;
		seenPosts.add(item.id);
		return true;
	});
}

export function countFeedUpdates(current: FeedItem[], latest: FeedItem[]) {
	const knownIds = new Set(current.map((item) => item.id));
	const newGroups = new Set<string>();
	for (const item of latest) {
		if (!knownIds.has(item.id))
			newGroups.add(
				item.audio?.albumId ? `album:${item.audio.albumId}` : `post:${item.id}`,
			);
	}
	return newGroups.size;
}

export function mergeLatestFeedPage<
	T extends FeedItem,
	TPage extends { data: T[]; meta: unknown },
	TPageParam,
>(
	current: { pages: TPage[]; pageParams: TPageParam[] } | undefined,
	latest: TPage,
) {
	if (!current?.pages.length) {
		return { pages: [latest], pageParams: [null] };
	}
	const first = current.pages[0];
	return {
		...current,
		pages: [
			{
				...latest,
				data: uniqueFeedItems([...latest.data, ...first.data]),
				// The previous first-page cursor still follows every retained row.
				meta: first.meta,
			},
			...current.pages.slice(1),
		],
	};
}
