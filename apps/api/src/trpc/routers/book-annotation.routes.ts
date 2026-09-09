import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";

import { annotationId as id, annotationLocalId as localId, annotationScope as scope, annotationPayload as payload, deviceAnnotation as annotation } from "@acme/utils/book-annotation";
const privateDevice = publicProcedure.use(({ ctx, next }) => {
	if (!ctx.bookImportOwnerHash || !/^[a-f0-9]{64}$/.test(ctx.bookImportOwnerHash))
		throw new TRPCError({ code: "UNAUTHORIZED", message: "A private device capability is required for annotation sync." });
	return next({ ctx: { ...ctx, bookImportOwnerHash: ctx.bookImportOwnerHash } });
});
const visible = { localId: true, pageId: true, bookId: true, kind: true, revision: true, deleted: true, payload: true, updatedAt: true } as const;

export const bookAnnotationRoutes = createTRPCRouter({
	capabilities: privateDevice.query(() => ({ protocol: 1 as const, maxBatch: 20 as const, ownership: "device" as const })),
	list: privateDevice.input(z.object({ bookId: id, scope, afterId: localId.optional(), limit: z.number().int().min(1).max(100).default(100) })).query(async ({ ctx, input }) => {
		const rows = await ctx.db.bookDeviceAnnotation.findMany({
			where: { ownerHash: ctx.bookImportOwnerHash, scope: input.scope, bookId: input.bookId, ...(input.afterId ? { localId: { gt: input.afterId } } : {}) },
			select: visible, orderBy: { localId: "asc" }, take: input.limit + 1,
		});
		const items = rows.slice(0, input.limit);
		return { items, nextCursor: rows.length > input.limit ? items.at(-1)!.localId : null };
	}),
	sync: privateDevice.input(z.object({ bookId: id, scope, items: z.array(annotation).min(1).max(20) }).strict().refine((input) => new Set(input.items.map((item) => item.localId)).size === input.items.length, "Duplicate annotation IDs in batch")).mutation(async ({ ctx, input }) => {
		return ctx.db.$transaction(async (tx) => {
			const pages = await tx.bookPage.findMany({ where: { id: { in: [...new Set(input.items.map((item) => item.pageId))] }, bookId: input.bookId, deletedAt: null, book: { deletedAt: null } }, select: { id: true } });
			const pageIds = new Set(pages.map((page) => page.id));
			if (input.items.some((item) => !pageIds.has(item.pageId))) throw new TRPCError({ code: "BAD_REQUEST", message: "An annotation page does not belong to this book." });
			const rows = input.items.map((item) => ({ ...item, ownerHash: ctx.bookImportOwnerHash, scope: input.scope, bookId: input.bookId, kind: item.payload.kind }));
			// One bounded insert/upsert instead of one Prisma create per annotation. Tombstones keep retry identity.
			await tx.$executeRaw`INSERT INTO "BookDeviceAnnotation" ("ownerHash","scope","localId","bookId","pageId","kind","revision","deleted","payload","createdAt","updatedAt")
 SELECT x."ownerHash",x.scope,x."localId",x."bookId",x."pageId",x.kind,x.revision,x.deleted,x.payload,NOW(),NOW()
 FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x("ownerHash" text,scope text,"localId" text,"bookId" integer,"pageId" integer,kind text,revision integer,deleted boolean,payload jsonb)
 ON CONFLICT ("ownerHash","scope","localId") DO UPDATE SET
 "revision"=EXCLUDED."revision","deleted"=EXCLUDED."deleted","payload"=EXCLUDED."payload","updatedAt"=NOW()
 WHERE "BookDeviceAnnotation"."bookId"=EXCLUDED."bookId" AND "BookDeviceAnnotation"."pageId"=EXCLUDED."pageId"
 AND "BookDeviceAnnotation"."kind"=EXCLUDED."kind" AND "BookDeviceAnnotation"."revision"<EXCLUDED."revision"`;
			const saved = await tx.bookDeviceAnnotation.findMany({ where: { ownerHash: ctx.bookImportOwnerHash, scope: input.scope, localId: { in: input.items.map((item) => item.localId) } }, select: visible });
			for (const item of input.items) {
				const row = saved.find((row) => row.localId === item.localId);
				if (!row || row.bookId !== input.bookId || row.pageId !== item.pageId || row.kind !== item.payload.kind)
					throw new TRPCError({ code: "CONFLICT", message: "An annotation ID cannot change its page or kind." });
				if (row.revision === item.revision && (row.deleted !== item.deleted || JSON.stringify(payload.parse(row.payload)) !== JSON.stringify(item.payload)))
					throw new TRPCError({ code: "CONFLICT", message: "An annotation revision was reused with different content." });
			}
			return saved;
		});
	}),
});
