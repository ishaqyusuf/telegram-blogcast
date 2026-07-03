import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import {
	type AlbumOrganizerModel,
	useAppSettingsStore,
} from "@/store/app-settings-store";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";

type Channel = RouterOutputs["channel"]["getChannels"][number];
type AlbumIndexRun = RouterOutputs["album"]["getAutomaticIndexRun"];
type AlbumSuggestion = AlbumIndexRun["albumSuggestions"][number];
type MediaSuggestion = AlbumSuggestion["mediaSuggestions"][number];

const ALBUM_ORGANIZER_MODELS: {
	id: AlbumOrganizerModel;
	label: string;
	description: string;
}[] = [
	{
		id: "deepseek",
		label: "DeepSeek",
		description: "Low-cost default for broad album indexing.",
	},
	{
		id: "gemini",
		label: "Gemini",
		description: "Fast Google model for alternate discovery passes.",
	},
	{
		id: "openai",
		label: "OpenAI",
		description: "OpenAI model for another judgment pass.",
	},
];

const CHANNEL_COLORS = [
	"#1e40af",
	"#0f766e",
	"#b45309",
	"#4f46e5",
	"#be123c",
	"#0369a1",
	"#7c3aed",
	"#334155",
];

function parseRouteId(value: string | string[] | undefined) {
	const raw = Array.isArray(value) ? value[0] : value;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : 0;
}

function routeHref(value: string) {
	return value as Href;
}

function formatCount(value: number | null | undefined) {
	return new Intl.NumberFormat().format(value ?? 0);
}

function formatDate(value: string | Date | null | undefined) {
	if (!value) return "Not available";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return date.toLocaleString();
}

function getInitials(value?: string | null) {
	if (!value) return "AL";
	return value
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function getChannelLabel(channel?: {
	title?: string | null;
	username?: string | null;
}) {
	return (
		channel?.title || (channel?.username ? `@${channel.username}` : "Channel")
	);
}

function statusLabel(status?: string | null) {
	switch (status) {
		case "running":
			return "Running";
		case "generated":
			return "Ready";
		case "partially-approved":
		case "partial":
			return "Partial";
		case "approved":
			return "Approved";
		case "dismissed":
			return "Removed";
		case "failed":
			return "Failed";
		case "pending":
			return "Pending";
		default:
			return "Saved";
	}
}

function providerLabel(provider?: string | null) {
	switch (provider) {
		case "deepseek":
			return "DeepSeek";
		case "gemini":
			return "Gemini";
		case "openai":
			return "OpenAI";
		default:
			return provider || "AI";
	}
}

function formatRunModel(value?: {
	provider?: string | null;
	model?: string | null;
}) {
	if (!value?.provider && !value?.model) return "Model unknown";
	if (!value.model) return providerLabel(value.provider);
	return `${providerLabel(value.provider)} · ${value.model}`;
}

function formatRunSubtitle(value?: {
	createdAt?: string | Date | null;
	provider?: string | null;
	model?: string | null;
}) {
	if (!value) return undefined;
	return `${formatDate(value.createdAt)} · ${formatRunModel(value)}`;
}

function Header({
	title,
	subtitle,
}: {
	title: string;
	subtitle?: string;
}) {
	const router = useRouter();
	return (
		<View className="flex-row items-center gap-3 px-4 py-3">
			<Pressable
				onPress={() => router.back()}
				className="size-10 items-center justify-center rounded-full active:bg-muted"
			>
				<Icon name="ArrowLeft" className="text-foreground" />
			</Pressable>
			<View className="flex-1">
				<Text className="text-xl font-extrabold text-foreground">{title}</Text>
				{subtitle ? (
					<Text className="text-xs text-muted-foreground" numberOfLines={1}>
						{subtitle}
					</Text>
				) : null}
			</View>
		</View>
	);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<View className="flex-1 gap-1 rounded-xl bg-card p-4">
			<Text className="text-xs font-semibold text-muted-foreground">
				{label}
			</Text>
			<Text className="text-2xl font-extrabold text-foreground">{value}</Text>
		</View>
	);
}

