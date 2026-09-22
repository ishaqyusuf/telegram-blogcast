import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { TRPCInfiniteQueryOptions } from "@trpc/tanstack-react-query";
import type { DefaultErrorShape } from "@trpc/server/unstable-core-do-not-import";
import { useCallback, useDeferredValue, useMemo } from "react";

type LoaderInput = Record<string, unknown> & {
	cursor?: number | string;
	q?: string;
};
type LoaderPage = {
	data: unknown[];
	meta: { cursor?: number | string | null };
};
type ExtractCursor<TInput> = TInput extends { cursor?: infer TCursor }
	? TCursor
	: never;

interface Props<T> {
	filter?: LoaderInput;
	input?: LoaderInput;
	route: T;
	queryOptions?: {
		enabled?: boolean;
		gcTime?: number;
		placeholderData?: typeof keepPreviousData;
		staleTime?: number;
	};
}

export function useInfiniteLoader<
	TInput extends LoaderInput,
	TPage extends LoaderPage,
	TErrorShape extends DefaultErrorShape,
	TFeatureFlags extends { keyPrefix: boolean },
>({
	filter,
	input,
	route,
	queryOptions,
}: Props<{
	infiniteQueryOptions: TRPCInfiniteQueryOptions<{
		input: TInput;
		output: TPage;
		transformer: true;
		errorShape: TErrorShape;
		featureFlags: TFeatureFlags;
	}>;
}>) {
	const ref = useCallback(() => {}, []);
	const deferredSearch = useDeferredValue(filter?.q);
	const infiniteQueryOptions = route.infiniteQueryOptions(
		{
			...(input || {}),
			...(filter || {}),
			q: deferredSearch,
		} as TInput,
		{
			getNextPageParam: ({ meta }) =>
				meta.cursor as NonNullable<ExtractCursor<TInput>> | null | undefined,
			enabled: true,
			placeholderData: keepPreviousData,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
			...queryOptions,
		},
	);
	const query = useInfiniteQuery(infiniteQueryOptions);
	const data = useMemo(() => {
		return (query.data?.pages.flatMap((page) => {
				return (page as { data?: unknown[] })?.data ?? [];
		}) ?? []) as TPage["data"];
	}, [query.data]);

	return {
		ref,
		data,
		queryData: query.data,
		hasNextPage: query.hasNextPage,
		fetchNextPage: query.fetchNextPage,
		isFetching: query.isFetching,
		refetch: query.refetch,
		isRefetching: query.isRefetching,
		isPlaceholderData: query.isPlaceholderData,
		error: query.error,
	};
}
