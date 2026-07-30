export function createTransportAwareLocalFetch(
	onTransportError: (() => void) | undefined,
	fetchImpl: typeof fetch,
): typeof fetch {
	return async (input, init) => {
		try {
			const response = await fetchImpl(input, init);
			if ([502, 503, 504].includes(response.status)) {
				onTransportError?.();
			}
			return response;
		} catch (error) {
			onTransportError?.();
			throw error;
		}
	};
}