function ChannelRow({
	channel,
	index,
	onPress,
}: {
	channel: Channel;
	index: number;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="overflow-hidden rounded-xl bg-card active:opacity-80"
		>
			<View className="flex-row items-center gap-3 p-3">
				<View
					style={{
						width: 48,
						height: 48,
						borderRadius: 8,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
					}}
				>
					<Text className="text-base font-bold text-white">
						{getInitials(channel.title ?? channel.username)}
					</Text>
				</View>
				<View className="flex-1 gap-0.5">
					<Text className="text-sm font-bold text-foreground" numberOfLines={1}>
						{getChannelLabel(channel)}
					</Text>
					<Text className="text-xs text-muted-foreground" numberOfLines={1}>
						@{channel.username}
					</Text>
					<Text className="text-[10px] text-muted-foreground">
						{channel.stats.totalBlogs} posts
					</Text>
				</View>
				<Icon name="ChevronRight" size={18} className="text-muted-foreground" />
			</View>
		</Pressable>
	);
}

function countMediaByStatus(suggestion: AlbumSuggestion, status: string) {
	return suggestion.mediaSuggestions.filter((item) => item.status === status)
		.length;
}

function activeMediaCount(suggestion: AlbumSuggestion) {
	return suggestion.mediaSuggestions.filter(
		(item) => item.status !== "dismissed",
	).length;
}

function getMediaTitle(row: MediaSuggestion) {
	return row.media?.title || row.mediaTitleSnapshot || "Untitled audio";
}

function isProposedSuggestion(suggestion?: AlbumSuggestion | null) {
	return (
		suggestion?.suggestionType === "proposed_album" || !suggestion?.albumId
	);
}

function getSuggestionTitle(suggestion?: AlbumSuggestion | null) {
	return (
		suggestion?.album?.name ||
		suggestion?.albumNameSnapshot ||
		suggestion?.proposedAlbumName ||
		"New album"
	);
}

function canSelectMedia(row: MediaSuggestion) {
	return row.status === "pending" || row.status === "failed";
}

export function AlbumOrganizerChannelsScreen() {
	const router = useRouter();
	const colors = useColors();
	const {
		data: channels = [],
		isFetching,
		refetch,
	} = useQuery(_trpc.channel.getChannels.queryOptions());

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				<Header title="Album Organizer" subtitle="Choose a channel" />
				<FlatList
					style={{ backgroundColor: colors.background }}
					data={channels}
					keyExtractor={(item) => String(item.id)}
					contentContainerClassName="gap-2 px-4 pb-8"
					refreshControl={
						<RefreshControl refreshing={isFetching} onRefresh={refetch} />
					}
					renderItem={({ item, index }) => (
						<ChannelRow
							channel={item}
							index={index}
							onPress={() =>
								router.push(routeHref(`/album-organizer/${item.id}`))
							}
						/>
					)}
					ListEmptyComponent={
						<View className="items-center justify-center py-20">
							{isFetching ? (
								<ActivityIndicator color={colors.primary} />
							) : (
								<Icon
									name="Radio"
									size={44}
									className="mb-3 text-muted-foreground"
								/>
							)}
							<Text className="text-sm text-muted-foreground">
								{isFetching ? "Loading channels" : "No channels"}
							</Text>
						</View>
					}
				/>
			</SafeArea>
		</View>
	);
}

