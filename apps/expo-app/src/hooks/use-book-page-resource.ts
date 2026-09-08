import { useEffect, useSyncExternalStore } from "react";
import { useBookPageLoader } from "@/components/book/book-page-loader-provider";
import {
	pageTargetKey,
	type BookPageLoader,
	type PageTarget,
} from "@/lib/book-page-loader";

const consumers = new WeakMap<BookPageLoader, Map<string, Set<symbol>>>();

export function useBookPageResource(target: PageTarget, enabled: boolean) {
	const loader = useBookPageLoader();
	const snapshot = useSyncExternalStore(
		loader.subscribe,
		loader.getSnapshot,
		loader.getSnapshot,
	);
	let key = "";
	let invalid: string | undefined;
	try {
		key = pageTargetKey(target);
	} catch (error) {
		invalid = (error as Error).message;
	}
	const { url, bookId, sourcePageNo } = target;
	useEffect(() => {
		if (!enabled || !key) return;
		let registry = consumers.get(loader);
		if (!registry) {
			registry = new Map();
			consumers.set(loader, registry);
		}
		const leases = registry.get(key) ?? new Set<symbol>();
		const lease = Symbol(key);
		leases.add(lease);
		registry.set(key, leases);
		loader.request({ url, bookId, sourcePageNo });
		return () => {
			leases.delete(lease);
			if (!leases.size) {
				registry.delete(key);
				loader.cancel(key);
			}
		};
	}, [loader, key, enabled, url, bookId, sourcePageNo]);
	return {
		load: snapshot.jobs[key],
		error: invalid ?? snapshot.jobs[key]?.error,
		retry: () => loader.retry(key),
		showSource: () => loader.showSource(key),
	};
}
