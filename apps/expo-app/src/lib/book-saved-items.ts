export type SavedPageSummary = {
	pageId: number;
	bookId: number;
	sourcePageNo: number | null;
	pageNo: number | null;
	preview: string;
};

export function savedTextPreview(text: string | null | undefined) {
	return (text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
}

export function sortSavedItems<
	T extends {
		pageId: number;
		pageNo?: number | null;
		sourcePageNo?: number | null;
		startOffset?: number | null;
	},
>(items: T[]): T[] {
	return [...items].sort(
		(a, b) =>
			(a.sourcePageNo ?? a.pageNo ?? Number.MAX_SAFE_INTEGER) -
				(b.sourcePageNo ?? b.pageNo ?? Number.MAX_SAFE_INTEGER) ||
			a.pageId - b.pageId ||
			(a.startOffset ?? 0) - (b.startOffset ?? 0),
	);
}
