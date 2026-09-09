import { getSessionProfile } from "./session-store";

export function getBookCacheScope() {
	return bookCacheScopeForUser(getSessionProfile()?.user?.id);
}

export function bookCacheScopeForUser(userId: unknown) {
	if (typeof userId === "number" && Number.isSafeInteger(userId) && userId > 0) return `user:${userId}`;
	if (typeof userId === "string" && /^[a-zA-Z0-9_-]+$/.test(userId)) return `user:${userId}`;
	return "guest";
}
