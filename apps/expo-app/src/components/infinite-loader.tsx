import { useInView } from "react-intersection-observer";
import { useDeferredValue, useEffect, useMemo } from "react";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
interface Props<T> {
  filter?;
  route: T;
}
export function useInfiniteLoader<
  T extends { infiniteQueryOptions: any; "~types": { output: any } }
>({ filter, route }: Props<T>) {
  // const trpc = useTRPC();
  const { ref, inView } = useInView();

  const deferredSearch = useDeferredValue(filter?.q);

  const infiniteQueryOptions = route.infiniteQueryOptions(
    {
      ...(filter || {}),
      q: deferredSearch,
    },
    {
      getNextPageParam: ({ meta }) => {
        return meta?.cursor;
      },
    }
  );
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    refetch,
    isRefetching,
  } = useSuspenseInfiniteQuery(infiniteQueryOptions);
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

  useEffect(() => {
    if (inView) {
      fetchNextPage();
    }
  }, [inView]);
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
