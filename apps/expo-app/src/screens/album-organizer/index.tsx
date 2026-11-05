import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { FlatList, ScrollView } from "@/components/ui/scroll-surfaces";
import { useColors } from "@/hooks/use-color";
import { useQuery } from "@/lib/react-query";
import {
	type AlbumOrganizerModel,
	useAppSettingsStore,
} from "@/store/app-settings-store";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, RefreshControl, Text, View } from "react-native";
import { useDiscovery } from "./use-discovery";

type Channel = RouterOutputs["channel"]["getChannels"][number];
type AlbumIndexRun = RouterOutputs["album"]["getAutomaticIndexRun"];
type AlbumSuggestion = AlbumIndexRun["albumSuggestions"][number];

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

function isProposedSuggestion(suggestion?: AlbumSuggestion | null) {
	return (
		suggestion?.status !== "approved" &&
		(suggestion?.suggestionType === "proposed_album" || !suggestion?.albumId)
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

export function AlbumOrganizerChannelsScreen() {
	const router = useRouter();
	const colors = useColors();
	const {
		data: channels = [],
		isFetching,
		refetch,
	} = useQuery(_trpc.channel.getChannels.queryOptions());

	return (
		<View className="flex-1 bg-background">
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
	const discovery = useDiscovery(channelId, (id) =>
		router.push(routeHref(`/album-organizer/${channelId}/runs/${id}?resume=1`)),
	);
	const isGenerating = discovery.running;
	const scanIncomplete = !!latestRun?.scan && !latestRun.scan.complete;
	const generateIndex = () => {
		void discovery.generate(albumOrganizerModel);
	};

	return (
		<View className="flex-1 bg-background">
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
									Used for a new discovery. Saved discoveries keep their model.
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
							if (latestRun?.id && !scanIncomplete) {
								router.push(
									routeHref(
										`/album-organizer/${channelId}/runs/${latestRun.id}?resume=1`,
									),
								);
								return;
							}
							generateIndex();
						}}
						className="flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 active:opacity-80"
					>
						{isGenerating ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Icon name={hasSavedRun ? "FolderOpen" : "Sparkles"} size={18} />
						)}
						<Text className="text-sm font-extrabold text-primary-foreground">
							{isGenerating
								? `${discovery.scanned} tracks scanned…`
								: hasSavedRun
									? scanIncomplete
										? "Continue discovery"
										: "Resume review"
									: "Generate suggestions"}
						</Text>
					</Pressable>

					{discovery.error ? (
						<Text className="text-sm text-destructive">{discovery.error}</Text>
					) : null}
					{isGenerating ? (
						<Pressable
							onPress={discovery.pause}
							className="min-h-11 items-center justify-center"
						>
							<Text className="text-sm font-bold text-primary">
								Pause after this batch
							</Text>
						</Pressable>
					) : null}
					{hasSavedRun && !scanIncomplete ? (
						<Pressable
							disabled={isGenerating}
							onPress={() => generateIndex()}
							className="flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 active:opacity-80"
						>
							<Icon name="RefreshCw" size={16} className="text-foreground" />
							<Text className="text-sm font-bold text-foreground">
								Scan new audio
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
	const resumeId =
		runQuery.data?.review.currentSuggestionId ??
		suggestions.find((item) =>
			["pending", "partial", "failed"].includes(item.status),
		)?.id;
	const autoResume = params.resume === "1";
	const canResume = !runQuery.data?.scan || runQuery.data.scan.complete;
	useEffect(() => {
		if (autoResume && resumeId && canResume) {
			router.replace(
				routeHref(
					`/album-organizer/${channelId}/runs/${runId}/albums/${resumeId}`,
				),
			);
		}
	}, [autoResume, resumeId, canResume, channelId, runId, router]);

	return (
		<View className="flex-1 bg-background">
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
										{active} {active === 1 ? "track" : "tracks"} · {pending}{" "}
										pending · {approved} approved
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
					ListHeaderComponent={
						<View className="gap-3 pb-4">
							{runQuery.error ? (
								<Text className="text-destructive">
									{runQuery.error.message}
								</Text>
							) : null}
							{runQuery.data?.error ? (
								<Text className="text-destructive">{runQuery.data.error}</Text>
							) : null}
							{runQuery.data?.scan && !runQuery.data.scan.complete ? (
								<Pressable
									onPress={() =>
										router.replace(routeHref(`/album-organizer/${channelId}`))
									}
									className="min-h-12 justify-center"
								>
									<Text className="text-primary">
										Continue channel discovery
									</Text>
								</Pressable>
							) : resumeId ? (
								<Pressable
									onPress={() =>
										router.push(
											routeHref(
												`/album-organizer/${channelId}/runs/${runId}/albums/${resumeId}`,
											),
										)
									}
									className="min-h-12 items-center justify-center rounded-xl bg-primary px-4"
								>
									<Text className="font-bold text-primary-foreground">
										Resume review
									</Text>
								</Pressable>
							) : null}
						</View>
					}
					ListFooterComponent={
						runQuery.data?.unassigned.length ? (
							<View className="gap-3 pt-5">
								<Text className="text-base font-bold text-foreground">
									{runQuery.data.unassigned.length} unassigned tracks
								</Text>
								<Text className="text-sm text-muted-foreground">
									These tracks stay unalbumed because discovery found no match.
								</Text>
								{runQuery.data.unassigned.map((item) => (
									<View key={item.id} className="border-b border-border py-3">
										<Text className="text-base text-foreground">
											{item.title || "Untitled audio"}
										</Text>
										<Text className="text-xs text-muted-foreground">
											{formatDate(item.blog?.blogDate)}
										</Text>
									</View>
								))}
							</View>
						) : null
					}
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

export { AlbumOrganizerSuggestionScreen } from "./suggestion-screen";
