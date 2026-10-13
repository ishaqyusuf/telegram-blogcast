type ParagraphAnchor = { id: number; pid: number; text: string };

type AnnotationDb = {
	bookPageHighlight: {
		findMany(args: { where: { pageId: number } }): Promise<AnchoredAnnotation[]>;
		update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<unknown>;
	};
	bookPageComment: {
		findMany(args: { where: { pageId: number; deletedAt: null } }): Promise<AnchoredAnnotation[]>;
		update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<unknown>;
	};
};

type AnchoredAnnotation = {
	id: number;
	paragraphId: number | null;
	paragraphPid: number | null;
	quoteText: string | null;
	pageShamelaPageNo: number | null;
};

/**
 * Re-points page highlights/comments after paragraph rows are replaced. Matching is by
 * paragraph number, then previous text, then quoted text; unresolved annotations keep
 * their pid/quote so they remain recoverable instead of being deleted.
 */
export async function rebindPageAnnotations(
	db: AnnotationDb,
	pageId: number,
	previousParagraphs: ParagraphAnchor[],
	nextParagraphs: ParagraphAnchor[],
) {
	const nextByPid = new Map(nextParagraphs.map((paragraph) => [paragraph.pid, paragraph]));
	const nextByText = new Map(
		nextParagraphs.map((paragraph) => [paragraph.text.trim(), paragraph]),
	);
	const previousById = new Map(previousParagraphs.map((paragraph) => [paragraph.id, paragraph]));

	const rebindParagraph = (annotation: AnchoredAnnotation) => {
		if (annotation.paragraphPid != null && nextByPid.has(annotation.paragraphPid))
			return nextByPid.get(annotation.paragraphPid) ?? null;
		if (annotation.paragraphId != null) {
			const previous = previousById.get(annotation.paragraphId);
			if (previous && nextByPid.has(previous.pid)) return nextByPid.get(previous.pid) ?? null;
			if (previous && nextByText.has(previous.text.trim()))
				return nextByText.get(previous.text.trim()) ?? null;
		}
		if (annotation.quoteText && nextByText.has(annotation.quoteText.trim()))
			return nextByText.get(annotation.quoteText.trim()) ?? null;
		return null;
	};

	const rebindData = (annotation: AnchoredAnnotation) => {
		const target = rebindParagraph(annotation);
		return {
			paragraphId: target?.id ?? null,
			paragraphPid: target?.pid ?? annotation.paragraphPid ?? null,
			quoteText: target?.text ?? annotation.quoteText ?? null,
			pageShamelaPageNo: annotation.pageShamelaPageNo ?? undefined,
		};
	};

	for (const highlight of await db.bookPageHighlight.findMany({ where: { pageId } })) {
		await db.bookPageHighlight.update({ where: { id: highlight.id }, data: rebindData(highlight) });
	}
	for (const comment of await db.bookPageComment.findMany({ where: { pageId, deletedAt: null } })) {
		await db.bookPageComment.update({ where: { id: comment.id }, data: rebindData(comment) });
	}
}
