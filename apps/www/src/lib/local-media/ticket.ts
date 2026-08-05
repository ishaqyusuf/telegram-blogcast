import { createHmac, timingSafeEqual } from "node:crypto";

export const LOCAL_MEDIA_TICKET_TTL_MS = 12 * 60 * 60 * 1000;

type TicketPayload = {
	mediaId: number;
	expiresAt: number;
};

function sign(value: string, secret: string) {
	return createHmac("sha256", secret).update(value).digest("base64url");
}

export function getLocalMediaSigningSecret() {
	return process.env.LOCAL_MEDIA_SIGNING_SECRET?.trim() || null;
}

export function createLocalMediaTicket(input: {
	mediaId: number;
	secret: string;
	now?: Date;
	ttlMs?: number;
}) {
	const payload: TicketPayload = {
		mediaId: input.mediaId,
		expiresAt:
			(input.now ?? new Date()).getTime() +
			(input.ttlMs ?? LOCAL_MEDIA_TICKET_TTL_MS),
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
		"base64url",
	);
	return `${encodedPayload}.${sign(encodedPayload, input.secret)}`;
}

export function verifyLocalMediaTicket(
	ticket: string | null | undefined,
	input: { mediaId: number; secret: string; now?: Date },
) {
	if (!ticket) return false;
	const [encodedPayload, providedSignature, extra] = ticket.split(".");
	if (!encodedPayload || !providedSignature || extra !== undefined)
		return false;

	const expectedSignature = sign(encodedPayload, input.secret);
	const provided = Buffer.from(providedSignature);
	const expected = Buffer.from(expectedSignature);
	if (
		provided.length !== expected.length ||
		!timingSafeEqual(provided, expected)
	) {
		return false;
	}

	try {
		const payload = JSON.parse(
			Buffer.from(encodedPayload, "base64url").toString("utf8"),
		) as Partial<TicketPayload>;
		return (
			payload.mediaId === input.mediaId &&
			typeof payload.expiresAt === "number" &&
			payload.expiresAt > (input.now ?? new Date()).getTime()
		);
	} catch {
		return false;
	}
}
