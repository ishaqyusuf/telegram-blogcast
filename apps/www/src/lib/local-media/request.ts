import { getLocalMediaSigningSecret, verifyLocalMediaTicket } from "./ticket";

export function parseLocalMediaId(value: string) {
	const mediaId = Number(value);
	return Number.isInteger(mediaId) && mediaId > 0 ? mediaId : null;
}

export function authorizeLocalMediaRequest(request: Request, mediaId: number) {
	const secret = getLocalMediaSigningSecret();
	if (!secret) return { ok: false as const, status: 503 };
	const ticket = new URL(request.url).searchParams.get("ticket");
	return verifyLocalMediaTicket(ticket, { mediaId, secret })
		? { ok: true as const }
		: { ok: false as const, status: 401 };
}