export function AlbumOrganizerChannelScreen() {
	const router = useRouter();
	const colors = useColors();
	const qc = useQueryClient();
	const params = useLocalSearchParams();
	const channelId = parseRouteId(params.channelId);
	const albumOrganizerModel = useAppSettingsStore(
		(state) => state.albumOrganizerModel,
	);
	const setAlbumOrganizerModel = useAppSettingsStore(
		(state) => state.setAlbumOrganizerModel,
	);
	const selectedModel = ALBUM_ORGANIZER_MODELS.find(
		(model) => model.id === albumOrganizerModel,
	);
	const summaryQuery = useQuery({
		..._trpc.album.getAutomaticIndexChannelSummary.queryOptions({ channelId }),
		enabled: channelId > 0,
	});
	const runsQuery = useQuery({
		..._trpc.album.getAutomaticIndexRuns.queryOptions({ channelId, limit: 20 }),
		enabled: channelId > 0,
	});
	const isRefreshing = summaryQuery.isFetching || runsQuery.isFetching;
	const refreshChannel = () => {
		void Promise.all([summaryQuery.refetch(), runsQuery.refetch()]);
	};
	const latestRun = summaryQuery.data?.latestRun;
	const hasSavedRun = Boolean(latestRun?.id);
	const { mutate: generateIndex, isPending: isGenerating } = useMutation(
		_trpc.album.generateAutomaticIndex.mutationOptions({
			onSuccess: async (run) => {
				await Promise.all([
					qc.invalidateQueries({
						queryKey: _trpc.album.getAutomaticIndexChannelSummary.queryKey({
							channelId,
						}),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.album.getAutomaticIndexRuns.queryKey({
							channelId,
							limit: 20,
						}),
					}),
				]);
				router.push(routeHref(`/album-organizer/${channelId}/runs/${run.id}`));
			},
			onError: (error) => Alert.alert("Could not generate", error.message),
		}),
	);

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				<Header
					title="Album Organizer"
					subtitle={getChannelLabel(summaryQuery.data?.channel)}
				/>
				<ScrollView
					style={{ backgroundColor: colors.background }}
					contentContainerClassName="gap-4 px-4 pb-10"
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={refreshChannel}
						/>
					}
				>
					<View className="gap-2 rounded-xl bg-card p-4">
						<View className="flex-row items-center gap-3">
							<View className="size-11 items-center justify-center rounded-xl bg-primary/15">
								<Icon name="Sparkles" size={22} className="text-primary" />
							</View>
							<View className="flex-1">
								<Text className="text-base font-extrabold text-foreground">
									{getChannelLabel(summaryQuery.data?.channel)}
								</Text>
								<Text className="text-xs text-muted-foreground">
									Review generated album discoveries before adding tracks.
								</Text>
							</View>
						</View>
					</View>

					<View className="flex-row gap-3">
						<StatCard
							label="Audio not in album"
							value={
								summaryQuery.isFetching
									? "..."
									: formatCount(summaryQuery.data?.unalbumedAudioCount)
							}
						/>
						<StatCard
							label="Albums"
							value={
								summaryQuery.isFetching
									? "..."
									: formatCount(summaryQuery.data?.albumCount)
							}
						/>
					</View>

					<View className="gap-3 rounded-xl bg-card p-4">
						<View className="flex-row items-center gap-3">
							<View className="size-10 items-center justify-center rounded-xl bg-secondary">
								<Icon name="Sparkles" size={18} className="text-foreground" />
							</View>
							<View className="flex-1">
								<Text className="text-sm font-extrabold text-foreground">
									Model
								</Text>
								<Text className="text-xs text-muted-foreground">
									Used for the next generated discovery run.
								</Text>
							</View>
						</View>
						<View className="flex-row gap-2">
							{ALBUM_ORGANIZER_MODELS.map((model) => {
								const selected = albumOrganizerModel === model.id;
								return (
									<Pressable
										key={model.id}
										disabled={isGenerating}
										onPress={() => setAlbumOrganizerModel(model.id)}
										className={
											selected
												? "flex-1 items-center rounded-lg bg-primary px-2 py-3"
												: "flex-1 items-center rounded-lg bg-secondary px-2 py-3"
										}
										style={{ opacity: isGenerating ? 0.6 : 1 }}
									>
										<Text
											className={
												selected
													? "text-xs font-extrabold text-primary-foreground"
													: "text-xs font-extrabold text-foreground"
											}
											numberOfLines={1}
										>
											{model.label}
										</Text>
									</Pressable>
								);
							})}
						</View>
						<Text className="text-xs text-muted-foreground">
							{selectedModel?.description}
						</Text>
					</View>

					<Pressable
						disabled={isGenerating || summaryQuery.isFetching}
						onPress={() => {
							if (latestRun?.id) {
								router.push(
									routeHref(
										`/album-organizer/${channelId}/runs/${latestRun.id}`,
									),
								);
								return;
							}
							generateIndex({ channelId, provider: albumOrganizerModel });
						}}
						className="flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 active:opacity-80"
						style={{ opacity: isGenerating ? 0.55 : 1 }}
					>
						{isGenerating ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Icon name={hasSavedRun ? "FolderOpen" : "Sparkles"} size={18} />
						)}
						<Text className="text-sm font-extrabold text-primary-foreground">
							{isGenerating
								? "Finding discoveries..."
								: hasSavedRun
									? "Open saved discoveries"
									: "Proceed"}
						</Text>
					</Pressable>

					{hasSavedRun ? (
						<Pressable
							disabled={isGenerating}
							onPress={() =>
								generateIndex({ channelId, provider: albumOrganizerModel })
							}
							className="flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 active:opacity-80"
							style={{ opacity: isGenerating ? 0.55 : 1 }}
						>
							<Icon name="RefreshCw" size={16} className="text-foreground" />
							<Text className="text-sm font-bold text-foreground">
								Run again
							</Text>
						</Pressable>
					) : null}

					<View className="gap-2">
						<Text className="text-sm font-extrabold text-foreground">
							Saved discoveries
						</Text>
						{runsQuery.data?.length ? (
							runsQuery.data.map((run) => (
								<Pressable
									key={run.id}
									onPress={() =>
										router.push(
											routeHref(`/album-organizer/${channelId}/runs/${run.id}`),
										)
									}
									className="flex-row items-center gap-3 rounded-xl bg-card p-4 active:opacity-80"
								>
									<View className="size-10 items-center justify-center rounded-xl bg-secondary">
										<Icon name="Disc3" size={18} className="text-foreground" />
									</View>
									<View className="flex-1">
										<Text className="text-sm font-bold text-foreground">
											{statusLabel(run.status)} discovery
										</Text>
										<Text className="text-xs text-muted-foreground">
											{run._count.albumSuggestions} albums ·{" "}
											{run.suggestionCount} tracks · {formatDate(run.createdAt)}
										</Text>
										<Text className="text-xs text-muted-foreground">
											{formatRunModel(run)}
										</Text>
									</View>
									<Icon
										name="ChevronRight"
										size={18}
										className="text-muted-foreground"
									/>
								</Pressable>
							))
						) : (
							<View className="rounded-xl bg-card p-4">
								<Text className="text-sm text-muted-foreground">
									No saved discoveries yet.
								</Text>
							</View>
						)}
					</View>
				</ScrollView>
			</SafeArea>
		</View>
	);
}

