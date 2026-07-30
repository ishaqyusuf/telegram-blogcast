import { z } from "zod";

function parseRequestHostname(value: string | undefined) {
	const host = value?.split(",")[0]?.trim().toLowerCase();
	if (!host) return null;
	if (host === "::1") return host;
	if (host.startsWith("[")) {
		const closingBracket = host.indexOf("]");
		return closingBracket > 0 ? host.slice(1, closingBracket) : null;
	}
	return host.split(":")[0]?.replace(/\.$/, "") || null;
}

export function isLocalGatewayRequestHost(value: string | undefined) {
	const hostname = parseRequestHostname(value);
	if (!hostname) return false;
	if (
		hostname === "localhost" ||
		hostname === "::1" ||
		hostname.endsWith(".localhost") ||
		hostname.startsWith("127.") ||
		hostname.startsWith("10.") ||
		hostname.startsWith("192.168.") ||
		hostname.endsWith(".ngrok-free.app")
	) {
		return true;
	}

	const match = /^172\.(\d+)\./.exec(hostname);
	const secondOctet = match?.[1] ? Number(match[1]) : null;
	return secondOctet !== null && secondOctet >= 16 && secondOctet <= 31;
}

export function normalizeNgrokFreeGatewayOrigin(value: unknown) {
	if (typeof value !== "string") return null;

	try {
		const url = new URL(value.trim());
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			url.port ||
			(url.pathname !== "/" && url.pathname !== "") ||
			url.search ||
			url.hash ||
			!url.hostname.endsWith(".ngrok-free.app")
		) {
			return null;
		}
		return url.origin;
	} catch {
		return null;
	}
}

export const localGatewayPublicationSchema = z
	.object({
		url: z.string(),
	})
	.strict()
	.refine((value) => normalizeNgrokFreeGatewayOrigin(value.url) !== null, {
		message: "Expected an origin-only HTTPS *.ngrok-free.app URL.",
		path: ["url"],
	});

export const localGatewayLeaseSchema = z
	.object({
		url: z.string().nullable(),
		expiresAt: z.string().datetime().nullable(),
	})
	.strict()
	.refine((value) => (value.url === null) === (value.expiresAt === null), {
		message:
			"The lease URL and expiry must either both be set or both be null.",
	});

export type LocalGatewayLease = z.infer<typeof localGatewayLeaseSchema>;
