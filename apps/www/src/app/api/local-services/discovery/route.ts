import { db } from "@acme/db";
import { localGatewayPublicationSchema } from "@acme/utils/local-gateway-discovery";

import {
	type LocalGatewayLeaseStore,
	getActiveLocalGatewayLease,
	hasValidDiscoveryToken,
	removeLocalGatewayLease,
	renewLocalGatewayLease,
} from "@/lib/local-gateway-discovery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
	"Cache-Control": "no-store, max-age=0",
};

const LOCAL_GATEWAY_LEASE_STORE: LocalGatewayLeaseStore = {
	find: (key) => db.localGatewayLease.findUnique({ where: { key } }),
	upsert: ({ key, url, expiresAt }) =>
		db.localGatewayLease.upsert({
			where: { key },
			create: { key, url, expiresAt },
			update: { url, expiresAt },
		}),
	remove: async (key) => {
		await db.localGatewayLease.deleteMany({ where: { key } });
	},
};

function unauthorized() {
	return Response.json(
		{ error: "UNAUTHORIZED" },
		{ status: 401, headers: NO_STORE_HEADERS },
	);
}

function isAuthorized(request: Request) {
	return hasValidDiscoveryToken(
		request.headers.get("authorization"),
		process.env.LOCAL_SERVICES_DISCOVERY_TOKEN,
	);
}

export async function GET() {
	const lease = await getActiveLocalGatewayLease(LOCAL_GATEWAY_LEASE_STORE);
	return Response.json(lease, { headers: NO_STORE_HEADERS });
}

export async function PUT(request: Request) {
	if (!isAuthorized(request)) return unauthorized();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json(
			{ error: "INVALID_JSON" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const publication = localGatewayPublicationSchema.safeParse(body);
	if (!publication.success) {
		return Response.json(
			{ error: "INVALID_NGROK_URL" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	const lease = await renewLocalGatewayLease(
		LOCAL_GATEWAY_LEASE_STORE,
		publication.data.url,
	);
	if (!lease) throw new Error("Validated gateway URL could not be normalized.");
	return Response.json(lease, { headers: NO_STORE_HEADERS });
}

export async function DELETE(request: Request) {
	if (!isAuthorized(request)) return unauthorized();
	await removeLocalGatewayLease(LOCAL_GATEWAY_LEASE_STORE);
	return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
