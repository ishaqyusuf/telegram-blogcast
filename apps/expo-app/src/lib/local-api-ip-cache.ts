import { LOCAL_API_PORT } from "@/lib/local-service-ports";
import { isValidIpv4Address } from "@/lib/local-services-session";

export { LOCAL_API_PORT } from "@/lib/local-service-ports";
const MAX_IP_HISTORY = 8;
const HEALTH_TIMEOUT_MS = 2500;
const MAX_CONCURRENT_HISTORY_PROBES = 4;
const LOCAL_API_HEALTH_SERVICE = "al-ghurobaa-local-api";

export type LocalApiIpSource = "last" | "current" | "history" | "manual";

export type LocalApiIpCandidate = {
	ip: string;
	source: LocalApiIpSource;
};

export type LocalApiResolveResult = LocalApiIpCandidate & {
	baseUrl: string;
};

export type LocalApiProbe = (
	baseUrl: string,
	options?: { signal?: AbortSignal },
) => Promise<boolean>;

export function buildLocalApiBaseUrl(ip: string, port = LOCAL_API_PORT) {
	return `http://${ip.trim()}:${port}`;
}

export function normalizeLocalApiIpInput(value: string | null | undefined) {
	const input = value?.trim();
	if (!input) return "";

	try {
		const url = new URL(input.includes("://") ? input : `http://${input}`);
		return url.hostname.trim();
	} catch {
		return input
			.replace(/^https?:\/\//, "")
			.replace(/\/.*$/, "")
			.split(":")[0]
			.trim();
	}
}

export function addLocalApiIpToHistory(history: string[], ip: string) {
	const cleanIp = normalizeLocalApiIpInput(ip);
	if (!cleanIp) return history;
	return [
		cleanIp,
		...history
			.map(normalizeLocalApiIpInput)
			.filter((item) => item && item !== cleanIp),
	].slice(0, MAX_IP_HISTORY);
}

export function getLocalApiIpCandidates(input: {
	lastUsedIp?: string | null;
	currentIp?: string | null;
	history?: string[];
}) {
	const candidates: LocalApiIpCandidate[] = [];
	const seen = new Set<string>();
	const add = (ip: string | null | undefined, source: LocalApiIpSource) => {
		const cleanIp = normalizeLocalApiIpInput(ip);
		if (!isValidIpv4Address(cleanIp) || seen.has(cleanIp)) return;
		seen.add(cleanIp);
		candidates.push({ ip: cleanIp, source });
	};

	add(input.lastUsedIp, "last");
	for (const ip of input.history ?? []) add(ip, "history");
	add(input.currentIp, "current");

	return candidates;
}

export async function checkLocalApiBaseUrl(
	baseUrl: string,
	options?: { signal?: AbortSignal },
) {
	const controller = new AbortController();
	const abort = () => controller.abort();
	options?.signal?.addEventListener("abort", abort, { once: true });
	const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
	try {
		const res = await fetch(`${baseUrl.trim().replace(/\/+$/, "")}/health`, {
			signal: controller.signal,
		});
		if (!res.ok) return false;
		const health = (await res.json()) as {
			ok?: unknown;
			service?: unknown;
		};
		return health.ok === true && health.service === LOCAL_API_HEALTH_SERVICE;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
		options?.signal?.removeEventListener("abort", abort);
	}
}

export async function resolveReachableLocalApi(input: {
	lastUsedIp?: string | null;
	currentIp?: string | null;
	history?: string[];
	onAttempt?: (
		candidate: LocalApiIpCandidate,
		progress: { attempted: number; total: number },
	) => void;
	probe?: LocalApiProbe;
	signal?: AbortSignal;
}) {
	const candidates = getLocalApiIpCandidates({
		lastUsedIp: input.lastUsedIp,
		currentIp: input.currentIp,
		history: input.history,
	});
	const probe = input.probe ?? checkLocalApiBaseUrl;
	let attempted = 0;

	const probeCandidate = async (candidate: LocalApiIpCandidate) => {
		if (input.signal?.aborted) return false;
		attempted += 1;
		input.onAttempt?.(candidate, {
			attempted,
			total: candidates.length,
		});
		const baseUrl = buildLocalApiBaseUrl(candidate.ip);
		try {
			return await probe(baseUrl, { signal: input.signal });
		} catch {
			return false;
		}
	};

	const [selectedCandidate, ...fallbackCandidates] = candidates;
	if (selectedCandidate && (await probeCandidate(selectedCandidate))) {
		return {
			...selectedCandidate,
			baseUrl: buildLocalApiBaseUrl(selectedCandidate.ip),
		} satisfies LocalApiResolveResult;
	}

	for (
		let index = 0;
		index < fallbackCandidates.length;
		index += MAX_CONCURRENT_HISTORY_PROBES
	) {
		if (input.signal?.aborted) return null;
		const batch = fallbackCandidates.slice(
			index,
			index + MAX_CONCURRENT_HISTORY_PROBES,
		);
		const results = await Promise.all(batch.map(probeCandidate));
		const firstReachableIndex = results.findIndex(Boolean);
		if (firstReachableIndex >= 0) {
			const candidate = batch[firstReachableIndex]!;
			return {
				...candidate,
				baseUrl: buildLocalApiBaseUrl(candidate.ip),
			} satisfies LocalApiResolveResult;
		}
	}

	return null;
}
