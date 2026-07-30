import { z } from "zod";

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
