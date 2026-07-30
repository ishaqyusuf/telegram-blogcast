export function getLocalApiQueryKey<TInput>(
	activeGatewayUrl: string | null | undefined,
	procedure: string,
	input?: TInput,
) {
	const base = [
		"local-api",
		activeGatewayUrl ?? "unconfigured",
		procedure,
	] as const;
	return input === undefined ? base : ([...base, input] as const);
}

export function shouldApplyLocalApiResult(
	requestGatewayUrl: string | null | undefined,
	activeGatewayUrl: string | null | undefined,
) {
	return Boolean(
		requestGatewayUrl && requestGatewayUrl === activeGatewayUrl,
	);
}
