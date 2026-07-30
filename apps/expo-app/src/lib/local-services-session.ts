export type LocalServicesSessionStatus =
	| "initializing"
	| "enabled"
	| "disabled";

export type LocalServicesIpMode = "automatic" | "manual" | "remote";
export type LocalServicesConnectionStatus = "checking" | "online" | "offline";
export type LocalServicesDiscoveryProgress = {
	attempted: number;
	total: number;
} | null;

const MAX_RECENT_IPS = 8;

export function getInitialLocalServicesSessionStatus(
	_appVariant: string | null | undefined,
): LocalServicesSessionStatus {
	return "initializing";
}

export function getLocalServicesIpMode(
	appVariant: string | null | undefined,
): LocalServicesIpMode {
	const normalized = (appVariant ?? "production").toLowerCase();
	if (normalized === "development" || normalized === "dev") return "automatic";
	if (normalized === "preview") return "remote";
	return "manual";
}

export function normalizeIpv4Input(value: string) {
	return value
		.trim()
		.replaceAll(",", ".")
		.replace(/[^\d.]/g, "");
}

export function isValidIpv4Address(value: string | null | undefined) {
	if (!value) return false;
	const octets = value.split(".");
	if (octets.length !== 4) return false;

	return octets.every((octet) => {
		if (!/^\d{1,3}$/.test(octet)) return false;
		const numeric = Number(octet);
		return numeric >= 0 && numeric <= 255;
	});
}

export function filterRecentLocalServiceIps(input: {
	activeIp?: string | null;
	history?: string[];
	query?: string;
}) {
	const query = normalizeIpv4Input(input.query ?? "");
	const recent: string[] = [];
	const seen = new Set<string>();

	for (const candidate of [input.activeIp, ...(input.history ?? [])]) {
		const ip = normalizeIpv4Input(candidate ?? "");
		if (!isValidIpv4Address(ip) || seen.has(ip)) continue;
		seen.add(ip);
		recent.push(ip);
		if (recent.length === MAX_RECENT_IPS) break;
	}

	return query ? recent.filter((ip) => ip.includes(query)) : recent;
}
