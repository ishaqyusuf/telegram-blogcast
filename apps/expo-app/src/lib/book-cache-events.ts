type Change = { kind: "chapters" | "page" | "annotations"; bookId: number; pageId?: number };
const listeners = new Set<(change: Change) => void>();

export function notifyBookCacheChanged(change: Change) {
	for (const listener of listeners) listener(change);
}

export function subscribeBookCacheChanges(listener: (change: Change) => void) {
	listeners.add(listener);
	return () => { listeners.delete(listener); };
}
