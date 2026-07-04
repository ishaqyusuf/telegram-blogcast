import {
	getLocalFacebookMediaBridgeUrl,
	isPrivateNetworkHost,
} from "@/lib/base-url";

const envBaseUrl = process.env.EXPO_PUBLIC_FACEBOOK_MEDIA_BRIDGE_URL;
const PLACEHOLDER_TOKENS = ["YOUR_MAC_LAN_IP", "YOUR_DEVICE_IP"];

function isPlaceholderUrl(value?: string | null) {
	if (!value) return false;
	const upper = value.toUpperCase();
	return PLACEHOLDER_TOKENS.some((token) => upper.includes(token));
}

function normalizeBridgeUrl(value?: string | null) {
	const normalized = value?.trim().replace(/\/+$/, "");
	if (!normalized) return null;
	if (isPlaceholderUrl(normalized)) return null;
	try {
		if (!isPrivateNetworkHost(new URL(normalized).hostname)) return null;
	} catch {
		return null;
	}
	return normalized;
}

export function getDefaultFacebookMediaBridgeUrl(savedUrl?: string | null) {
	try {
		return getLocalFacebookMediaBridgeUrl();
	} catch {}
	const saved = normalizeBridgeUrl(savedUrl);
	if (saved) return saved;
	const env = normalizeBridgeUrl(envBaseUrl);
	if (env) return env;
	return null;
}

export function isHttpFacebookMediaBridgeUrl(value?: string | null) {
	if (!value || isPlaceholderUrl(value)) return false;
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}
