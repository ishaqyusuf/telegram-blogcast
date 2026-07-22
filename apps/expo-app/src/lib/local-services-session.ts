export type LocalServicesSessionStatus =
	| "initializing"
	| "prompting"
	| "enabled"
	| "disabled";

export type LocalServicesIpMode = "automatic" | "manual";
export type LocalServicesConnectionStatus =
	| "checking"
	| "online"
	| "offline";
export type LocalServicesProbeTrigger =
	| "initial"
	| "offline-retry"
	| "foreground";

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

export function resolveInitialLocalServicesSession(input: {
	appVariant: string | null | undefined;
	currentIp?: string | null;
	preferredSavedIp?: string | null;
}): {
	status: LocalServicesSessionStatus;
	ipMode: LocalServicesIpMode;
	activeIp: string | null;
} {
	const status = getInitialLocalServicesSessionStatus(input.appVariant);
	const ipMode: LocalServicesIpMode =
		status === "enabled" ? "automatic" : "manual";
	const candidate = normalizeIpv4Input(
		ipMode === "automatic"
			? (input.currentIp ?? "")
			: (input.preferredSavedIp ?? ""),
	);

	return {
		status,
		ipMode,
		activeIp: isValidIpv4Address(candidate) ? candidate : null,
	};
}

export function shouldProbeLocalServices(input: {
	status: LocalServicesSessionStatus;
	hasActiveIp: boolean;
	connectionStatus: LocalServicesConnectionStatus;
	trigger: LocalServicesProbeTrigger;
}) {
	if (input.status !== "enabled" || !input.hasActiveIp) return false;
	if (input.trigger === "offline-retry") {
		return input.connectionStatus === "offline";
	}
	return true;
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
