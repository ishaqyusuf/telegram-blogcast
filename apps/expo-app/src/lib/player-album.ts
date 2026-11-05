export const ALBUM_QUERY_CACHE = {
	staleTime: 5 * 60 * 1000,
	gcTime: 30 * 60 * 1000,
};

/** Prefer the playing track only when it belongs to this album. */
export function getPlayerAlbumFocus(
	tracks: readonly { id: number }[],
	viewedMediaId: number,
	playingMediaId?: number | null,
) {
	return tracks.some((track) => track.id === playingMediaId)
		? playingMediaId!
		: viewedMediaId;
}

/** Album detail already contains the complete ordered list, including late tracks. */
export function getAlbumVisibleTracks<T>({
	localTracks,
	albumTracks,
	paginatedTracks,
	search,
}: {
	localTracks: T[] | null;
	albumTracks?: T[];
	paginatedTracks: T[];
	search: string;
}) {
	return (
		localTracks ??
		(!search.trim() && albumTracks ? albumTracks : paginatedTracks)
	);
}
