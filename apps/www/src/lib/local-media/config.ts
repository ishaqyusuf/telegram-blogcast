export function isLocalMediaGatewayEnabled() {
	if (process.env.LOCAL_MEDIA_GATEWAY_ENABLED === "true") return true;
	if (process.env.LOCAL_MEDIA_GATEWAY_ENABLED === "false") return false;
	return process.env.VERCEL !== "1" && !process.env.VERCEL_ENV;
}
