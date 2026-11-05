import { useFloatingFooterInset } from "@/components/floating-footer";
import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { FlatList } from "@/components/ui/scroll-surfaces";
import { useColors } from "@/hooks/use-color";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DestinationEditor } from "./destination-editor";
import { useReviewDraft } from "./use-review-draft";

type Run = RouterOutputs["album"]["getAutomaticIndexRun"];
type Suggestion = Run["albumSuggestions"][number];
const title = (suggestion: Suggestion) =>
	suggestion.album?.name ||
	suggestion.proposedAlbumName ||
	suggestion.albumNameSnapshot ||
	"New album";
const selectable = (
	item: Suggestion["mediaSuggestions"][number],
	albumId?: number | null,
) =>
	["pending", "failed"].includes(item.status) &&
	item.media != null &&
	(item.media.albumId == null || item.media.albumId === albumId);
const formatAudioDate = (value: string | Date | null | undefined) =>
	value
		? new Date(value).toLocaleDateString(undefined, {
				day: "numeric",
				month: "short",
				year: "numeric",
			})
		: "Date unavailable";

export function AlbumOrganizerSuggestionScreen() {
	const {
		channelId: channelParam,
		runId: runParam,
		suggestionId: suggestionParam,
	} = useLocalSearchParams();
	const channelId = Number(channelParam);
	const runId = Number(runParam);
	const [currentId, setCurrentId] = useState(Number(suggestionParam));
	useEffect(() => {
		setCurrentId(Number(suggestionParam));
	}, [suggestionParam]);
	const colors = useColors();
	const query = useQuery({
		..._trpc.album.getAutomaticIndexRun.queryOptions({ id: runId }),
		staleTime: 0,
		refetchOnMount: "always",
	});
	const run = query.data;
	const suggestion = run?.albumSuggestions.find(
		(item) => item.id === currentId,
	);
	if (!query.isFetchedAfterMount || query.isError || !run || !suggestion)
		return (
			<SafeArea>
				<View className="flex-1 items-center justify-center gap-4">
					<Text className="text-foreground">
						{query.error?.message ??
							(query.isLoading
								? "Loading album…"
								: "This suggestion is unavailable.")}
					</Text>
					{query.isFetching ? (
						<ActivityIndicator color={colors.primary} />
					) : (
						<Pressable onPress={() => query.refetch()}>
							<Text className="text-primary">Retry</Text>
						</Pressable>
					)}
				</View>
			</SafeArea>
		);
	return (
		<AlbumReview
			key={suggestion.id}
			run={run}
			suggestion={suggestion}
			channelId={channelId}
			onNavigate={setCurrentId}
		/>
	);
}

