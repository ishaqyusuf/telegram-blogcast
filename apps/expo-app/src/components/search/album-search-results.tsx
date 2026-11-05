import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { _trpc } from "@/components/static-trpc";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useFloatingFooterInset } from "@/components/floating-footer";
import { useInfiniteQuery } from "@/lib/react-query";

export function AlbumSearchResults({
	q,
	channelId,
}: { q: string; channelId?: number }) {
	const router = useRouter();
	const bottom = useFloatingFooterInset();
	const result = useInfiniteQuery(
		_trpc.album.search.infiniteQueryOptions(
			{ q, channelIds: channelId ? [channelId] : undefined, limit: 30 },
			{
				staleTime: 45_000,
				gcTime: 600_000,
				getNextPageParam: (page) => page.cursor,
			},
		),
	);
	const albums = result.data?.pages.flatMap((page) => page.data) ?? [];
	return (
		<FlatList
			data={albums}
			keyExtractor={(item) => String(item.id)}
			contentContainerStyle={{
				paddingHorizontal: 16,
				paddingBottom: bottom + 32,
				flexGrow: 1,
			}}
			onEndReached={() => {
				if (result.hasNextPage && !result.isFetching)
					void result.fetchNextPage();
			}}
			onEndReachedThreshold={0.4}
			ListEmptyComponent={
				<View className="flex-1 justify-center items-center px-6">
					<Text className="text-muted-foreground">
						{result.isPending
							? "Finding albums…"
							: result.isError
								? "Could not load albums"
								: "No matching albums"}
					</Text>
					{result.isError ? (
						<Pressable onPress={() => void result.refetch()} className="py-4">
							<Text className="text-primary">Retry</Text>
						</Pressable>
					) : null}
				</View>
			}
			ListFooterComponent={
				albums.length ? (
					<View className="py-4">
						{result.isError ? (
							<Pressable onPress={() => void result.refetch()}>
								<Text className="text-destructive">
									Could not refresh. Tap to retry.
								</Text>
							</Pressable>
						) : result.isFetchingNextPage ? (
							<Text className="text-muted-foreground">Loading more…</Text>
						) : null}
					</View>
				) : null
			}
			renderItem={({ item }) => (
				<Pressable
					onPress={() => router.push(`/albums/${item.id}` as never)}
					className="py-4 flex-row gap-3 items-center border-b border-border"
				>
					<View className="size-14 rounded-xl bg-card items-center justify-center">
						<Icon name="Disc3" size={24} className="text-primary" />
					</View>
					<View className="flex-1">
						<Text className="text-foreground font-bold" numberOfLines={2}>
							{item.name}
						</Text>
						<Text
							className="text-muted-foreground text-xs mt-1"
							numberOfLines={1}
						>
							{item._count.medias} tracks ·{" "}
							{item.channel?.title || item.channel?.username || "No channel"}
						</Text>
					</View>
					<Icon
						name="ChevronRight"
						size={18}
						className="text-muted-foreground"
					/>
				</Pressable>
			)}
		/>
	);
}
