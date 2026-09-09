import { z } from "zod";
export const annotationId = z.number().int().positive().max(2_147_483_647);
export const annotationLocalId = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
export const annotationScope = z.string().min(1).max(120).regex(/^(guest|user:[a-zA-Z0-9_-]+)$/);
const anchor = {
	paragraphId: annotationId.nullable(),
	paragraphPid: annotationId.nullable(),
	quoteText: z.string().max(16_000).nullable(),
};
export const annotationPayload = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("highlight"), ...anchor, startOffset: z.number().int().nonnegative(), endOffset: z.number().int().nonnegative(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), note: z.string().max(16_000).nullable() }).strict().refine((value) => value.endOffset >= value.startOffset, "Invalid highlight range"),
	z.object({ kind: z.literal("comment"), ...anchor, content: z.string().min(1).max(16_000) }).strict(),
]);
export const deviceAnnotation = z.object({ localId: annotationLocalId, pageId: annotationId, revision: annotationId, deleted: z.boolean(), payload: annotationPayload }).strict();
export type DeviceAnnotation = z.infer<typeof deviceAnnotation>;
