import { createHash } from "node:crypto";
import { Prisma, type Database } from "@acme/db";
import { extractShamelaTocTree } from "@acme/document/book";

export const CHAPTER_IMPORT_TASK = "import-shamela-chapters";
export const MAX_CHAPTER_HTML_BYTES = 3_000_000;

export type ChapterImportPayload = { importId: string; generation: number };

type CapturedNode = {
	sourceKey: string;
	parentKey: string | null;
	title: string;
	sourcePageNo: number | null;
	depth: number;
	sortOrder: number;
};

export function validateChapterCapture(html: string, shamelaBookId: number) {
	if (Buffer.byteLength(html, "utf8") > MAX_CHAPTER_HTML_BYTES) {
		throw new Error("The chapter capture exceeds the supported size limit.");
	}
	const toc = extractShamelaTocTree(html);
	if (!toc.complete) {
		throw new Error(
			"The chapter index is missing or incomplete. Load its branches and retry.",
		);
	}
	const nodes: CapturedNode[] = [];
	const seen = new Set<string>();
	const walk = (children: typeof toc.nodes, parentKey: string | null) => {
		for (const node of children) {
			if (nodes.length >= 20_000 || node.depth > 64) {
				throw new Error("The chapter tree exceeds the supported safety limit.");
			}
			const sourceKey = createHash("sha256")
				.update(node.treePath)
				.digest("hex");
			if (seen.has(sourceKey))
				throw new Error("The chapter index has duplicate identities.");
			seen.add(sourceKey);
			let sourcePageNo: number | null = null;
			if (!node.path && !node.url)
				throw new Error("A chapter navigation link is missing or malformed.");
			if (node.path || node.url) {
				const url = new URL(node.path || node.url!, "https://shamela.ws");
				const match = url.pathname.match(/^\/book\/(\d+)\/(\d+)\/?$/);
				if (
					url.protocol !== "https:" ||
					url.hostname !== "shamela.ws" ||
					!match ||
					Number(match[1]) !== shamelaBookId
				) {
					throw new Error(
						"A chapter link belongs to a different book or is invalid.",
					);
				}
				sourcePageNo = Number(match[2]);
				if (!Number.isSafeInteger(sourcePageNo) || sourcePageNo <= 0) {
					throw new Error("A chapter page number is invalid.");
				}
			}
			if (!node.title.trim()) throw new Error("A chapter title is missing.");
			nodes.push({
				sourceKey,
				parentKey,
				sourcePageNo,
				title: node.title,
				depth: node.depth,
				sortOrder: node.sortOrder,
			});
			walk(node.children, sourceKey);
		}
	};
	walk(toc.nodes, null);
	return nodes;
}

export async function importBookChapters(
	db: Database,
	payload: ChapterImportPayload,
) {
	const job = await db.bookChapterImport.findUniqueOrThrow({
		where: { id: payload.importId },
		include: { book: true },
	});
	if (
		job.generation !== payload.generation ||
		["complete", "cancelled"].includes(job.status)
	) {
		return { skipped: true };
	}
	if (!job.book.shamelaId || job.book.deletedAt)
		throw new Error("The source book is unavailable.");
	await db.bookChapterImport.updateMany({
		where: {
			id: job.id,
			generation: payload.generation,
			status: { in: ["queued", "running"] },
		},
		data: { status: "running", errorMessage: null },
	});
	const nodes = validateChapterCapture(job.rawHtml, job.book.shamelaId);

	return db.$transaction(
		async (tx) => {
			// Serializes imports for a book. Readers keep seeing the previous committed tree.
			await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${job.bookId} FOR UPDATE`;
			const current = await tx.bookChapterImport.findUniqueOrThrow({
				where: { id: job.id },
			});
			if (
				current.generation !== payload.generation ||
				["complete", "cancelled"].includes(current.status)
			) {
				return { skipped: true };
			}
			const newer = await tx.bookChapterImport.findFirst({
				where: {
					bookId: job.bookId,
					createdAt: { gt: job.createdAt },
					status: "complete",
				},
				select: { id: true },
			});
			if (newer) {
				await tx.bookChapterImport.update({
					where: { id: job.id },
					data: {
						status: "cancelled",
						errorMessage: "A newer chapter capture has already completed.",
					},
				});
				return { skipped: true };
			}
			const pages = await tx.bookPage.findMany({
				where: { bookId: job.bookId, deletedAt: null },
				select: { id: true, shamelaPageNo: true },
			});
			const pageIds = new Map(
				pages.map((page) => [page.shamelaPageNo, page.id]),
			);
			const batchSize = 500;
			for (let offset = 0; offset < nodes.length; offset += batchSize) {
				const rows = nodes.slice(offset, offset + batchSize).map((node) => ({
					key: node.sourceKey,
					title: node.title,
					pageNo: node.sourcePageNo,
					pageId:
						node.sourcePageNo == null
							? null
							: (pageIds.get(node.sourcePageNo) ?? null),
					depth: node.depth,
					sortOrder: node.sortOrder,
				}));
				await tx.$executeRaw(Prisma.sql`
        INSERT INTO "BookTocNode" ("bookId", "pageId", "kind", "title", "shamelaPageNo", "depth", "sortOrder", "treePath", "updatedAt")
        SELECT ${job.bookId}, "pageId", CASE WHEN depth = 0 THEN 'chapter' ELSE 'topic' END,
          title, "pageNo", depth, "sortOrder", key, NOW()
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          AS n(key text, title text, "pageNo" int, "pageId" int, depth int, "sortOrder" int)
        ON CONFLICT ("bookId", "treePath") DO UPDATE SET
          "pageId" = EXCLUDED."pageId", title = EXCLUDED.title,
          "shamelaPageNo" = EXCLUDED."shamelaPageNo", depth = EXCLUDED.depth,
          "sortOrder" = EXCLUDED."sortOrder", "deletedAt" = NULL, "updatedAt" = NOW(),
          "shamelaPath" = NULL, "metadataJson" = NULL, "isCurrent" = FALSE
      `);
			}
			// Parent keys exist only in this transient join payload, never in metadata JSON.
			await tx.$executeRaw(Prisma.sql`
      UPDATE "BookTocNode" AS child SET "parentId" = parent.id
      FROM jsonb_to_recordset(${JSON.stringify(nodes.map((n) => ({ key: n.sourceKey, parent: n.parentKey })))}::jsonb)
        AS edge(key text, parent text)
      LEFT JOIN "BookTocNode" AS parent ON parent."bookId" = ${job.bookId} AND parent."treePath" = edge.parent
      WHERE child."bookId" = ${job.bookId} AND child."treePath" = edge.key
    `);
			await tx.bookTocNode.updateMany({
				where: {
					bookId: job.bookId,
					deletedAt: null,
					treePath: { notIn: nodes.map((n) => n.sourceKey) },
				},
				data: { deletedAt: new Date() },
			});
			await tx.book.update({
				where: { id: job.bookId },
				data: { tocStatus: "complete", tocCapturedAt: new Date() },
			});
			const published = await tx.bookChapterImport.updateMany({
				where: {
					id: job.id,
					generation: payload.generation,
					status: "running",
				},
				data: {
					status: "complete",
					nodeCount: nodes.length,
					completedAt: new Date(),
					errorMessage: null,
				},
			});
			if (published.count !== 1)
				throw new Error("Chapter import was cancelled before publication.");
			return { bookId: job.bookId, nodeCount: nodes.length };
		},
		{ timeout: 120_000, maxWait: 10_000 },
	);
}