export function AlbumOrganizerRunScreen() {
	const router = useRouter();
	const colors = useColors();
	const params = useLocalSearchParams();
	const channelId = parseRouteId(params.channelId);
	const runId = parseRouteId(params.runId);
	const runQuery = useQuery({
		..._trpc.album.getAutomaticIndexRun.queryOptions({ id: runId }),
		enabled: runId > 0,
	});
	const suggestions = runQuery.data?.albumSuggestions ?? [];

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				<Header
					title="Discoveries"
					subtitle={formatRunSubtitle(runQuery.data)}
				/>
				<FlatList
					style={{ backgroundColor: colors.background }}
					data={suggestions}
					keyExtractor={(item) => String(item.id)}
					contentContainerClassName="gap-2 px-4 pb-10"
					refreshControl={
						<RefreshControl
							refreshing={runQuery.isFetching}
							onRefresh={runQuery.refetch}
						/>
					}
					renderItem={({ item }) => {
						const pending = countMediaByStatus(item, "pending");
						const approved = countMediaByStatus(item, "approved");
						const active = activeMediaCount(item);
						const proposed = isProposedSuggestion(item);
						return (
							<Pressable
								onPress={() =>
									router.push(
										routeHref(
											`/album-organizer/${channelId}/runs/${runId}/albums/${item.id}`,
										),
									)
								}
								className="flex-row items-center gap-3 rounded-xl bg-card p-4 active:opacity-80"
							>
								<View className="size-12 items-center justify-center rounded-xl bg-primary/15">
									<Text className="text-sm font-extrabold text-primary">
										{getInitials(getSuggestionTitle(item))}
									</Text>
								</View>
								<View className="flex-1 gap-1">
									<Text className="text-sm font-extrabold text-foreground">
										{getSuggestionTitle(item)}
									</Text>
									<Text className="text-xs text-muted-foreground">
										{active} tracks · {pending} pending · {approved} approved
									</Text>
								</View>
								<View className="items-end gap-1">
									{proposed ? (
										<Text className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary">
											New album
										</Text>
									) : null}
									<Text className="text-[10px] font-bold text-muted-foreground">
										{statusLabel(item.status)}
									</Text>
									<Icon
										name="ChevronRight"
										size={18}
										className="text-muted-foreground"
									/>
								</View>
							</Pressable>
						);
					}}
					ListEmptyComponent={
						<View className="items-center justify-center py-20">
							{runQuery.isFetching ? (
								<ActivityIndicator color={colors.primary} />
							) : (
								<Icon
									name="SearchX"
									size={44}
									className="mb-3 text-muted-foreground"
								/>
							)}
							<Text className="text-sm text-muted-foreground">
								{runQuery.isFetching ? "Loading discoveries" : "No discoveries"}
							</Text>
						</View>
					}
				/>
			</SafeArea>
		</View>
	);
}

