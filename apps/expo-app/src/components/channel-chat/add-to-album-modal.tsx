import {
	BottomSheetSectionList,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Text, View } from "react-native";
import { _trpc } from "@/components/static-trpc";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Toast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-color";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@/lib/react-query";
import { reconcileAudioMembership } from "@/lib/audio-membership-cache";
import { requiresCrossChannelConfirmation } from "@/lib/album-destination";

type Destination = {
	id: number;
	name: string;
	channelId: number | null;
	channel?: { title: string | null; username: string | null } | null;
	_count: { medias: number };
};
type Props = {
	mediaIds: number[];
	authorId?: number;
	onClose: () => void;
	onAdded?: (album: { id: number; name: string }) => void;
};

// Own the sheet as well as its registered scrollable: callers cannot accidentally
// nest an unbounded list in a fixed BottomSheetView or another native Modal.
export function AddToAlbumModal(props: Props) {
	return (
		<FloatingBottomSheet
			visible
			onClose={props.onClose}
			title="Choose album"
			accessibilityLabel="Add to album"
			snapPoints={["82%"]}
			enableDynamicSizing={false}
			scrollableContent
			keyboardBehavior="extend"
			keyboardBlurBehavior="restore"
			androidKeyboardInputMode="adjustResize"
		>
			<AlbumDestinationPicker {...props} />
		</FloatingBottomSheet>
	);
}

