type RateWindow = { count: number; resetsAt: number };

const windows = new Map<string, RateWindow>();

export function getRequestClientAddress(request: Request) {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip")?.trim() ||
		"unknown"
	);
}

export function takeLocalMediaRateLimit(input: {
	key: string;
	limit: number;
	windowMs: number;
	now?: number;
}) {
	const now = input.now ?? Date.now();
	if (windows.size > 10_000) {
		for (const [key, window] of windows) {
			if (window.resetsAt <= now) windows.delete(key);
		}
	}
	const current = windows.get(input.key);
	if (!current || current.resetsAt <= now) {
		windows.set(input.key, { count: 1, resetsAt: now + input.windowMs });
		return true;
	}
	if (current.count >= input.limit) return false;
	current.count += 1;
	return true;
}
