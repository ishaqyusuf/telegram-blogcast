import {
	BottomSheetFlatList,
	type BottomSheetFlatListMethods,
} from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { useRouter } from "expo-router";
import { useRef } from "react";
import {
	ActivityIndicator,
	Text,
	View,
	useWindowDimensions,
} from "react-native";
import { _trpc } from "@/components/static-trpc";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { rememberAudioDetailFromMedia } from "@/lib/audio-detail-preview";
import { hasCustomAudioTitle } from "@/lib/audio-title";
import { ALBUM_QUERY_CACHE, getPlayerAlbumFocus } from "@/lib/player-album";
import { withAlpha } from "@/lib/theme";
import { minuteToString } from "@/lib/utils";
import { useAudioStore } from "@/store/audio-store";

type Album = RouterOutputs["album"]["getAlbum"];
type Track = Album["medias"][number];
type CurrentMedia = RouterOutputs["blog"]["getBlog"]["medias"][number];

/** Remains mounted with the player so loading starts before the sheet is opened. */
export function PlayerAlbumSheet({
	visible,
	onClose,
	media,
}: {
	visible: boolean;
	onClose: () => void;
	media: CurrentMedia;
}) {
	const router = useRouter();
	const colors = useColors();
	const { fontScale } = useWindowDimensions();
	const listRef = useRef<BottomSheetFlatListMethods>(null);
	const presented = useRef(false);
	const revealed = useRef<string | null>(null);
	const afterDismiss = useRef<(() => void) | null>(null);
	const playingMediaId = useAudioStore((state) => state.blog?.audio?.mediaId);
	const {
		data: album,
		isPending,
		isError,
		isFetching,
		refetch,
	} = useQuery({
		..._trpc.album.getAlbum.queryOptions(
			{ id: media.albumId! },
			ALBUM_QUERY_CACHE,
		),
		enabled: Boolean(media.albumId),
	});
	const tracks = album?.medias ?? [media];
	const focusMediaId = getPlayerAlbumFocus(tracks, media.id, playingMediaId);
	const focusIndex = tracks.findIndex((track) => track.id === focusMediaId);
	const rowHeight = Math.ceil(80 * Math.max(1, fontScale));
	const name = album?.name ?? media.album?.name ?? "Album";
	function revealCurrentTrack() {
		const key = `${media.albumId}:${focusMediaId}:${Boolean(album)}`;
		if (
			!presented.current ||
			revealed.current === key ||
			focusIndex < 0 ||
			!listRef.current
		)
			return;
		listRef.current.scrollToIndex({
			index: focusIndex,
			animated: false,
			viewPosition: 0.4,
		});
		revealed.current = key;
	}
	function dismissThen(action: () => void) {
		afterDismiss.current = action;
		onClose();
	}

	return (
		<FloatingBottomSheet
			visible={visible}
			onClose={onClose}
			onPresented={() => {
				presented.current = true;
				revealCurrentTrack();
			}}
			onDismissed={() => {
				presented.current = false;
				revealed.current = null;
				const action = afterDismiss.current;
				afterDismiss.current = null;
				action?.();
			}}
			snapPoints={["78%"]}
			enableDynamicSizing={false}
			scrollableContent
			accessibilityLabel={`Album tracks: ${name}`}
		>
			<View style={{ flex: 1 }}>
				<View className="flex-row items-center gap-3 px-5 pb-3">
					<View className="min-w-0 flex-1">
						<Text
							accessibilityRole="header"
							numberOfLines={2}
							className="text-lg font-bold text-foreground"
						>
							{name}
						</Text>
						<Text className="mt-1 text-xs text-muted-foreground">
							{album ? `${tracks.length} tracks` : "Album tracks"}
						</Text>
					</View>
					<Pressable
						onPress={onClose}
						accessibilityRole="button"
						accessibilityLabel="Close album tracks"
						className="size-11 items-center justify-center rounded-full bg-muted"
					>
						<Icon name="X" size={20} color={colors.foreground} />
					</Pressable>
				</View>
				{isError ? (
					<View className="flex-row items-center justify-between px-5 pb-2">
						<Text className="flex-1 text-sm text-muted-foreground">
							{album ? "Couldn’t refresh album" : "Couldn’t load other tracks"}
						</Text>
						<Pressable
							onPress={() => void refetch()}
							disabled={isFetching}
							accessibilityRole="button"
							className="min-h-11 justify-center px-3"
						>
							<Text
								className={
									isFetching
										? "text-muted-foreground"
										: "font-semibold text-primary"
								}
							>
								{isFetching ? "Retrying…" : "Retry"}
							</Text>
						</Pressable>
					</View>
				) : isPending ? (
					<View className="flex-row items-center gap-2 px-5 pb-3">
						<ActivityIndicator size="small" color={colors.mutedForeground} />
						<Text className="text-sm text-muted-foreground">
							Loading other tracks…
						</Text>
					</View>
				) : null}
				<BottomSheetFlatList
					ref={listRef}
					style={{ flex: 1 }}
					onLayout={revealCurrentTrack}
					onContentSizeChange={revealCurrentTrack}
					key={`${media.albumId}:${focusMediaId}:${album ? "ready" : "preview"}`}
					data={tracks}
					keyExtractor={(track: Track | CurrentMedia) => String(track.id)}
					initialScrollIndex={Math.max(0, focusIndex - 1)}
					getItemLayout={(_, index) => ({
						length: rowHeight,
						offset: rowHeight * index,
						index,
					})}
					contentContainerStyle={{ paddingBottom: 8 }}
					ListEmptyComponent={
						<Text className="p-5 text-muted-foreground">
							No audio in this album yet.
						</Text>
					}
					renderItem={({
						item,
						index,
					}: { item: Track | CurrentMedia; index: number }) => {
						const isCurrent = item.id === focusMediaId;
						const customTitle = hasCustomAudioTitle({ media: item });
						const title =
							item.titleOverride?.trim() ||
							item.title ||
							item.file?.fileName ||
							"Untitled audio";
						return (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`${isCurrent ? "Current track. " : ""}${customTitle ? "Custom title. " : ""}${title}`}
								accessibilityState={{ selected: isCurrent }}
								onPress={() => {
									if (item.id === media.id) return onClose();
									if (!("blog" in item) || !item.blog?.id) return;
									rememberAudioDetailFromMedia(item, album);
									const blogId = item.blog.id;
									dismissThen(() =>
										router.replace({
											pathname: "/blog-view-2/[blogId]",
											params: { blogId: String(blogId), autoPlay: "1" },
										}),
									);
								}}
								style={{
									height: rowHeight,
									flexDirection: "row",
									alignItems: "center",
									paddingHorizontal: 20,
									gap: 12,
									borderTopWidth: 1,
									borderTopColor: colors.border,
									backgroundColor: isCurrent
										? withAlpha(colors.primary, 0.08)
										: "transparent",
								}}
							>
								<View className="w-8 items-center">
									{isCurrent ? (
										<Icon name="AudioLines" size={20} color={colors.primary} />
									) : (
										<Text className="text-xs text-muted-foreground">
											{item.albumAudioIndex?.index ?? index + 1}
										</Text>
									)}
								</View>
								<View className="min-w-0 flex-1">
									<Text
										numberOfLines={2}
										style={{
											color: customTitle
												? colors.customAudioTitle
												: colors.foreground,
											fontSize: 14,
											lineHeight: 21,
											fontWeight: isCurrent ? "700" : "500",
											textAlign: /[\u0590-\u08ff]/.test(title)
												? "right"
												: "left",
										}}
									>
										{title}
									</Text>
									<Text className="mt-1 text-xs text-muted-foreground">
										{[
											isCurrent ? "Current track" : null,
											item.file?.duration
												? minuteToString(item.file.duration)
												: null,
										]
											.filter(Boolean)
											.join(" · ")}
									</Text>
								</View>
							</Pressable>
						);
					}}
				/>
				<View className="px-5 pb-5 pt-3">
					<Pressable
						accessibilityRole="button"
						onPress={() =>
							dismissThen(() =>
								router.push({
									pathname: "/albums/[albumId]",
									params: {
										albumId: String(media.albumId),
										focusMediaId: String(focusMediaId),
										focusRequest: String(Date.now()),
									},
								}),
							)
						}
						className="min-h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary px-5 py-3"
					>
						<Text className="font-semibold text-primary-foreground">
							Open full album
						</Text>
						<Icon
							name="Fullscreen"
							size={18}
							color={colors.primaryForeground}
						/>
					</Pressable>
				</View>
			</View>
		</FloatingBottomSheet>
	);
}
