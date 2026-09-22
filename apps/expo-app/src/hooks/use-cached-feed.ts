import { useInfiniteLoader } from "@/components/infinite-loader";
import { _qc, _trpc } from "@/components/static-trpc";
import {
	countFeedUpdates,
	mergeLatestFeedPage,
	uniqueFeedItems,
} from "@/lib/feed-updates";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

type Category =
	| "all"
	| "audio"
	| "text"
	| "pdf"
	| "picture"
	| "video"
	| "likes"
	| "saved";
type Page = RouterOutputs["blog"]["posts"];

export function useCachedFeed(category: Category) {
	const loader = useInfiniteLoader({
		filter: { category },
		route: _trpc.blog.posts,
		// Visible data changes only through explicit refresh or pagination. Automatic
		// invalidation cannot replace the list while the user is reading it.
		queryOptions: {
			enabled: false,
			staleTime: Number.POSITIVE_INFINITY,
			gcTime: 24 * 60 * 60 * 1000,
			placeholderData: undefined,
		},
	});
	const [pending, setPending] = useState<{
		category: Category;
		page: Page;
	} | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const current = useRef(loader.data);
	current.current = loader.data;
	const fetchLatest = useCallback(
		() =>
			_qc.fetchQuery({
				..._trpc.blog.posts.queryOptions({ category }),
				staleTime: 0,
				retry: false,
			}),
		[category],
	);
	const installPage = useCallback(
		(page: Page) => {
			_qc.setQueryData(
				_trpc.blog.posts.infiniteQueryKey({ category }),
				(current) => mergeLatestFeedPage(current, page),
			);
		},
		[category],
	);

	useEffect(() => {
		setError(null);
		// No network request is needed to restore an existing snapshot.
		if (!_qc.getQueryData(_trpc.blog.posts.infiniteQueryKey({ category }))) {
			void loader.refetch();
		}
	}, [category, loader.refetch]);

	useFocusEffect(
		useCallback(() => {
			let alive = true;
			let checking = false;
			const check = async () => {
				if (
					checking ||
					AppState.currentState !== "active" ||
					!current.current.length
				)
					return;
				checking = true;
				try {
					const page = await fetchLatest();
					if (alive)
						setPending(
							countFeedUpdates(current.current, page.data) > 0
								? { category, page }
								: null,
						);
				} catch {
					/* Keep the last readable snapshot and any pending updates. */
				} finally {
					checking = false;
				}
			};
			void check();
			const interval = setInterval(() => {
				void check();
			}, 60_000);
			const state = AppState.addEventListener("change", (value) => {
				if (value === "active") void check();
			});
			const network = NetInfo.addEventListener((value) => {
				if (value.isConnected) void check();
			});
			return () => {
				alive = false;
				clearInterval(interval);
				state.remove();
				network();
			};
		}, [category, fetchLatest]),
	);

	const refresh = useCallback(async () => {
		setRefreshing(true);
		setError(null);
		try {
			const page = await fetchLatest();
			installPage(page);
			setPending((value) => (value?.category === category ? null : value));
			return true;
		} catch {
			setError("Could not refresh. Your saved feed is still available.");
			return false;
		} finally {
			setRefreshing(false);
		}
	}, [category, fetchLatest, installPage]);

	const applyUpdates = useCallback(() => {
		if (pending?.category !== category) return;
		installPage(pending.page);
		setPending((value) => (value === pending ? null : value));
	}, [category, installPage, pending]);
	const data = useMemo(() => uniqueFeedItems(loader.data), [loader.data]);
	return {
		...loader,
		data,
		refetch: refresh,
		isRefetching: refreshing,
		pendingCount:
			pending?.category === category
				? countFeedUpdates(data, pending.page.data)
				: 0,
		applyUpdates,
		error:
			error ??
			(loader.error ? "Could not load posts. Pull down to retry." : null),
	};
}
