export function getLocalApiQueryKey<TInput>(
	activeIp: string | null | undefined,
	procedure: string,
	input?: TInput,
) {
	const base = ["local-api", activeIp ?? "unconfigured", procedure] as const;
	return input === undefined ? base : ([...base, input] as const);
}

export function shouldApplyLocalApiResult(
	requestIp: string | null | undefined,
	activeIp: string | null | undefined,
) {
	return Boolean(requestIp && requestIp === activeIp);
}
