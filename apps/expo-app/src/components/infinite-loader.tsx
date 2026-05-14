import { useCallback, useDeferredValue, useMemo } from "react";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { consoleLog } from "@acme/utils";
interface Props<T> {
  filter?;
  input?;
  route: T;
  queryOptions?: { staleTime?: number; gcTime?: number };
}
export function useInfiniteLoader<
  T extends { infiniteQueryOptions: any; "~types": { output: any } },
>({ filter, input, route, queryOptions }: Props<T>) {
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
      enabled: false,
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
  } = useSuspenseInfiniteQuery(infiniteQueryOptions);
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
        return (page as any)?.data ?? [];
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
