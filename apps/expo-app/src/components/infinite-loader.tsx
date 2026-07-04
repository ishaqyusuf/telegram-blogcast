import { consoleLog } from "@acme/utils";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useMemo } from "react";

type LoaderInput = Record<string, unknown> & { q?: string };
type InfiniteQueryOptions = Parameters<typeof useInfiniteQuery>[0];
type InfiniteLoaderRoute<OutputData> = {
	infiniteQueryOptions: (
		input: LoaderInput,
		options: Record<string, unknown>,
	) => InfiniteQueryOptions;
	"~types": { output: { data: OutputData } };
};

interface Props<T> {
	filter?: LoaderInput;
	input?: LoaderInput;
	route: T;
	queryOptions?: { staleTime?: number; gcTime?: number };
}

export function useInfiniteLoader<T extends InfiniteLoaderRoute<unknown>>({
	filter,
	input,
	route,
	queryOptions,
}: Props<T>) {
	// const trpc = useTRPC();
	const ref = useCallback(() => {}, []);

	const deferredSearch = useDeferredValue(filter?.q);

	const infiniteQueryOptions = route.infiniteQueryOptions(
		{
			...(input || {}),
			...(filter || {}),
			q: deferredSearch,
		},
		{
			getNextPageParam: ({ meta }) => {
				return meta?.cursor;
			},
			enabled: true,
			placeholderData: keepPreviousData,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
			...queryOptions,
		},
	);
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetching,
		refetch,

		isRefetching,
		isPending,
		error,
	} = useInfiniteQuery(infiniteQueryOptions);
	consoleLog("Infinite loader data:", {
		data,
		hasNextPage,
		isFetching,
		isPending,
		error,
	});
	const tableData = useMemo(() => {
		const list =
			data?.pages.flatMap((page) => {
				return (page as { data?: unknown[] })?.data ?? [];
			}) ?? [];

		return {
			data: list as T["~types"]["output"]["data"],
			// resultCount: cursor,
			// total: count,
		};
	}, [data]);

	return {
		ref,
		// data: tableData,
		...tableData,
		queryData: data,
		hasNextPage,
		fetchNextPage,
		isFetching,
		refetch,
		isRefetching,
		// from: data?.
	};
}
