export function shouldShowAudioBar(input: {
	pathname: string;
	hasAudio: boolean;
	activeBlogId?: number | null;
	activeMediaId?: number | null;
	viewedMediaId?: number | null;
	hidden: boolean;
	sheetOpen: boolean;
	scrollHidden: boolean;
	detailVisible: boolean;
}) {
	if (!input.hasAudio || input.hidden || input.sheetOpen) return false;
	if (/^\/(?:search|blog-search)(?:\/|$)/.test(input.pathname)) return false;
	const detail = input.pathname.match(/^\/blog-view-2\/([^/]+)/);
	if (detail) {
		const sameMedia =
			input.activeMediaId != null && input.viewedMediaId != null
				? input.activeMediaId === input.viewedMediaId
				: String(input.activeBlogId) === detail[1];
		if (sameMedia) return false;
		return input.detailVisible;
	}
	return !input.scrollHidden;
}
