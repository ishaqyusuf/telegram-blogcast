import { useCallback, useEffect, useRef, useState } from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import { getBookCacheRepository } from "@/db/book-cache-db";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { parseChapterFile } from "@/lib/book-cache-format";
import { loadBookCacheResource, withBookCacheDeadline } from "@/lib/book-cache-resource";
import { syncBookFolder } from "@/lib/book-cache-sync";
import { useAuthContext } from "./use-auth";
import { subscribeBookCacheChanges } from "@/lib/book-cache-events";
import { localSqlite } from "@/db/local-db";
import { readLegacyChapters } from "@/lib/book-cache-legacy";

type Snapshot = Awaited<ReturnType<typeof vanillaTrpc.bookChapter.tree.query>>;
type State = { key: string; data?: Snapshot; error?: Error; cacheError?: Error; pending: boolean };
const checkedAt = new Map<string, number>();
const freshnessMs = 15 * 60_000;

export function useCachedBookChapters(bookId: number) {
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	const key = `${scope}:chapters:${bookId}`;
	const network = useNetInfo();
	const online = network.isConnected !== false && network.isInternetReachable !== false;
	const [refresh, setRefresh] = useState(0);
	const [state, setState] = useState<State>({ key, pending: true });
	const force = useRef(false);
	const refetch = useCallback(() => { force.current = true; setRefresh((value) => value + 1); }, []);
	useEffect(() => subscribeBookCacheChanges((change) => {
		if (change.kind === "chapters" && change.bookId === bookId) {
			checkedAt.delete(key);
			refetch();
		}
	}), [bookId, key, refetch]);
	const refreshIfStale = useCallback(() => {
		if (Date.now() - (checkedAt.get(key) ?? 0) >= freshnessMs) setRefresh((value) => value + 1);
	}, [key]);
	useEffect(() => {
		const controller = new AbortController();
		const forced = force.current;
		force.current = false;
		setState((current) => current.key === key ? { ...current, error: undefined, cacheError: undefined } : { key, pending: true });
		let local: Snapshot | null = null;
		void loadBookCacheResource<Snapshot>({
			async read() {
				const repository = await getBookCacheRepository();
				const tree = await repository.readChapters(scope, bookId);
				if (tree) {
					const { nodes, ...cache } = tree;
					local = { items: nodes, cache: { ...cache, exportable: false } };
				} else local = await readLegacyChapters(localSqlite, scope, bookId);
				return local;
			},
			async fetch() {
				const result = await withBookCacheDeadline((signal) => vanillaTrpc.bookChapter.tree.query({ bookId }, { signal }), controller.signal);
				if (result.cache?.complete) {
					const { exportable: _exportable, ...metadata } = result.cache;
					parseChapterFile(JSON.stringify({ ...metadata, nodes: result.items }), bookId);
				}
				checkedAt.set(key, Date.now());
				if (checkedAt.size > 200) checkedAt.delete(checkedAt.keys().next().value!);
				// Older deployments may lack cache metadata; display them without claiming durable completeness.
				return local && result.cache?.complete === false ? local : result;
			},
			async save(snapshot, observedAt) {
				if (!snapshot.cache?.complete || snapshot === local) return;
				const { exportable, ...metadata } = snapshot.cache;
				const tree = parseChapterFile(JSON.stringify({ ...metadata, nodes: snapshot.items }), bookId);
				const repository = await getBookCacheRepository();
				await repository.saveChapters(scope, tree, observedAt, exportable);
				if (exportable) void syncBookFolder();
			},
			shouldRefresh: (saved) => online && (forced || saved === null || Date.now() - (checkedAt.get(key) ?? 0) >= freshnessMs),
			onValue: (data) => setState({ key, data, pending: false }),
			onError: (error) => setState((current) => ({ ...current, key, error, pending: false })),
			onCacheError: (cacheError) => setState((current) => ({ ...current, key, cacheError })),
			signal: controller.signal,
		}).finally(() => { if (!controller.signal.aborted) setState((current) => ({ ...current, pending: false })); });
		return () => controller.abort();
	}, [bookId, key, online, refresh, scope]);
	const current = state.key === key ? state : { key, pending: true };
	return {
		data: current.data, error: current.error, cacheError: current.cacheError,
		isPending: current.pending && !current.data, isError: Boolean(current.error),
		refetch, refreshIfStale,
	};
}
