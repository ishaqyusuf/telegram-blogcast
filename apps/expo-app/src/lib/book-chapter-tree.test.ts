import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { extractShamelaTocTree } from "@acme/document/book";
import { buildChapterRows, type ChapterNode } from "./book-chapter-tree";

const nodes: ChapterNode[] = [
	{ id: 4, parentId: 2, title: "عُمُر إسماعيل", sourcePageNo: 28, sortOrder: 1 },
	{
		id: 3,
		parentId: 2,
		title: "أولاد إسماعيل",
		sourcePageNo: 27,
		sortOrder: 0,
	},
	{ id: 1, parentId: null, title: "مقدمة", sourcePageNo: 2, sortOrder: 0 },
	{ id: 2, parentId: null, title: "النسب", sourcePageNo: 24, sortOrder: 1 },
	{ id: 5, parentId: 3, title: "فرع", sourcePageNo: 27, sortOrder: 0 },
];
test("all chapters are expanded by default in stable parent-first order", () => {
	const rows = buildChapterRows(nodes);
	expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 5, 4]);
	expect(rows.map((r) => r.depth)).toEqual([0, 0, 1, 2, 1]);
	expect(rows.find((r) => r.id === 5)?.ancestorIds).toEqual([2, 3]);
});
test("collapse is local and reopening retains nested collapse choices", () => {
	expect(buildChapterRows(nodes, new Set([2, 3])).map((r) => r.id)).toEqual([
		1, 2,
	]);
	expect(buildChapterRows(nodes, new Set([3])).map((r) => r.id)).toEqual([
		1, 2, 3, 4,
	]);
});
test("search retains ancestors and reveals matches inside collapsed branches", () => {
	expect(buildChapterRows(nodes, new Set([2]), "عمر").map((r) => r.id)).toEqual(
		[2, 4],
	);
	expect(buildChapterRows(nodes, new Set(), "27").map((r) => r.id)).toEqual([
		2, 3, 5,
	]);
	expect(buildChapterRows(nodes, new Set(), "٢٨").map((r) => r.id)).toEqual([
		2, 4,
	]);
	expect(buildChapterRows(nodes, new Set(), "missing")).toEqual([]);
});
test("missing parents and malformed cycles cannot hide rows or loop forever", () => {
	const broken = [
		{ ...nodes[0]!, parentId: 99 },
		{ ...nodes[1]!, parentId: 5 },
		{ ...nodes[4]!, parentId: 3 },
	];
	const rows = buildChapterRows(broken);
	expect(rows.length).toBe(3);
	expect(new Set(rows.map((r) => r.id)).size).toBe(3);
});

test("retained 2405-node Shamela tree preserves hierarchy, search ancestors and collapse counts", async () => {
	const html = await readFile(
		fileURLToPath(
			new URL(
				"../../../../packages/document/src/book/fixtures/shamela-23833-betaka-index.html",
				import.meta.url,
			),
		),
		"utf8",
	);
	const toc = extractShamelaTocTree(html);
	expect(toc.complete).toBe(true);
	const expected: Array<
		ChapterNode & {
			depth: number;
			ancestorIds: number[];
			childCount: number;
		}
	> = [];
	const flatten = (children: typeof toc.nodes, ancestorIds: number[]) => {
		for (const node of children) {
			const id = expected.length + 1;
			expected.push({
				id,
				parentId: ancestorIds.at(-1) ?? null,
				title: node.title,
				sourcePageNo: node.shamelaPageNo,
				sortOrder: node.sortOrder,
				depth: ancestorIds.length,
				ancestorIds: [...ancestorIds],
				childCount: node.children.length,
			});
			flatten(node.children, [...ancestorIds, id]);
		}
	};
	flatten(toc.nodes, []);
	expect(expected).toHaveLength(2405);
	// The API need not supply preorder: exercise sibling sorting and parent reconstruction.
	const input: ChapterNode[] = expected
		.map(({ depth, ancestorIds, childCount, ...node }) => node)
		.reverse();
	const rows = buildChapterRows(input);
	expect(rows).toHaveLength(2405);
	expect(new Set(rows.map((row) => row.id)).size).toBe(2405);
	expect(rows).toEqual(expected);
	const roots = expected.filter((row) => row.parentId === null);
	expect(roots).toHaveLength(222);
	const collapsedRoots = new Set(roots.map((row) => row.id));
	expect(buildChapterRows(input, collapsedRoots)).toEqual(roots);

	const branch = roots.find((root) =>
		expected.some((row) => row.ancestorIds.includes(root.id) && row.depth > 1),
	);
	expect(branch).toBeDefined();
	const descendants = expected.filter((row) =>
		row.ancestorIds.includes(branch!.id),
	);
	const collapsed = buildChapterRows(input, new Set([branch!.id]));
	expect(collapsed).toHaveLength(2405 - descendants.length);
	expect(collapsed).toEqual(
		expected.filter((row) => !row.ancestorIds.includes(branch!.id)),
	);
	expect(buildChapterRows(input)).toEqual(expected);

	const matching = expected.filter(
		(row) =>
			row.sourcePageNo === 106 ||
			row.title
				.normalize("NFKD")
				.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
				.includes("106"),
	);
	expect(matching.length).toBeGreaterThan(0);
	expect(matching.some((row) => row.ancestorIds.length > 0)).toBe(true);
	const visibleIds = new Set(
		matching.flatMap((row) => [...row.ancestorIds, row.id]),
	);
	const searched = buildChapterRows(input, collapsedRoots, "106");
	expect(searched).toEqual(expected.filter((row) => visibleIds.has(row.id)));
	expect(
		searched.some((row) => !matching.some((match) => match.id === row.id)),
	).toBe(true);
});
