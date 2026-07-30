export const PREVIEW_GATEWAY_REVALIDATION_MS = 10_000;

export function getOfflineLocalServiceRetryDelay(
	appVariant: string,
	retryCount: number,
) {
	if (appVariant.toLowerCase() === "preview") {
		return PREVIEW_GATEWAY_REVALIDATION_MS;
	}
	return Math.min(30_000 * 2 ** retryCount, 120_000);
}
