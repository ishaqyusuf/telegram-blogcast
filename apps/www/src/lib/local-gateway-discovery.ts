import { timingSafeEqual } from "node:crypto";
import { normalizeNgrokFreeGatewayOrigin } from "@acme/utils/local-gateway-discovery";

export const LOCAL_GATEWAY_LEASE_KEY = "preview-local-gateway";
export const LOCAL_GATEWAY_LEASE_TTL_MS = 3 * 60 * 1000;

export type LocalGatewayLeaseRecord = {
	key: string;
	url: string;
	expiresAt: Date;
	updatedAt: Date;
};

export type LocalGatewayLeaseStore = {
	find: (key: string) => Promise<LocalGatewayLeaseRecord | null>;
	upsert: (input: {
		key: string;
		url: string;
		expiresAt: Date;
	}) => Promise<LocalGatewayLeaseRecord>;
	remove: (key: string) => Promise<void>;
};

export function normalizeNgrokGatewayUrl(value: unknown) {
	return normalizeNgrokFreeGatewayOrigin(value);
}

export function hasValidDiscoveryToken(
	authorizationHeader: string | null,
	expectedToken: string | undefined,
) {
	if (!expectedToken || !authorizationHeader?.startsWith("Bearer ")) {
		return false;
	}

	const provided = Buffer.from(authorizationHeader.slice("Bearer ".length));
	const expected = Buffer.from(expectedToken);
	return (
		provided.length === expected.length && timingSafeEqual(provided, expected)
	);
}

export async function getActiveLocalGatewayLease(
	store: LocalGatewayLeaseStore,
	now = new Date(),
) {
	const lease = await store.find(LOCAL_GATEWAY_LEASE_KEY);
	if (!lease || lease.expiresAt.getTime() <= now.getTime()) {
		return { url: null, expiresAt: null };
	}
	return {
		url: lease.url,
		expiresAt: lease.expiresAt.toISOString(),
	};
}

export async function renewLocalGatewayLease(
	store: LocalGatewayLeaseStore,
	value: unknown,
	now = new Date(),
) {
	const url = normalizeNgrokGatewayUrl(value);
	if (!url) return null;

	const lease = await store.upsert({
		key: LOCAL_GATEWAY_LEASE_KEY,
		url,
		expiresAt: new Date(now.getTime() + LOCAL_GATEWAY_LEASE_TTL_MS),
	});
	return {
		url: lease.url,
		expiresAt: lease.expiresAt.toISOString(),
	};
}

export async function removeLocalGatewayLease(store: LocalGatewayLeaseStore) {
	await store.remove(LOCAL_GATEWAY_LEASE_KEY);
}
