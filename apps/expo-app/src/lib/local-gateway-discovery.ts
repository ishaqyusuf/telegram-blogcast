import {
	localGatewayLeaseSchema,
	normalizeNgrokFreeGatewayOrigin,
} from "@acme/utils/local-gateway-discovery";

export const LOCAL_GATEWAY_DISCOVERY_PATH = "/api/local-services/discovery";
const LOCAL_GATEWAY_DISCOVERY_TIMEOUT_MS = 8_000;

export function buildLocalGatewayDiscoveryUrl(
	productionBaseUrl: string | null | undefined,
) {
	const value = productionBaseUrl?.trim();
	if (!value) return null;

	try {
		const url = new URL(value);
		const basePath = url.pathname
			.replace(/\/+$/, "")
			.replace(/(?:\/api){2,}$/, "/api");
		const rootPath = basePath.endsWith("/api")
			? basePath.slice(0, -"/api".length)
			: basePath;
		url.pathname = `${rootPath}${LOCAL_GATEWAY_DISCOVERY_PATH}`.replace(
			/\/{2,}/g,
			"/",
		);
		url.search = "";
		url.hash = "";
		return url.toString().replace(/\/$/, "");
	} catch {
		return null;
	}
}

export function normalizeDiscoveredGatewayUrl(value: unknown) {
	return normalizeNgrokFreeGatewayOrigin(value);
}

export async function fetchActiveLocalGateway(input: {
	productionBaseUrl: string | null | undefined;
	fetchImpl?: typeof fetch;
	now?: Date;
	signal?: AbortSignal;
	timeoutMs?: number;
}) {
	const discoveryUrl = buildLocalGatewayDiscoveryUrl(input.productionBaseUrl);
	if (!discoveryUrl) return null;

	const controller = new AbortController();
	const abort = () => controller.abort();
	input.signal?.addEventListener("abort", abort, { once: true });
	const timeout = setTimeout(
		() => controller.abort(),
		input.timeoutMs ?? LOCAL_GATEWAY_DISCOVERY_TIMEOUT_MS,
	);
	try {
		const response = await (input.fetchImpl ?? fetch)(discoveryUrl, {
			cache: "no-store",
			headers: { Accept: "application/json" },
			signal: controller.signal,
		});
		if (!response.ok) return null;
		const parsedLease = localGatewayLeaseSchema.safeParse(
			await response.json(),
		);
		if (!parsedLease.success) return null;
		const lease = parsedLease.data;
		const url = normalizeDiscoveredGatewayUrl(lease.url);
		if (!url || !lease.expiresAt) return null;
		const expiresAt = new Date(lease.expiresAt);
		if (
			!Number.isFinite(expiresAt.getTime()) ||
			expiresAt.getTime() <= (input.now ?? new Date()).getTime()
		) {
			return null;
		}
		return url;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
		input.signal?.removeEventListener("abort", abort);
	}
}

export async function resolveReachableLocalGateway(input: {
	productionBaseUrl: string | null | undefined;
	checkHealth: (
		gatewayUrl: string,
		options: { signal?: AbortSignal },
	) => Promise<boolean>;
	fetchImpl?: typeof fetch;
	now?: Date;
	signal?: AbortSignal;
	timeoutMs?: number;
}) {
	const gatewayUrl = await fetchActiveLocalGateway(input);
	if (!gatewayUrl) return null;

	const online = await input
		.checkHealth(gatewayUrl, { signal: input.signal })
		.catch(() => false);
	return online ? gatewayUrl : null;
}
