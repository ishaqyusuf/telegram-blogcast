import { db } from "@acme/db";

import {
	getRequestClientAddress,
	takeLocalMediaRateLimit,
} from "@/lib/local-media/rate-limit";
import {
	createLocalMediaTicket,
	getLocalMediaSigningSecret,
} from "@/lib/local-media/ticket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request) {
	const clientId = request.headers.get("x-local-media-client-id")?.trim();
	if (!clientId || !/^[a-zA-Z0-9._-]{16,128}$/.test(clientId)) {
		return Response.json(
			{ error: "A valid local media client id is required." },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	const clientAddress = getRequestClientAddress(request);
	if (
		!takeLocalMediaRateLimit({
			key: `ticket-address:${clientAddress}`,
			limit: 60,
			windowMs: 60_000,
		}) ||
		!takeLocalMediaRateLimit({
			key: `ticket:${clientAddress}:${clientId}`,
			limit: 20,
			windowMs: 60_000,
		})
	) {
		return Response.json(
			{ error: "Too many local media ticket requests." },
			{ status: 429, headers: NO_STORE_HEADERS },
		);
	}
	const secret = getLocalMediaSigningSecret();
	if (!secret) {
		return Response.json(
			{ error: "LOCAL_MEDIA_SIGNING_SECRET is not configured." },
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}

	let mediaId: number;
	try {
		const body = (await request.json()) as { mediaId?: unknown };
		mediaId = Number(body.mediaId);
	} catch {
		return Response.json(
			{ error: "Invalid JSON body." },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	if (!Number.isInteger(mediaId) || mediaId <= 0) {
		return Response.json(
			{ error: "mediaId must be a positive integer." },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const media = await db.media.findUnique({
		where: { id: mediaId },
		select: { id: true, blog: { select: { deletedAt: true } } },
	});
	if (!media?.blog || media.blog.deletedAt) {
		return Response.json(
			{ error: "Media not found." },
			{ status: 404, headers: NO_STORE_HEADERS },
		);
	}

	return Response.json(
		{
			mediaId,
			ticket: createLocalMediaTicket({ mediaId, secret }),
		},
		{ headers: NO_STORE_HEADERS },
	);
}
