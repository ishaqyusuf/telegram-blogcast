import { getTrpcUrl } from "@/lib/base-url";
import {
	createContentQueryCache,
	isPersistedContentKey,
} from "@/lib/content-query-cache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { AppState } from "react-native";

export function ContentCacheProvider({
	client,
	children,
}: { client: QueryClient; children: ReactNode }) {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let unsubscribe = () => {};
		const cache = createContentQueryCache(client, AsyncStorage, getTrpcUrl());
		const flush = () => {
			clearTimeout(timer);
			void cache.save();
		};
		const appState = AppState.addEventListener("change", (state) => {
			if (state !== "active" && !cancelled) flush();
		});
		void cache.restore().finally(() => {
			if (cancelled) return;
			unsubscribe = client.getQueryCache().subscribe((event) => {
				if (
					event.type !== "updated" ||
					!isPersistedContentKey(event.query.queryKey) ||
					event.action.type !== "success"
				)
					return;
				clearTimeout(timer);
				timer = setTimeout(flush, 350);
			});
			setReady(true);
		});
		return () => {
			cancelled = true;
			clearTimeout(timer);
			unsubscribe();
			appState.remove();
		};
	}, [client]);
	// Mount queries only after disk hydration, so a cache hit has no network loading gate.
	return ready ? children : null;
}
