export type ChapterNode = {
	id: number;
	parentId: number | null;
	title: string;
	sourcePageNo: number | null;
	sortOrder: number;
};
export type ChapterRow = ChapterNode & {
	depth: number;
	ancestorIds: number[];
	childCount: number;
};

function normalize(value: string) {
	return value
		.normalize("NFKD")
		.replace(/[\u064B-\u065F\u0670\u0640]/g, "")
		.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
		.toLocaleLowerCase()
		.trim();
}

export function buildChapterRows(
	nodes: ChapterNode[],
	collapsed: ReadonlySet<number> = new Set(),
	query = "",
): ChapterRow[] {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const children = new Map<number | null, ChapterNode[]>();
	for (const node of byId.values()) {
		const parent =
			node.parentId !== node.id && byId.has(node.parentId!)
				? node.parentId
				: null;
		const siblings = children.get(parent) ?? [];
		siblings.push(node);
		children.set(parent, siblings);
	}
	const order = (a: ChapterNode, b: ChapterNode) =>
		a.sortOrder - b.sortOrder || a.id - b.id;
	for (const siblings of children.values()) siblings.sort(order);
	const all: ChapterRow[] = [];
	const visited = new Set<number>();
	const walk = (root: ChapterNode) => {
		const stack = [{ node: root, ancestorIds: [] as number[] }];
		while (stack.length) {
			const { node, ancestorIds } = stack.pop()!;
			if (visited.has(node.id)) continue;
			visited.add(node.id);
			const descendants = children.get(node.id) ?? [];
			all.push({
				...node,
				ancestorIds,
				depth: ancestorIds.length,
				childCount: descendants.length,
			});
			for (let i = descendants.length - 1; i >= 0; i--) {
				stack.push({
					node: descendants[i]!,
					ancestorIds: [...ancestorIds, node.id],
				});
			}
		}
	};
	for (const root of children.get(null) ?? []) walk(root);
	// Legacy malformed relationships must not silently hide the remaining index.
	for (const node of [...byId.values()].sort(order))
		if (!visited.has(node.id)) walk(node);
	const term = normalize(query);
	if (term) {
		const visible = new Set<number>();
		for (const row of all)
			if (
				normalize(row.title).includes(term) ||
				String(row.sourcePageNo) === term
			) {
				visible.add(row.id);
				for (const ancestor of row.ancestorIds) visible.add(ancestor);
			}
		return all.filter((row) => visible.has(row.id));
	}
	return all.filter((row) => !row.ancestorIds.some((id) => collapsed.has(id)));
}