function AlbumDestinationPicker({
	mediaIds,
	authorId,
	onClose,
	onAdded,
}: Props) {
	const colors = useColors();
	const client = useQueryClient();
	const [search, setSearch] = useState("");
	const [name, setName] = useState("");
	const [pending, setPending] = useState<Destination | "create" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const submitting = useRef(false);
	const q = useDebouncedValue(search.trim());
	const ids = useMemo(
		() => [...new Set(mediaIds)].sort((a, b) => a - b),
		[mediaIds],
	);
	const context = useQuery(
		_trpc.album.getPickerContext.queryOptions(
			{ mediaIds: ids },
			{ staleTime: 0 },
		),
	);
	const channelIds = useMemo(
		() =>
			[
				...new Set(
					context.data?.flatMap((row) =>
						row.blog?.channelId ? [row.blog.channelId] : [],
					) ?? [],
				),
			].sort((a, b) => a - b),
		[context.data],
	);
	const same = useInfiniteQuery(
		_trpc.album.search.infiniteQueryOptions(
			{ q, channelIds, group: "same", limit: 30 },
			{
				enabled: !!context.data,
				staleTime: 30_000,
				gcTime: 300_000,
				getNextPageParam: (page) => page.cursor,
			},
		),
	);
	const other = useInfiniteQuery(
		_trpc.album.search.infiniteQueryOptions(
			{ q, channelIds, group: "other", limit: 30 },
			{
				enabled: !!context.data,
				staleTime: 30_000,
				gcTime: 300_000,
				getNextPageParam: (page) => page.cursor,
			},
		),
	);
	const add = useMutation(_trpc.album.addMediaToAlbum.mutationOptions());
	const create = useMutation(
		_trpc.album.createAlbumWithMedia.mutationOptions(),
	);
	const busy = add.isPending || create.isPending;
	const sources = context.data?.map((row) => row.blog?.channelId ?? null) ?? [];
	const sections = [
		{
			title: "Existing albums · Same channel",
			key: "same",
			data: same.data?.pages.flatMap((page) => page.data) ?? [],
			query: same,
		},
		{
			title: "From other channels",
			key: "other",
			data: other.data?.pages.flatMap((page) => page.data) ?? [],
			query: other,
		},
	];
	async function save(destination: Destination | "create", confirmed = false) {
		if (!context.data || submitting.current) return;
		const crossChannel =
			destination === "create"
				? new Set(sources).size > 1
				: requiresCrossChannelConfirmation(sources, destination.channelId);
		Keyboard.dismiss();
		if (crossChannel && !confirmed) {
			setPending(destination);
			return;
		}
		submitting.current = true;
		setError(null);
		try {
			const input = {
				mediaIds: ids,
				confirmCrossChannel: confirmed,
				expectedMembership: context.data.map((row) => ({
					mediaId: row.id,
					albumId: row.albumId,
				})),
			};
			let album: { id: number; name: string };
			if (destination === "create")
				album = await create.mutateAsync({
					...input,
					name: name.trim(),
					authorId,
				});
			else {
				await add.mutateAsync({ ...input, albumId: destination.id });
				album = destination;
			}

			await reconcileAudioMembership(client, ids, album);
			onAdded?.(album);
			Toast.show(
				`Added ${ids.length} audio ${ids.length === 1 ? "track" : "tracks"} to ${album.name}`,
				{ type: "success" },
			);
			onClose();
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Could not update the album. Try again.",
			);
		} finally {
			submitting.current = false;
		}
	}
	const inputStyle = {
		color: colors.foreground,
		backgroundColor: colors.muted,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 14,
	};
	return (
		<View style={{ flex: 1 }}>
			{pending ? (
				<View className="px-5 pb-3 gap-3">
					<Text className="text-lg font-bold text-foreground">
						Add audio from another channel?
					</Text>
					<Text className="text-sm text-muted-foreground">
						{ids.length} selected.{" "}
						{pending === "create"
							? `Create “${name.trim()}” with audio from multiple channels.`
							: `Add to “${pending.name}” in ${pending.channel?.title || pending.channel?.username || "an unassigned channel"}.`}{" "}
						The original source channels stay unchanged. Source:{" "}
						{Array.from(
							new Set(
								context.data?.map(
									(row) =>
										row.blog?.channel?.title ||
										row.blog?.channel?.username ||
										"No channel",
								),
							),
						).join(", ")}
						.
					</Text>
					<View className="flex-row gap-2">
						<Pressable
							disabled={busy}
							className="min-h-12 flex-1 items-center justify-center rounded-xl bg-muted"
							onPress={() => setPending(null)}
						>
							<Text className="text-foreground font-semibold">Back</Text>
						</Pressable>
						<Pressable
							disabled={busy}
							className="min-h-12 flex-1 items-center justify-center rounded-xl bg-primary"
							onPress={() => void save(pending, true)}
						>
							<Text className="text-primary-foreground font-semibold">
								{busy ? "Adding…" : "Confirm add"}
							</Text>
						</Pressable>
					</View>
				</View>
			) : (
				<View className="px-4 pb-3 gap-2">
					<BottomSheetTextInput
						accessibilityLabel="Search albums"
						placeholder="Search albums…"
						placeholderTextColor={colors.mutedForeground}
						value={search}
						onChangeText={setSearch}
						maxLength={500}
						style={inputStyle}
					/>
					<View className="flex-row gap-2">
						<View className="flex-1">
							<BottomSheetTextInput
								accessibilityLabel="New album name"
								placeholder="New album name…"
								placeholderTextColor={colors.mutedForeground}
								value={name}
								onChangeText={setName}
								maxLength={180}
								style={inputStyle}
							/>
						</View>
						<Pressable
							accessibilityLabel="Create album and add audio"
							disabled={!name.trim() || busy || !context.data}
							className={`min-h-12 justify-center px-4 rounded-xl bg-primary ${!name.trim() || busy || !context.data ? "opacity-50" : ""}`}
							onPress={() => void save("create")}
						>
							<Text className="text-primary-foreground font-semibold">
								Create
							</Text>
						</Pressable>
					</View>
				</View>
			)}
			{error || context.error ? (
				<View className="px-4 pb-3 gap-2">
					<Text accessibilityRole="alert" className="text-destructive">
						{error || context.error?.message}
					</Text>
					<Pressable
						onPress={() => {
							setError(null);
							void context.refetch();
						}}
						className="py-2"
					>
						<Text className="text-primary">Refresh album membership</Text>
					</Pressable>
				</View>
			) : null}
			{context.isPending ? <ActivityIndicator color={colors.primary} /> : null}
			<BottomSheetSectionList<Destination>
				sections={pending ? [] : sections}
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
				keyExtractor={(item) => String(item.id)}
				stickySectionHeadersEnabled={false}
				renderSectionHeader={({ section }) => (
					<Text className="pt-4 pb-2 text-sm font-bold text-muted-foreground">
						{section.title}
					</Text>
				)}
				renderSectionFooter={({ section }) => (
					<View className="py-2">
						{section.query.isFetching ? (
							<ActivityIndicator color={colors.primary} />
						) : section.query.error ? (
							<Pressable
								onPress={() => void section.query.refetch()}
								className="py-3"
							>
								<Text className="text-destructive">
									Could not load albums. Retry
								</Text>
							</Pressable>
						) : section.data.length === 0 ? (
							<Text className="text-muted-foreground py-2">
								No matching albums
							</Text>
						) : null}
						{section.query.hasNextPage && !section.query.isFetching ? (
							<Pressable
								onPress={() => void section.query.fetchNextPage()}
								className="py-3"
							>
								<Text className="text-primary font-semibold">
									Load more albums
								</Text>
							</Pressable>
						) : null}
					</View>
				)}
				renderItem={({ item }) => (
					<Pressable
						disabled={busy || !context.data}
						onPress={() => void save(item)}
						className="min-h-20 py-3 flex-row items-center gap-3 border-b border-border"
					>
						<View className="size-11 rounded-xl bg-muted items-center justify-center">
							<Icon name="Disc3" size={22} className="text-primary" />
						</View>
						<View className="flex-1">
							<Text className="font-semibold text-foreground" numberOfLines={2}>
								{item.name}
							</Text>
							<Text
								className="text-xs text-muted-foreground mt-1"
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
			<Pressable
				disabled={busy}
				onPress={onClose}
				className="mx-4 mb-4 min-h-12 rounded-xl bg-muted items-center justify-center"
			>
				<Text className="text-foreground font-semibold">
					{busy ? "Saving…" : "Cancel"}
				</Text>
			</Pressable>
		</View>
	);
}