export function AlbumOrganizerSuggestionScreen() {
	const colors = useColors();
	const qc = useQueryClient();
	const params = useLocalSearchParams();
	const channelId = parseRouteId(params.channelId);
	const runId = parseRouteId(params.runId);
	const suggestionId = parseRouteId(params.suggestionId);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const runQuery = useQuery({
		..._trpc.album.getAutomaticIndexRun.queryOptions({ id: runId }),
		enabled: runId > 0,
	});
	const suggestion = useMemo(
		() =>
			runQuery.data?.albumSuggestions.find(
				(item) => item.id === suggestionId,
			) ?? null,
		[runQuery.data, suggestionId],
	);
	const proposed = isProposedSuggestion(suggestion);
	const [proposedName, setProposedName] = useState("");
	const [proposedType, setProposedType] = useState("series");
	const selectableRows = useMemo(
		() => suggestion?.mediaSuggestions.filter(canSelectMedia) ?? [],
		[suggestion],
	);
	const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
	const canApproveSuggestion = !proposed || proposedName.trim().length > 0;

	useEffect(() => {
		setProposedName(
			suggestion?.proposedAlbumName ||
				suggestion?.albumNameSnapshot ||
				(suggestion ? getSuggestionTitle(suggestion) : ""),
		);
		setProposedType(suggestion?.proposedAlbumType || "series");
	}, [suggestion]);

	const invalidate = async (albumId?: number | null) => {
		const targetAlbumId = albumId ?? suggestion?.albumId;
		await Promise.all([
			qc.invalidateQueries({
				queryKey: _trpc.album.getAutomaticIndexRun.queryKey({ id: runId }),
			}),
			qc.invalidateQueries({
				queryKey: _trpc.album.getAutomaticIndexRuns.queryKey({
					channelId,
					limit: 20,
				}),
			}),
			qc.invalidateQueries({
				queryKey: _trpc.album.getAutomaticIndexChannelSummary.queryKey({
					channelId,
				}),
			}),
			qc.invalidateQueries({ queryKey: _trpc.album.getAlbums.queryKey() }),
			...(targetAlbumId
				? [
						qc.invalidateQueries({
							queryKey: _trpc.album.getAlbum.queryKey({
								id: targetAlbumId,
							}),
						}),
					]
				: []),
		]);
	};

	const approveMutation = useMutation(
		_trpc.album.approveAutomaticIndexAlbumSuggestion.mutationOptions({
			onSuccess: async (result) => {
				await invalidate(result.albumId);
				setSelectedIds(new Set());
				Alert.alert(
					"Approved",
					`${result.added} added · ${result.alreadyAdded} already in album · ${result.failed} failed`,
				);
			},
			onError: (error) => Alert.alert("Could not approve", error.message),
		}),
	);
	const dismissMutation = useMutation(
		_trpc.album.dismissAutomaticIndexMediaSuggestion.mutationOptions({
			onSuccess: async () => {
				await invalidate();
			},
			onError: (error) => Alert.alert("Could not remove", error.message),
		}),
	);
	const restoreMutation = useMutation(
		_trpc.album.restoreAutomaticIndexMediaSuggestion.mutationOptions({
			onSuccess: async () => {
				await invalidate();
			},
			onError: (error) => Alert.alert("Could not restore", error.message),
		}),
	);

	function toggleSelection(id: number) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function approve(ids?: number[]) {
		if (!suggestion || !canApproveSuggestion) return;
		approveMutation.mutate({
			suggestionId: suggestion.id,
			mediaSuggestionIds: ids,
			proposedAlbumName: proposed ? proposedName.trim() : undefined,
			proposedAlbumType: proposed ? proposedType.trim() || "series" : undefined,
		});
	}

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				<Header
					title={getSuggestionTitle(suggestion)}
					subtitle={
						suggestion
							? `${activeMediaCount(suggestion)} discovered tracks`
							: undefined
					}
				/>
				{proposed ? (
					<View className="gap-3 px-4 pb-3">
						<View className="gap-3 rounded-xl bg-card p-4">
							<View className="flex-row items-center gap-3">
								<View className="size-10 items-center justify-center rounded-xl bg-primary/15">
									<Icon name="FolderPlus" size={18} className="text-primary" />
								</View>
								<View className="flex-1">
									<Text className="text-sm font-extrabold text-foreground">
										New album
									</Text>
									<Text className="text-xs text-muted-foreground">
										This album will be created when approved.
									</Text>
								</View>
							</View>
							<View className="gap-2">
								<Text className="text-xs font-bold text-muted-foreground">
									Album name
								</Text>
								<TextInput
									value={proposedName}
									onChangeText={setProposedName}
									placeholder="Album name"
									placeholderTextColor={colors.mutedForeground}
									className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground"
								/>
							</View>
							<View className="gap-2">
								<Text className="text-xs font-bold text-muted-foreground">
									Type
								</Text>
								<TextInput
									value={proposedType}
									onChangeText={setProposedType}
									placeholder="series"
									placeholderTextColor={colors.mutedForeground}
									className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground"
								/>
							</View>
						</View>
					</View>
				) : null}
				<View className="flex-row gap-2 px-4 pb-3">
					<Pressable
						disabled={selectableRows.length === 0}
						onPress={() => {
							if (selectedIds.size === selectableRows.length) {
								setSelectedIds(new Set());
								return;
							}
							setSelectedIds(new Set(selectableRows.map((item) => item.id)));
						}}
						className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-3"
						style={{ opacity: selectableRows.length === 0 ? 0.45 : 1 }}
					>
						<Icon name="CheckCheck" size={16} className="text-foreground" />
						<Text className="text-xs font-bold text-foreground">
							{selectedIds.size === selectableRows.length
								? "Clear"
								: "Mark all"}
						</Text>
					</Pressable>
					<Pressable
						disabled={
							approveMutation.isPending ||
							selectableRows.length === 0 ||
							!canApproveSuggestion
						}
						onPress={() =>
							approve(selectedArray.length ? selectedArray : undefined)
						}
						className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3"
						style={{
							opacity:
								approveMutation.isPending ||
								selectableRows.length === 0 ||
								!canApproveSuggestion
									? 0.5
									: 1,
						}}
					>
						{approveMutation.isPending ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Icon name="Plus" size={16} />
						)}
						<Text className="text-xs font-extrabold text-primary-foreground">
							{selectedArray.length
								? `Add ${selectedArray.length}`
								: "Add pending"}
						</Text>
					</Pressable>
				</View>

				<FlatList
					style={{ backgroundColor: colors.background }}
					data={suggestion?.mediaSuggestions ?? []}
					keyExtractor={(item) => String(item.id)}
					contentContainerClassName="gap-2 px-4 pb-10"
					refreshControl={
						<RefreshControl
							refreshing={runQuery.isFetching}
							onRefresh={runQuery.refetch}
						/>
					}
					renderItem={({ item }) => {
						const selected = selectedIds.has(item.id);
						const selectable = canSelectMedia(item);
						return (
							<Pressable
								onPress={() => selectable && toggleSelection(item.id)}
								className={
									selected
										? "rounded-xl border border-primary bg-primary/10 p-3"
										: "rounded-xl border border-border bg-card p-3"
								}
								style={{ opacity: item.status === "dismissed" ? 0.55 : 1 }}
							>
								<View className="flex-row items-center gap-3">
									<View className="size-9 items-center justify-center rounded-full bg-secondary">
										<Icon
											name={
												item.status === "approved"
													? "Check"
													: selected
														? "CheckCircle2"
														: "Music2"
											}
											size={16}
											className="text-foreground"
										/>
									</View>
									<View className="flex-1 gap-1">
										<Text className="text-sm font-bold text-foreground">
											{getMediaTitle(item)}
										</Text>
										<Text className="text-xs text-muted-foreground">
											{statusLabel(item.status)}
											{item.media?.albumId
												? ` · already in album #${item.media.albumId}`
												: ""}
										</Text>
									</View>
									{item.status === "dismissed" ? (
										<Pressable
											disabled={restoreMutation.isPending}
											onPress={() => restoreMutation.mutate({ id: item.id })}
											className="size-10 items-center justify-center rounded-full bg-secondary"
										>
											<Icon
												name="RefreshCw"
												size={16}
												className="text-foreground"
											/>
										</Pressable>
									) : item.status === "approved" ? null : (
										<View className="flex-row gap-2">
											<Pressable
												disabled={
													approveMutation.isPending || !canApproveSuggestion
												}
												onPress={() => approve([item.id])}
												className="size-10 items-center justify-center rounded-full bg-primary"
												style={{
													opacity:
														approveMutation.isPending || !canApproveSuggestion
															? 0.5
															: 1,
												}}
											>
												<Icon name="Plus" size={16} />
											</Pressable>
											<Pressable
												disabled={dismissMutation.isPending}
												onPress={() => dismissMutation.mutate({ id: item.id })}
												className="size-10 items-center justify-center rounded-full bg-secondary"
											>
												<Icon name="X" size={16} className="text-foreground" />
											</Pressable>
										</View>
									)}
								</View>
							</Pressable>
						);
					}}
					ListEmptyComponent={
						<View className="items-center justify-center py-20">
							{runQuery.isFetching ? (
								<ActivityIndicator color={colors.primary} />
							) : (
								<Icon
									name="Music2"
									size={44}
									className="mb-3 text-muted-foreground"
								/>
							)}
							<Text className="text-sm text-muted-foreground">
								{runQuery.isFetching ? "Loading tracks" : "No tracks"}
							</Text>
						</View>
					}
				/>
			</SafeArea>
		</View>
	);
}
