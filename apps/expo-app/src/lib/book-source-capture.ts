export function nextUncapturedSourcePage(
	cursor: number,
	last: number,
	serverPages: ReadonlySet<number>,
	capturedThisRun: ReadonlySet<number>,
) {
	let page = cursor;
	while (page <= last && (serverPages.has(page) || capturedThisRun.has(page)))
		page++;
	return page;
}

export function isSourceRateLimit(message: string) {
	return /(?:\b429\b|rate.?limit|too many requests)/i.test(message);
}

export function isBookServiceUnavailable(message: string) {
	return /(?:can't reach database server|database server is unavailable|\bP1001\b)/i.test(
		message,
	);
}
