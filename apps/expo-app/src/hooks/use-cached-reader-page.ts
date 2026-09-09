import { useCallback, useEffect, useRef, useState } from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { readCachedReaderPage, saveCachedReaderPage } from "@/lib/book-cache-reader";
import { loadBookCacheResource, withBookCacheDeadline } from "@/lib/book-cache-resource";
import type { ReaderPage } from "@/lib/book-cache-page";
import { subscribeBookCacheChanges } from "@/lib/book-cache-events";
import { useAuthContext } from "./use-auth";

type State = { key: string; data?: ReaderPage; error?: Error; cacheError?: Error; pending: boolean };

export function useCachedReaderPage(bookId: number, pageId: number) {
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	const key = `${scope}:${bookId}:${pageId}`;
	const network = useNetInfo();
	const online = network.isConnected !== false && network.isInternetReachable !== false;
	const qc = useQueryClient();
	const trpc = useTRPC();
	const [revision, setRevision] = useState(0);
	const [state, setState] = useState<State>({ key, pending: true });
	const forced = useRef(false);
	const refetch = useCallback(() => { forced.current = true; setRevision((value) => value + 1); }, []);
	useEffect(() => subscribeBookCacheChanges((change) => {
		if (change.kind === "page" && change.bookId === bookId && change.pageId === pageId) refetch();
	}), [bookId, pageId, refetch]);
	useEffect(() => {
		const controller = new AbortController();
		const force = forced.current;
		forced.current = false;
		setState((current) => current.key === key ? { ...current, error: undefined, cacheError: undefined } : { key, pending: true });
		void loadBookCacheResource<ReaderPage>({
			read: () => readCachedReaderPage(scope, bookId, pageId),
			async fetch() {
				const queryKey = [...trpc.book.getPage.queryKey({ pageId }), scope];
				const cached = qc.getQueryData<ReaderPage>(queryKey);
				if (!force && !cached?.localCache?.restored && !cached?.localCache?.legacy && cached?.bookId === bookId && cached.status === "fetched" && Date.now() - (qc.getQueryState(queryKey)?.dataUpdatedAt ?? 0) < 60_000) return cached;
				const page = await withBookCacheDeadline((signal) => vanillaTrpc.book.getPage.query({ pageId }, { signal }), controller.signal);
				if (page.bookId !== bookId) throw new Error("This page belongs to a different book.");
				if (page.status !== "fetched") throw new Error("The server page is not ready. Any saved local copy remains available.");
				qc.setQueryData(queryKey, page);
				return page;
			},
			save: (page, observedAt) => page.status === "fetched" ? saveCachedReaderPage(scope, page, observedAt) : Promise.resolve(),
			shouldRefresh: () => online,
			onValue: (data) => setState({ key, data, pending: false }),
			onError: (error) => setState((current) => ({ ...current, key, error, pending: false })),
			onCacheError: (cacheError) => setState((current) => ({ ...current, key, cacheError })),
			signal: controller.signal,
		}).finally(() => { if (!controller.signal.aborted) setState((current) => ({ ...current, pending: false })); });
		return () => controller.abort();
	}, [bookId, key, online, pageId, qc, revision, scope, trpc]);
	const current: State = state.key === key ? state : { key, pending: true };
	return { data: current.data, isLoading: current.pending && !current.data, error: current.error, cacheError: current.cacheError, refetch, online, scope };
}
