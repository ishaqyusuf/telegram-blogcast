import { getLocalNetworkHost } from "@/lib/base-url";
import { normalizeLocalApiIpInput } from "@/lib/local-api-ip-cache";

export function getCurrentLocalApiIp() {
	try {
		return normalizeLocalApiIpInput(getLocalNetworkHost());
	} catch {
		return "";
	}
}
