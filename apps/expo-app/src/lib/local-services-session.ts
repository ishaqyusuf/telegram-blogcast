export type LocalServicesSessionStatus =
	| "initializing"
	| "prompting"
	| "enabled"
	| "disabled";

export type LocalServicesSessionEvent =
	| "request-setup"
	| "begin-resolution"
	| "finish-enabled"
	| "finish-disabled";

const MAX_RECENT_IPS = 8;

export function getInitialLocalServicesSessionStatus(
	appVariant: string | null | undefined,
): LocalServicesSessionStatus {
	const normalized = (appVariant ?? "production").toLowerCase();
	return normalized === "development" || normalized === "dev"
		? "enabled"
		: "prompting";
}

export function transitionLocalServicesSession(
	current: LocalServicesSessionStatus,
	event: LocalServicesSessionEvent,
): LocalServicesSessionStatus {
	if (event === "request-setup") return "prompting";
	if (event === "begin-resolution") return "initializing";
	if (event === "finish-enabled") return "enabled";
	if (event === "finish-disabled") return "disabled";
	return current;
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