function AlbumReview({
	run,
	suggestion,
	channelId,
	onNavigate,
}: {
	run: Run;
	suggestion: Suggestion;
	channelId: number;
	onNavigate: (id: number) => void;
}) {
	const router = useRouter();
	const colors = useColors();
	const qc = useQueryClient();
	const insets = useSafeAreaInsets();
	const playerInset = useFloatingFooterInset();
	const [editing, setEditing] = useState(false);
	const [showReason, setShowReason] = useState(false);
	const approveMutation = useMutation(
		_trpc.album.approveOrganizerReview.mutationOptions(),
	);
	const {
		draft,
		change,
		currentDraft,
		persist,
		leave,
		dirty,
		saving,
		saveError,
		setDestination,
	} = useReviewDraft(
		run.id,
		suggestion.id,
		run.review.drafts[String(suggestion.id)] ?? {
			selectedIds: suggestion.mediaSuggestions
				.filter((item) => selectable(item, suggestion.albumId))
				.map((item) => item.id),
			targetAlbumId: suggestion.albumId,
			name: title(suggestion),
		},
		approveMutation.isPending,
	);
	const restoreMutation = useMutation(
		_trpc.album.restoreAutomaticIndexMediaSuggestion.mutationOptions({
			onSuccess: async (_, variables) => {
				change({
					...currentDraft.current,
					selectedIds: [...currentDraft.current.selectedIds, variables.id],
				});
				await qc.invalidateQueries({
					queryKey: _trpc.album.getAutomaticIndexRun.queryKey({ id: run.id }),
				});
			},
			onError: (error) => Alert.alert("Could not restore track", error.message),
		}),
	);
	const approved = suggestion.status === "approved";
	const albums = useQuery(
		_trpc.album.getOrganizerAlbums.queryOptions({ channelId }),
	);
	const channelAlbums = albums.data ?? [];
	const available = suggestion.mediaSuggestions.filter((item) =>
		selectable(item, suggestion.albumId),
	);
	const selected = available.filter((item) =>
		draft.selectedIds.includes(item.id),
	);
	const ordered = [...suggestion.mediaSuggestions].sort(
		(a, b) =>
			new Date(b.media?.blog?.blogDate ?? 0).getTime() -
			new Date(a.media?.blog?.blogDate ?? 0).getTime(),
	);
	const index = run.albumSuggestions.findIndex(
		(item) => item.id === suggestion.id,
	);
	const channelHref = `/album-organizer/${channelId}` as Href;
	const listHref = `/album-organizer/${channelId}/runs/${run.id}` as Href;

	function move(offset: number) {
		const next = run.albumSuggestions[index + offset];
		if (next && !approveMutation.isPending && !editing)
			leave(() => onNavigate(next.id));
	}
	const swipe = Gesture.Pan()
		.enabled(!editing)
		.activeOffsetX([-45, 45])
		.failOffsetY([-20, 20])
		.runOnJS(true)
		.onEnd((event) => {
			if (Math.abs(event.translationX) > 55)
				move(event.translationX < 0 ? 1 : -1);
		});
	async function approve() {
		try {
			await persist();
			const result = await approveMutation.mutateAsync({
				runId: run.id,
				suggestionId: suggestion.id,
				draft: {
					...currentDraft.current,
					selectedIds: selected.map((item) => item.id),
				},
			});
			const nextRun = await qc.fetchQuery({
				..._trpc.album.getAutomaticIndexRun.queryOptions({ id: run.id }),
				staleTime: 0,
			});
			await Promise.all([
				qc.invalidateQueries({
					queryKey: _trpc.album.getAutomaticIndexChannelSummary.queryKey({
						channelId,
					}),
				}),
				qc.invalidateQueries({
					queryKey: _trpc.album.getAutomaticIndexRuns.queryKey(),
				}),
				qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() }),
				qc.invalidateQueries({
					queryKey: _trpc.album.getOrganizerAlbums.queryKey({ channelId }),
				}),
				qc.invalidateQueries({
					queryKey: _trpc.album.getAlbum.queryKey({ id: result.albumId ?? 0 }),
				}),
			]);
			const next = nextRun.albumSuggestions.find(
				(item) => item.id === nextRun.review.currentSuggestionId,
			);
			if (next) onNavigate(next.id);
			else setDestination(() => () => router.replace(listHref));
		} catch (error) {
			Alert.alert(
				"Could not save album",
				error instanceof Error ? error.message : "Retry to save this album.",
			);
		}
	}
	const targetName = draft.targetAlbumId
		? channelAlbums.find((album) => album.id === draft.targetAlbumId)?.name ||
			draft.name
		: draft.name;
	return (
		<View className="flex-1 bg-background">
			<SafeArea>
				<View className="flex-row items-center gap-3 border-b border-border px-4 py-2">
					<Action
						label="Back to suggestions"
						icon="ArrowLeft"
						disabled={approveMutation.isPending}
						onPress={() => leave(() => router.replace(listHref))}
					/>
					<View className="flex-1">
						<Text className="text-lg font-extrabold text-foreground">
							Review album
						</Text>
						<Text className="text-xs text-muted-foreground">
							{run.mediaCount} scanned tracks
						</Text>
					</View>
					<Pressable
						accessibilityRole="button"
						disabled={approveMutation.isPending}
						onPress={() => leave(() => router.replace(channelHref))}
						className="min-h-11 justify-center"
					>
						<Text className="text-xs font-bold text-primary">
							Save for later
						</Text>
					</Pressable>
				</View>
				<View className="flex-row items-center justify-between border-b border-border px-4 py-2">
					<Action
						label="Previous album"
						icon="ChevronLeft"
						disabled={index === 0 || approveMutation.isPending}
						onPress={() => move(-1)}
					/>
					<View className="items-center">
						<Text className="text-sm font-bold text-foreground">
							{index + 1} of {run.albumSuggestions.length}
						</Text>
						<Text className="text-xs text-muted-foreground">
							{formatAudioDate(
								ordered[ordered.length - 1]?.media?.blog?.blogDate,
							)}{" "}
							– {formatAudioDate(ordered[0]?.media?.blog?.blogDate)}
						</Text>
					</View>
					<Action
						label="Next album"
						icon="ChevronRight"
						disabled={
							index === run.albumSuggestions.length - 1 ||
							approveMutation.isPending
						}
						onPress={() => move(1)}
					/>
				</View>
				<GestureDetector gesture={swipe}>
					<View className="flex-1">
						<FlatList
							data={ordered}
							keyExtractor={(item) => String(item.id)}
							keyboardShouldPersistTaps="handled"
							contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
							renderScrollComponent={(props) => (
								<KeyboardAwareScrollView {...props} bottomOffset={90} />
							)}
							ListHeaderComponent={
								<View>
									<View className="gap-3 rounded-2xl border border-border bg-card p-4">
										<View className="flex-row items-center justify-between">
											<Text className="text-xs font-bold text-primary">
												{approved
													? "✓ Saved"
													: draft.targetAlbumId
														? "Existing album"
														: "New album"}
											</Text>
											{!approved ? (
												<Pressable
													accessibilityRole="button"
													disabled={approveMutation.isPending}
													onPress={() => setEditing(!editing)}
													className="min-h-11 justify-center"
												>
													<Text className="text-xs font-bold text-primary">
														Change album
													</Text>
												</Pressable>
											) : null}
										</View>
										<Text className="text-2xl font-bold text-foreground">
											{targetName || "New album"}
										</Text>
										{editing ? (
											<DestinationEditor
												draft={draft}
												change={change}
												saving={approveMutation.isPending}
												channelAlbums={channelAlbums}
												error={albums.error?.message}
												onDone={() => setEditing(false)}
											/>
										) : null}
										<Pressable
											accessibilityRole="button"
											accessibilityState={{ expanded: showReason }}
											onPress={() => setShowReason(!showReason)}
											className="min-h-11 justify-center"
										>
											<Text className="text-xs text-muted-foreground">
												{showReason ? "▾" : "▸"} Why these tracks?
											</Text>
										</Pressable>
										{showReason ? (
											<Text className="text-sm text-muted-foreground">
												{suggestion.reason ||
													"No reason was saved for this suggestion."}
											</Text>
										) : null}
									</View>
									<View className="min-h-12 flex-row items-center justify-between">
										<Text className="text-sm font-bold text-foreground">
											{approved ? "Saved tracks" : "Selected tracks"}
										</Text>
										{!approved ? (
											<Pressable
												disabled={approveMutation.isPending}
												onPress={() =>
													change({
														...draft,
														selectedIds:
															selected.length === available.length
																? []
																: available.map((item) => item.id),
													})
												}
												className="min-h-11 justify-center"
											>
												<Text className="text-xs font-bold text-primary">
													{selected.length === available.length
														? "Clear all"
														: "Select all"}
												</Text>
											</Pressable>
										) : null}
									</View>
								</View>
							}
							renderItem={({ item }) => {
								const checked =
									draft.selectedIds.includes(item.id) ||
									item.status === "approved";
								return (
									<View key={item.id} className="border-b border-border">
										<Pressable
											accessibilityRole="checkbox"
											accessibilityLabel={
												item.media?.title ||
												item.mediaTitleSnapshot ||
												"Untitled audio"
											}
											accessibilityState={{
												checked,
												disabled:
													approved ||
													!selectable(item, suggestion.albumId) ||
													approveMutation.isPending,
											}}
											disabled={
												approved ||
												!selectable(item, suggestion.albumId) ||
												approveMutation.isPending
											}
											onPress={() =>
												change({
													...draft,
													selectedIds: checked
														? draft.selectedIds.filter((id) => id !== item.id)
														: [...draft.selectedIds, item.id],
												})
											}
											className="min-h-16 flex-row items-center gap-3 py-3"
										>
											{checked ? (
												<Icon
													name="CheckCircle2"
													className="text-primary"
													size={21}
												/>
											) : (
												<View className="size-5 rounded-full border border-border" />
											)}
											<View className="flex-1">
												<Text className="text-base font-semibold text-foreground">
													{item.media?.title ||
														item.mediaTitleSnapshot ||
														"Untitled audio"}
												</Text>
												<Text className="text-xs text-muted-foreground">
													{formatAudioDate(item.media?.blog?.blogDate)}
													{item.status === "dismissed"
														? " · Left out"
														: item.media?.albumId && !approved
															? " · Already organized"
															: ""}
												</Text>
												{showReason ? (
													<Text className="text-xs text-muted-foreground">
														{item.reason || "No track reason saved."}
													</Text>
												) : null}
											</View>
										</Pressable>
										{item.status === "dismissed" ? (
											<Pressable
												accessibilityRole="button"
												accessibilityLabel="Restore track"
												disabled={
													restoreMutation.isPending || approveMutation.isPending
												}
												onPress={() => restoreMutation.mutate({ id: item.id })}
												className="min-h-11 justify-center"
											>
												<Text className="text-sm font-bold text-primary">
													Restore track
												</Text>
											</Pressable>
										) : null}
									</View>
								);
							}}
						/>
					</View>
				</GestureDetector>
				{/* The approved review flow keeps Save visible while scrolling through tracks. */}
				<View
					style={{
						paddingBottom: Math.max(insets.bottom, playerInset) + 8,
						paddingHorizontal: 16,
						paddingTop: 10,
						borderTopWidth: 1,
						borderColor: colors.border,
					}}
				>
					{saveError ? (
						<Pressable
							onPress={() => {
								void persist().catch(() => undefined);
							}}
						>
							<Text className="pb-2 text-sm text-destructive">
								Progress could not be saved. Tap to retry.
							</Text>
						</Pressable>
					) : null}
					<Pressable
						accessibilityRole="button"
						disabled={
							approveMutation.isPending ||
							(!approved &&
								(!selected.length ||
									(!draft.targetAlbumId && !draft.name.trim()) ||
									(!!run.scan && !run.scan.complete)))
						}
						onPress={
							approved ? () => leave(() => router.replace(listHref)) : approve
						}
						className="min-h-12 items-center justify-center rounded-xl bg-primary px-4 py-3 disabled:opacity-50"
					>
						{approveMutation.isPending ? (
							<ActivityIndicator color={colors.primaryForeground} />
						) : (
							<Text className="text-base font-extrabold text-primary-foreground">
								{approved
									? "Back to suggestions"
									: `${draft.targetAlbumId ? "Add" : "Create album ·"} ${selected.length} ${selected.length === 1 ? "track" : "tracks"}${draft.targetAlbumId ? " & continue" : ""}`}
							</Text>
						)}
					</Pressable>
					<Text className="pt-1 text-center text-xs text-muted-foreground">
						{dirty || saving
							? "Saving review progress…"
							: "Review progress saved"}
					</Text>
				</View>
			</SafeArea>
		</View>
	);
}

function Action({
	label,
	icon,
	onPress,
	disabled,
}: {
	label: string;
	icon: "ArrowLeft" | "ChevronLeft" | "ChevronRight";
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			disabled={disabled}
			onPress={onPress}
			className="size-11 items-center justify-center rounded-full border border-border disabled:opacity-40"
		>
			<Icon name={icon} className="text-foreground" size={20} />
		</Pressable>
	);
}
