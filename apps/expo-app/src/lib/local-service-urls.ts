import {
	LOCAL_API_PORT,
	LOCAL_FACEBOOK_MEDIA_BRIDGE_PORT,
	LOCAL_TRANSCRIBER_PORT,
} from "./local-service-ports";

export {
	LOCAL_API_PORT,
	LOCAL_FACEBOOK_MEDIA_BRIDGE_PORT,
	LOCAL_TRANSCRIBER_PORT,
} from "./local-service-ports";

export type LocalServiceUrls = {
	ip: string;
	apiBaseUrl: string;
	apiTrpcUrl: string;
	transcriberBaseUrl: string;
	facebookMediaBridgeBaseUrl: string;
};

export function normalizeLocalServiceIpInput(value: string | null | undefined) {
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

export function buildLocalServiceUrls(ip: string): LocalServiceUrls | null {
	const cleanIp = normalizeLocalServiceIpInput(ip);
	if (!cleanIp) return null;

	const apiBaseUrl = `http://${cleanIp}:${LOCAL_API_PORT}`;
	return {
		ip: cleanIp,
		apiBaseUrl,
		apiTrpcUrl: `${apiBaseUrl}/api/trpc`,
		transcriberBaseUrl: `http://${cleanIp}:${LOCAL_TRANSCRIBER_PORT}`,
		facebookMediaBridgeBaseUrl: `http://${cleanIp}:${LOCAL_FACEBOOK_MEDIA_BRIDGE_PORT}`,
	};
}

export function getPreferredLocalServiceIp(input: {
	manualIp?: string | null;
	lastUsedIp?: string | null;
	savedApiBaseUrl?: string | null;
	currentIp?: string | null;
}) {
	return (
		normalizeLocalServiceIpInput(input.manualIp) ||
		normalizeLocalServiceIpInput(input.lastUsedIp) ||
		normalizeLocalServiceIpInput(input.savedApiBaseUrl) ||
		normalizeLocalServiceIpInput(input.currentIp)
	);
}
