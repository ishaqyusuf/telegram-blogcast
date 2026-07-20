import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { useLocalServicesSession } from "@/components/local-services";
import {
	useFloatingFooterInset,
	useFloatingFooterLayer,
} from "@/components/floating-footer";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { isHttpFacebookMediaBridgeUrl } from "@/lib/facebook-media-bridge";
import { buildTelegramFileProxy } from "@/lib/media-source";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Linking,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";

type ImportItem =
	RouterOutputs["facebookImport"]["listMediaImports"]["items"][number];
type ImportChannel =
	RouterOutputs["facebookImport"]["getChannels"][number];
type StatusFilter = "all" | ImportItem["status"];
const EMPTY_IMPORT_ITEMS: ImportItem[] = [];
const FACEBOOK_IMPORT_FILTER_STORAGE_KEY = "facebook-import:filters:v1";

const FILTERS: { id: StatusFilter; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "not_started", label: "Pending" },
	{ id: "imported", label: "Imported" },
	{ id: "failed", label: "Failed" },
];
const FILTER_IDS = new Set<StatusFilter>(FILTERS.map((filter) => filter.id));
let facebookImportFilterSnapshot: {
	status: StatusFilter;
	channelIds: number[];
} = {
	status: "all",
	channelIds: [],
};

function normalizePersistedChannelIds(value: unknown) {
	if (!Array.isArray(value)) return [];
	return Array.from(
		new Set(
			value.filter(
				(item): item is number =>
					typeof item === "number" && Number.isInteger(item) && item > 0,
			),
		),
	);
}

function parsePersistedFilters(value: string | null) {
	if (!value) return facebookImportFilterSnapshot;
	try {
		const parsed = JSON.parse(value) as {
			status?: unknown;
			channelIds?: unknown;
		};
		const status =
			typeof parsed.status === "string" &&
			FILTER_IDS.has(parsed.status as StatusFilter)
				? (parsed.status as StatusFilter)
				: "all";
		return {
			status,
			channelIds: normalizePersistedChannelIds(parsed.channelIds),
		};
	} catch {
		return facebookImportFilterSnapshot;
	}
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

function statusLabel(status: ImportItem["status"]) {
	switch (status) {
		case "imported":
			return "Imported";
		case "failed":
			return "Failed";
		case "running":
			return "Running";
		case "skipped":
			return "Skipped";
		default:
			return "Pending";
	}
}

function statusClassName(status: ImportItem["status"]) {
	switch (status) {
		case "imported":
			return "bg-primary/15 text-primary";
		case "failed":
			return "bg-destructive/15 text-destructive";
		case "running":
			return "bg-secondary text-foreground";
		default:
			return "bg-muted text-muted-foreground";
	}
}

function canImportItem(item: ImportItem) {
	return item.status !== "imported" && item.status !== "running";
}

function canBulkImportItem(item: ImportItem) {
	return item.status === "not_started" || item.status === "skipped";
}

function openExternalUrl(url: string | null) {
	if (!url) return;
	void Linking.openURL(url).catch(() => undefined);
}

function getImportItemPlaybackUrl(item: ImportItem) {
	const kind = getImportedItemMediaKind(item);
	if (item.status !== "imported" || !["audio", "video"].includes(kind)) {
		return null;
	}
	return buildTelegramFileProxy(item.fileId);
}

function getImportedItemMediaKind(item: ImportItem) {
	const mediaType = (item.mediaType ?? "").toLowerCase();
	const mimeType = (item.mimeType ?? "").toLowerCase();
	if (mediaType === "audio" || mimeType.startsWith("audio/")) return "audio";
	if (mediaType === "image" || mimeType.startsWith("image/")) return "image";
	if (mediaType === "video" || mimeType.startsWith("video/")) return "video";
	if (mediaType === "text") return "text";
	return "blog";
}

function getBridgeOfflineMessage(error: string | null | undefined, baseUrl?: string) {
	if (!error) return null;
	if (baseUrl?.includes("127.0.0.1") || baseUrl?.includes("localhost")) {
		return `${error}. Start the bridge on the API host with bun run facebook-media-bridge:dev.`;
	}
	return error;
}

function StatBox({ label, value }: { label: string; value: string | number }) {
	return (
		<View className="flex-1 gap-1 rounded-lg bg-card p-3">
			<Text className="text-xs font-medium text-muted-foreground">{label}</Text>
			<Text className="text-lg font-extrabold text-foreground">{value}</Text>
		</View>
	);
}

function ImportRow({
	item,
	selected,
	importing,
	onOpen,
	onMark,
	onImportSingle,
	onTogglePlayback,
	playbackActive,
	playbackPlaying,
	playbackLoading,
}: {
	item: ImportItem;
	selected: boolean;
	importing: boolean;
	onOpen: (item: ImportItem) => void;
	onMark: (item: ImportItem) => void;
	onImportSingle: (item: ImportItem) => void;
	onTogglePlayback: (item: ImportItem) => void;
	playbackActive: boolean;
	playbackPlaying: boolean;
	playbackLoading: boolean;
}) {
	const statusClass = statusClassName(item.status);
	const [statusBg, statusText] = statusClass.split(" ");
	const channelLabel = item.channel.username
		? `${item.channel.title} · @${item.channel.username}`
		: item.channel.title;
	const importable = canImportItem(item);
	const playbackUrl = getImportItemPlaybackUrl(item);
	return (
		<Pressable
			onPress={() => onOpen(item)}
			onLongPress={() => onMark(item)}
			delayLongPress={350}
			className={
				selected
					? "gap-3 rounded-lg border border-primary bg-primary/10 p-3"
					: "gap-3 rounded-lg border border-border bg-card p-3"
			}
		>
			<View className="flex-row items-start gap-3">
				<View className="mt-1 size-9 items-center justify-center rounded-full bg-background">
					{selected ? (
						<Icon name="CheckCircle2" size={18} className="text-primary" />
					) : item.status === "running" ? (
						<ActivityIndicator size="small" />
					) : item.status === "imported" ? (
						<Icon name="Check" size={18} className="text-primary" />
					) : item.status === "failed" ? (
						<Icon name="AlertCircle" size={18} className="text-destructive" />
					) : (
						<Icon name="Image" size={18} className="text-muted-foreground" />
					)}
				</View>
				<View className="flex-1 gap-1">
					<View className="flex-row items-start gap-2">
						<Text
							className="flex-1 text-sm font-bold text-foreground"
							numberOfLines={2}
						>
							{item.title}
						</Text>
						<View className="items-end gap-2">
							<View className={`rounded-full px-2 py-1 ${statusBg}`}>
								<Text className={`text-[10px] font-bold ${statusText}`}>
									{statusLabel(item.status)}
								</Text>
							</View>
							<Pressable
								disabled={!importable || importing}
								onPress={(event) => {
									event.stopPropagation();
									onImportSingle(item);
								}}
								className={
									importable
										? "size-9 items-center justify-center rounded-full bg-primary"
										: "size-9 items-center justify-center rounded-full bg-muted"
								}
							>
								{importing ? (
									<ActivityIndicator size="small" color="#fff" />
								) : (
									<Icon
										name={item.status === "imported" ? "Check" : "Send"}
										size={16}
										className={
											importable
												? "text-primary-foreground"
												: "text-muted-foreground"
										}
									/>
								)}
							</Pressable>
							{playbackUrl ? (
								<Pressable
									disabled={playbackLoading}
									onPress={(event) => {
										event.stopPropagation();
										onTogglePlayback(item);
									}}
									className="size-9 items-center justify-center rounded-full bg-secondary"
								>
									{playbackLoading ? (
										<ActivityIndicator size="small" />
									) : (
										<Icon
											name={playbackActive && playbackPlaying ? "Pause" : "Play"}
											size={16}
											className="text-foreground"
										/>
									)}
								</Pressable>
							) : null}
						</View>
					</View>
					<Text className="text-xs text-muted-foreground" numberOfLines={1}>
						{item.mediaType || "No media attached"}
						{item.mimeType ? ` · ${item.mimeType}` : ""}
					</Text>
					{item.sourceUrl ? (
						<Text className="text-xs text-muted-foreground" numberOfLines={1}>
							{item.sourceUrl}
						</Text>
					) : null}
					<Text
						className="text-xs font-semibold text-foreground"
						numberOfLines={1}
					>
						{channelLabel}
					</Text>
				</View>
			</View>

			<View className="flex-row flex-wrap gap-x-4 gap-y-1">
				<Text className="text-xs text-muted-foreground">
					Synced {formatDate(item.sourceSyncedAt)}
				</Text>
				{item.fileUniqueId ? (
					<Text className="text-xs text-muted-foreground" numberOfLines={1}>
						File {item.fileUniqueId}
					</Text>
				) : null}
			</View>

			{item.error ? (
				<Text className="text-xs font-medium text-destructive" numberOfLines={3}>
					{item.error}
				</Text>
			) : null}
		</Pressable>
	);
}

function ImportPreviewModal({
	item,
	importing,
	canImport,
	onClose,
	onImport,
	onOpenImported,
	onTogglePlayback,
	playbackActive,
	playbackPlaying,
	playbackLoading,
}: {
	item: ImportItem | null;
	importing: boolean;
	canImport: boolean;
	onClose: () => void;
	onImport: (item: ImportItem) => void;
	onOpenImported: (item: ImportItem) => void;
	onTogglePlayback: (item: ImportItem) => void;
	playbackActive: boolean;
	playbackPlaying: boolean;
	playbackLoading: boolean;
}) {
	if (!item) return null;

	const importable = canImportItem(item);
	const isImported = item.status === "imported";
	const channelLabel = item.channel.username
		? `${item.channel.title} · @${item.channel.username}`
		: item.channel.title;
	const actionDisabled = isImported ? false : !canImport || !importable || importing;
	const playbackUrl = getImportItemPlaybackUrl(item);

	return (
		<FloatingBottomSheet
			visible
			onClose={onClose}
			accessibilityLabel="Facebook item"
			title="Facebook item"
			snapPoints={["78%"]}
			enableDynamicSizing={false}
		>
			<View className="gap-4 bg-card px-4 pb-6">
				<View className="flex-row justify-end">
					<Pressable
						onPress={onClose}
						className="size-9 items-center justify-center rounded-full bg-background"
					>
						<Icon name="X" size={18} className="text-foreground" />
					</Pressable>
				</View>

					<View className="gap-3 rounded-2xl border border-border bg-card p-4">
						<View className="flex-row items-start gap-3">
							<View className="size-10 items-center justify-center rounded-full bg-secondary">
								{item.status === "running" || importing ? (
									<ActivityIndicator size="small" />
								) : isImported ? (
									<Icon name="Check" size={18} className="text-primary" />
								) : item.status === "failed" ? (
									<Icon
										name="AlertCircle"
										size={18}
										className="text-destructive"
									/>
								) : (
									<Icon name="Image" size={18} className="text-muted-foreground" />
								)}
							</View>
							<View className="flex-1 gap-1">
								<Text className="text-base font-extrabold text-foreground">
									{item.title}
								</Text>
								<Text className="text-xs font-semibold text-muted-foreground">
									{channelLabel}
								</Text>
							</View>
							<View className="rounded-full bg-secondary px-2 py-1">
								<Text className="text-[10px] font-bold text-muted-foreground">
									{statusLabel(item.status)}
								</Text>
							</View>
						</View>

						{item.previewText ? (
							<Text className="text-sm leading-6 text-foreground" numberOfLines={6}>
								{item.previewText}
							</Text>
						) : null}

						{item.sourceUrl ? (
							<Pressable onPress={() => openExternalUrl(item.sourceUrl)}>
								<Text className="text-xs font-semibold text-primary" numberOfLines={2}>
									{item.sourceUrl}
								</Text>
							</Pressable>
						) : null}

						<Text className="text-xs text-muted-foreground">
							{item.mediaType || "No media attached"}
							{item.mimeType ? ` · ${item.mimeType}` : ""}
						</Text>

						{item.error ? (
							<Text className="text-xs font-medium text-destructive" numberOfLines={4}>
								{item.error}
							</Text>
						) : null}
					</View>

					<Pressable
						disabled={actionDisabled}
						onPress={() => {
							if (isImported) {
								onOpenImported(item);
								return;
							}
							onImport(item);
						}}
						className={
							actionDisabled
								? "flex-row items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 opacity-70"
								: "flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3"
						}
					>
						{importing || item.status === "running" ? (
							<ActivityIndicator size="small" color="#fff" />
						) : (
							<Icon
								name={isImported ? "Eye" : "Send"}
								size={18}
								className={
									actionDisabled
										? "text-muted-foreground"
										: "text-primary-foreground"
								}
							/>
						)}
						<Text
							className={
								actionDisabled
									? "text-sm font-extrabold text-muted-foreground"
									: "text-sm font-extrabold text-primary-foreground"
							}
						>
							{isImported
								? "Open blog"
								: importing || item.status === "running"
									? "Importing"
									: "Import"}
						</Text>
					</Pressable>
					{playbackUrl ? (
						<Pressable
							disabled={playbackLoading}
							onPress={() => onTogglePlayback(item)}
							className="flex-row items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3"
						>
							{playbackLoading ? (
								<ActivityIndicator size="small" />
							) : (
								<Icon
									name={playbackActive && playbackPlaying ? "Pause" : "Play"}
									size={18}
									className="text-foreground"
								/>
							)}
							<Text className="text-sm font-extrabold text-foreground">
								{playbackActive && playbackPlaying ? "Pause" : "Play"}
							</Text>
						</Pressable>
					) : null}
			</View>
		</FloatingBottomSheet>
	);
}

function ChannelFilterSheet({
	visible,
	channels,
	selectedIds,
	onClose,
	onSelectAll,
	onToggle,
}: {
	visible: boolean;
	channels: ImportChannel[];
	selectedIds: number[];
	onClose: () => void;
	onSelectAll: () => void;
	onToggle: (channelId: number) => void;
}) {
	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const totalCount = channels.reduce((sum, channel) => sum + channel.totalCount, 0);
	const allSelected = selectedIds.length === 0;

	return (
		<FloatingBottomSheet
			visible={visible}
			onClose={onClose}
			accessibilityLabel="Facebook channels"
			title="Facebook channels"
			snapPoints={["78%"]}
			enableDynamicSizing={false}
		>
			<View className="bg-card px-4 pb-6">
				<View className="mb-4 flex-row justify-end">
					<Pressable
						onPress={onClose}
						className="size-9 items-center justify-center rounded-full bg-background"
					>
						<Icon name="X" size={18} className="text-foreground" />
					</Pressable>
				</View>

					<ScrollView
						showsVerticalScrollIndicator={false}
						contentContainerClassName="gap-2 pb-4"
					>
						<Pressable
							onPress={onSelectAll}
							className={
								allSelected
									? "flex-row items-center gap-3 rounded-xl border border-primary bg-primary/10 p-3"
									: "flex-row items-center gap-3 rounded-xl border border-border bg-card p-3"
							}
						>
							<Icon
								name={allSelected ? "CheckCircle2" : "Circle"}
								size={20}
								className={allSelected ? "text-primary" : "text-muted-foreground"}
							/>
							<View className="flex-1">
								<Text className="text-sm font-extrabold text-foreground">
									All channels
								</Text>
								<Text className="text-xs text-muted-foreground">
									{formatCount(totalCount)} Facebook items
								</Text>
							</View>
						</Pressable>

						{channels.map((channel) => {
							const selected = selectedSet.has(channel.id);
							return (
								<Pressable
									key={channel.id}
									onPress={() => onToggle(channel.id)}
									className={
										selected
											? "flex-row items-center gap-3 rounded-xl border border-primary bg-primary/10 p-3"
											: "flex-row items-center gap-3 rounded-xl border border-border bg-card p-3"
									}
								>
									<Icon
										name={selected ? "CheckCircle2" : "Circle"}
										size={20}
										className={
											selected ? "text-primary" : "text-muted-foreground"
										}
									/>
									<View className="flex-1 gap-0.5">
										<Text
											className="text-sm font-bold text-foreground"
											numberOfLines={2}
										>
											{channel.title}
										</Text>
										<Text className="text-xs text-muted-foreground" numberOfLines={1}>
											{channel.username ? `@${channel.username} · ` : ""}
											{formatCount(channel.totalCount)} items ·{" "}
											{formatCount(channel.pendingCount)} pending
										</Text>
									</View>
								</Pressable>
							);
						})}
					</ScrollView>

					<Pressable
						onPress={onClose}
						className="flex-row items-center justify-center rounded-xl bg-primary px-4 py-3"
					>
						<Text className="text-sm font-extrabold text-primary-foreground">
							Done
						</Text>
					</Pressable>
			</View>
		</FloatingBottomSheet>
	);
}

export default function FacebookImportScreen() {
	const router = useRouter();
	const colors = useColors();
	const qc = useQueryClient();
	const { urls: localServiceUrls } = useLocalServicesSession();
	const floatingFooterInset = useFloatingFooterInset();
	const playbackSoundRef = useRef<Audio.Sound | null>(null);
	const [status, setStatus] = useState<StatusFilter>(
		facebookImportFilterSnapshot.status,
	);
	const [channelFilterOpen, setChannelFilterOpen] = useState(false);
	const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>(
		facebookImportFilterSnapshot.channelIds,
	);
	const [selectedBlogIds, setSelectedBlogIds] = useState<number[]>([]);
	const [importingBlogIds, setImportingBlogIds] = useState<number[]>([]);
	const [previewItem, setPreviewItem] = useState<ImportItem | null>(null);
	const [filtersHydrated, setFiltersHydrated] = useState(false);
	const [activePlaybackBlogId, setActivePlaybackBlogId] = useState<number | null>(
		null,
	);
	const [playbackLoadingBlogId, setPlaybackLoadingBlogId] = useState<
		number | null
	>(null);
	const [playbackPlaying, setPlaybackPlaying] = useState(false);
	const facebookBridgeBaseUrl =
		localServiceUrls?.facebookMediaBridgeBaseUrl ?? null;
	const canUseFacebookBridgeUrl =
		isHttpFacebookMediaBridgeUrl(facebookBridgeBaseUrl);
	const facebookBridgeInput = canUseFacebookBridgeUrl
		? { baseUrl: facebookBridgeBaseUrl ?? undefined }
		: undefined;
	const summaryQuery = useQuery({
		..._trpc.facebookImport.getSummary.queryOptions({
			channelIds: selectedChannelIds,
		}),
		refetchInterval: 2500,
	});
	const runningCount = summaryQuery.data?.runningCount ?? 0;
	const hasRunningJob =
		summaryQuery.data?.job.activeJob?.status === "running" || runningCount > 0;
	const bridgeQuery = useQuery({
		..._trpc.facebookImport.checkBridge.queryOptions(facebookBridgeInput),
		retry: false,
	});
	const channelsQuery = useQuery(
		_trpc.facebookImport.getChannels.queryOptions(),
	);
	const itemsQuery = useQuery({
		..._trpc.facebookImport.listMediaImports.queryOptions({
			status,
			channelIds: selectedChannelIds,
			limit: 50,
		}),
		refetchInterval: hasRunningJob || importingBlogIds.length > 0 ? 1500 : false,
	});
	const startMutation = useMutation(
		_trpc.facebookImport.startMediaImport.mutationOptions({
			onSuccess: async (_data, variables) => {
				if (variables.blogIds?.length) {
					setSelectedBlogIds((current) =>
						current.filter((id) => !variables.blogIds?.includes(id)),
					);
				}
				await Promise.all([
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.getSummary.queryKey({
							channelIds: selectedChannelIds,
						}),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.listMediaImports.queryKey({
							status,
							channelIds: selectedChannelIds,
							limit: 50,
						}),
					}),
					qc.invalidateQueries({
						queryKey:
							_trpc.facebookImport.checkBridge.queryKey(facebookBridgeInput),
					}),
				]);
			},
			onSettled: (_data, error, variables) => {
				if (error && variables?.blogIds?.length) {
					setImportingBlogIds((current) =>
						current.filter((id) => !variables.blogIds?.includes(id)),
					);
				}
			},
		}),
	);
	const stopMutation = useMutation(
		_trpc.facebookImport.stopMediaImport.mutationOptions({
			onSettled: async () => {
				setImportingBlogIds([]);
				await Promise.all([
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.getSummary.queryKey({
							channelIds: selectedChannelIds,
						}),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.listMediaImports.queryKey({
							status,
							channelIds: selectedChannelIds,
							limit: 50,
						}),
					}),
				]);
			},
		}),
	);
	const clearFailedMutation = useMutation(
		_trpc.facebookImport.clearFailedMediaImports.mutationOptions({
			onSuccess: async () => {
				setStatus("not_started");
				setSelectedBlogIds([]);
				await Promise.all([
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.getSummary.queryKey({
							channelIds: selectedChannelIds,
						}),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.listMediaImports.queryKey({
							status,
							channelIds: selectedChannelIds,
							limit: 50,
						}),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.listMediaImports.queryKey({
							status: "not_started",
							channelIds: selectedChannelIds,
							limit: 50,
						}),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.getChannels.queryKey(),
					}),
				]);
			},
		}),
	);

	const job =
		summaryQuery.data?.job.activeJob ??
		summaryQuery.data?.job.latestCompletedJob ??
		null;
	const isRefreshing =
		summaryQuery.isFetching ||
		itemsQuery.isFetching ||
		bridgeQuery.isFetching ||
		channelsQuery.isFetching;
	const items = itemsQuery.data?.items ?? EMPTY_IMPORT_ITEMS;
	const importableItems = items.filter(canBulkImportItem);
	const selectedSet = useMemo(() => new Set(selectedBlogIds), [selectedBlogIds]);
	const currentPreviewItem = useMemo(() => {
		if (!previewItem) return null;
		return (
			items.find((item) => item.blogId === previewItem.blogId) ?? previewItem
		);
	}, [items, previewItem]);
	const visibleImportableIds = importableItems.map((item) => item.blogId);
	const allVisibleSelected =
		visibleImportableIds.length > 0 &&
		visibleImportableIds.every((id) => selectedSet.has(id));
	const channels = channelsQuery.data ?? [];
	const totalCount = summaryQuery.data?.totalCount ?? 0;
	const importedCount = summaryQuery.data?.importedCount ?? 0;
	const pendingCount = summaryQuery.data?.pendingCount ?? 0;
	const failedCount = summaryQuery.data?.failedCount ?? 0;
	const filterCounts = useMemo<Record<StatusFilter, number>>(
		() => ({
			all: totalCount,
			not_started: pendingCount,
			imported: importedCount,
			failed: failedCount,
			running: runningCount,
			skipped: 0,
		}),
		[failedCount, importedCount, pendingCount, runningCount, totalCount],
	);
	const bulkStartCount =
		status === "all" || status === "not_started" ? pendingCount : 0;
	const startButtonLabel = hasRunningJob
		? "Stop import"
		: bulkStartCount > 0
			? `Start ${formatCount(bulkStartCount)}`
			: status === "failed"
				? "Retry failed individually"
				: "No pending imports";
	const selectedChannelNames = selectedChannelIds
		.map((channelId) => channels.find((channel) => channel.id === channelId)?.title)
		.filter(Boolean);
	const channelFilterLabel =
		selectedChannelNames.length === 0
			? "All channels"
			: selectedChannelNames.length === 1
				? selectedChannelNames[0]
				: `${selectedChannelNames.length} channels`;
	const canStart =
		!startMutation.isPending &&
		!stopMutation.isPending &&
		!clearFailedMutation.isPending &&
		!hasRunningJob &&
		bulkStartCount > 0;
	const canStop = hasRunningJob && !stopMutation.isPending;
	const canImportSelected =
		selectedBlogIds.length > 0 &&
		!startMutation.isPending &&
		!stopMutation.isPending &&
		!clearFailedMutation.isPending &&
		!hasRunningJob;
	const canClearFailed =
		failedCount > 0 && !hasRunningJob && !clearFailedMutation.isPending;
	const confirmClearFailedImports = useCallback(() => {
		if (!canClearFailed) return;
		Alert.alert(
			"Clear failed imports?",
			"Failed Facebook imports will move back to Pending so the next Start can retry them.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Clear failed",
					style: "destructive",
					onPress: () =>
						clearFailedMutation.mutate({
							channelIds: selectedChannelIds,
						}),
				},
			],
		);
	}, [canClearFailed, clearFailedMutation, selectedChannelIds]);

	useEffect(() => {
		let cancelled = false;

		AsyncStorage.getItem(FACEBOOK_IMPORT_FILTER_STORAGE_KEY)
			.then((value) => {
				if (cancelled) return;
				const persisted = parsePersistedFilters(value);
				facebookImportFilterSnapshot = persisted;
				setStatus(persisted.status);
				setSelectedChannelIds(persisted.channelIds);
			})
			.catch(() => undefined)
			.finally(() => {
				if (!cancelled) setFiltersHydrated(true);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		return () => {
			void playbackSoundRef.current?.unloadAsync().catch(() => undefined);
			playbackSoundRef.current = null;
		};
	}, []);

	useEffect(() => {
		facebookImportFilterSnapshot = {
			status,
			channelIds: selectedChannelIds,
		};

		if (!filtersHydrated) return;

		void AsyncStorage.setItem(
			FACEBOOK_IMPORT_FILTER_STORAGE_KEY,
			JSON.stringify({
				status,
				channelIds: selectedChannelIds,
			}),
		).catch(() => undefined);
	}, [filtersHydrated, selectedChannelIds, status]);

	const refresh = useCallback(() => {
		void Promise.all([
			summaryQuery.refetch(),
			itemsQuery.refetch(),
			bridgeQuery.refetch(),
			channelsQuery.refetch(),
		]);
	}, [bridgeQuery, channelsQuery, itemsQuery, summaryQuery]);

	useEffect(() => {
		if (importingBlogIds.length === 0) return;

		const itemStatusById = new Map(
			items.map((item) => [item.blogId, item.status] as const),
		);
		const jobStatusById = new Map(
			(job?.items ?? []).map((item) => [item.blogId, item.status] as const),
		);

		setImportingBlogIds((current) => {
			const next = current.filter((blogId) => {
				const itemStatus = itemStatusById.get(blogId);
				const jobStatus = jobStatusById.get(blogId);

				if (
					itemStatus === "imported" ||
					itemStatus === "failed" ||
					itemStatus === "skipped"
				) {
					return false;
				}

				if (
					jobStatus === "imported" ||
					jobStatus === "failed" ||
					jobStatus === "skipped"
				) {
					return false;
				}

				if (!hasRunningJob && itemStatus !== "running") {
					return false;
				}

				return true;
			});

			return next.length === current.length ? current : next;
		});
	}, [hasRunningJob, importingBlogIds.length, items, job]);

	const openImportedItem = useCallback(
		(item: ImportItem) => {
			void qc.invalidateQueries({
				queryKey: _trpc.blog.getBlog.queryKey({ id: item.blogId }),
			});

			const kind = getImportedItemMediaKind(item);
			if (kind === "audio") {
				router.push(`/blog-view-2/${item.blogId}` as any);
				return;
			}
			if (kind === "text") {
				router.push(`/blog-view-text/${item.blogId}` as any);
				return;
			}
			if (kind === "image") {
				const imageUri = buildTelegramFileProxy(item.fileId);
				if (imageUri) {
					router.push(
						`/blog-image-view?uri=${encodeURIComponent(
							imageUri,
						)}&title=${encodeURIComponent(item.title)}` as any,
					);
					return;
				}
			}
			router.push(`/blog-view/${item.blogId}` as any);
		},
		[qc, router],
	);

	const openItem = useCallback(
		(item: ImportItem) => {
			if (item.status === "imported") {
				openImportedItem(item);
				return;
			}
			setPreviewItem(item);
		},
		[openImportedItem],
	);

	const toggleChannel = useCallback((channelId: number) => {
		setSelectedChannelIds((current) =>
			current.includes(channelId)
				? current.filter((id) => id !== channelId)
				: [...current, channelId],
		);
	}, []);

	const toggleSelectedItem = useCallback((item: ImportItem) => {
		if (!canBulkImportItem(item)) return;
		setSelectedBlogIds((current) =>
			current.includes(item.blogId)
				? current.filter((id) => id !== item.blogId)
				: [...current, item.blogId],
		);
	}, []);

	const toggleVisibleSelection = useCallback(() => {
		setSelectedBlogIds((current) => {
			if (visibleImportableIds.length === 0) return current;
			const visibleSet = new Set(visibleImportableIds);
			const everyVisibleSelected = visibleImportableIds.every((id) =>
				current.includes(id),
			);
			if (everyVisibleSelected) {
				return current.filter((id) => !visibleSet.has(id));
			}
			return Array.from(new Set([...current, ...visibleImportableIds]));
		});
	}, [visibleImportableIds]);

	const importSingleItem = useCallback(
		(item: ImportItem) => {
			if (!canImportItem(item) || startMutation.isPending || hasRunningJob) return;
			setImportingBlogIds([item.blogId]);
			startMutation.mutate({
				blogIds: [item.blogId],
				limit: 1,
				channelIds: selectedChannelIds,
				baseUrl: canUseFacebookBridgeUrl
					? (facebookBridgeBaseUrl ?? undefined)
					: undefined,
			});
		},
		[
			canUseFacebookBridgeUrl,
			facebookBridgeBaseUrl,
			hasRunningJob,
			selectedChannelIds,
			startMutation,
		],
	);

	const importSelectedItems = useCallback(() => {
		if (!canImportSelected) return;
		setImportingBlogIds(selectedBlogIds);
		startMutation.mutate({
			blogIds: selectedBlogIds,
			limit: selectedBlogIds.length,
			channelIds: selectedChannelIds,
			baseUrl: canUseFacebookBridgeUrl
				? (facebookBridgeBaseUrl ?? undefined)
				: undefined,
		});
	}, [
		canImportSelected,
		canUseFacebookBridgeUrl,
		facebookBridgeBaseUrl,
		selectedBlogIds,
		selectedChannelIds,
		startMutation,
	]);

	const toggleImportPlayback = useCallback(async (item: ImportItem) => {
		const uri = getImportItemPlaybackUrl(item);
		if (!uri) return;

		setPlaybackLoadingBlogId(item.blogId);
		try {
			const currentSound = playbackSoundRef.current;
			if (currentSound && activePlaybackBlogId === item.blogId) {
				const status = await currentSound.getStatusAsync();
				if (status.isLoaded && status.isPlaying) {
					await currentSound.pauseAsync();
					setPlaybackPlaying(false);
				} else {
					await currentSound.playAsync();
					setPlaybackPlaying(true);
				}
				return;
			}

			if (currentSound) {
				await currentSound.unloadAsync().catch(() => undefined);
				playbackSoundRef.current = null;
			}

			const { sound } = await Audio.Sound.createAsync(
				{ uri },
				{ shouldPlay: true },
			);
			playbackSoundRef.current = sound;
			setActivePlaybackBlogId(item.blogId);
			setPlaybackPlaying(true);
			sound.setOnPlaybackStatusUpdate((nextStatus: AVPlaybackStatus) => {
				if (!nextStatus.isLoaded) return;
				setPlaybackPlaying(nextStatus.isPlaying);
				if (nextStatus.didJustFinish) {
					setPlaybackPlaying(false);
					setActivePlaybackBlogId(null);
				}
			});
		} finally {
			setPlaybackLoadingBlogId(null);
		}
	}, [activePlaybackBlogId]);

	const clearSelectedItems = useCallback(() => {
		setSelectedBlogIds([]);
	}, []);

	const bridgeStatusUrl =
		bridgeQuery.data?.baseUrl ??
		facebookBridgeBaseUrl ??
		summaryQuery.data?.baseUrl ??
		null;
	const bridgeErrorMessage = getBridgeOfflineMessage(
		bridgeQuery.data?.error,
		bridgeStatusUrl ?? undefined,
	);

	useFloatingFooterLayer({
		id: "facebook-import-selection-actions",
		priority: 30,
		visible: selectedBlogIds.length > 0,
		render: () => (
			<View className="px-4">
				<View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg">
					<Pressable
						onPress={toggleVisibleSelection}
						className="size-11 items-center justify-center rounded-xl bg-secondary"
					>
						<Icon
							name={allVisibleSelected ? "CheckCircle2" : "CheckCheck"}
							size={20}
							className="text-foreground"
						/>
					</Pressable>
					<View className="min-w-12 items-center rounded-xl bg-background px-3 py-2">
						<Text className="text-xs font-medium text-muted-foreground">
							Marked
						</Text>
						<Text className="text-base font-extrabold text-foreground">
							{selectedBlogIds.length}
						</Text>
					</View>
					<Pressable
						disabled={!canImportSelected}
						onPress={importSelectedItems}
						className={
							canImportSelected
								? "flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3"
								: "flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3"
						}
					>
						{startMutation.isPending ? (
							<ActivityIndicator size="small" color={colors.background} />
						) : (
							<Icon
								name="Send"
								size={18}
								className={
									canImportSelected
										? "text-primary-foreground"
										: "text-muted-foreground"
								}
							/>
						)}
						<Text
							className={
								canImportSelected
									? "text-sm font-extrabold text-primary-foreground"
									: "text-sm font-extrabold text-muted-foreground"
							}
						>
							Import {selectedBlogIds.length}
						</Text>
					</Pressable>
					<Pressable
						onPress={clearSelectedItems}
						className="size-11 items-center justify-center rounded-xl bg-secondary"
					>
						<Icon name="X" size={18} className="text-foreground" />
					</Pressable>
				</View>
			</View>
		),
	});

	const header = useMemo(
		() => (
			<View className="gap-4">
				<View className="gap-3 rounded-lg bg-card p-4">
					<View className="flex-row items-center gap-3">
						<View className="size-10 items-center justify-center rounded-full bg-secondary">
							{bridgeQuery.isFetching ? (
								<ActivityIndicator size="small" />
							) : bridgeQuery.data?.ok ? (
								<Icon name="Wifi" size={18} className="text-primary" />
							) : (
								<Icon
									name="WifiOff"
									size={18}
									className="text-muted-foreground"
								/>
							)}
						</View>
						<View className="flex-1">
							<Text className="text-base font-extrabold text-foreground">
								Facebook Import
							</Text>
							<Text className="text-xs text-muted-foreground" numberOfLines={1}>
								{bridgeQuery.data?.baseUrl ??
									facebookBridgeBaseUrl ??
									summaryQuery.data?.baseUrl ??
									"Checking bridge"}
							</Text>
						</View>
						<View
							className={
								bridgeQuery.data?.ok
									? "rounded-full bg-primary/15 px-2 py-1"
									: "rounded-full bg-destructive/15 px-2 py-1"
							}
						>
							<Text
								className={
									bridgeQuery.data?.ok
										? "text-[10px] font-bold text-primary"
										: "text-[10px] font-bold text-destructive"
								}
							>
								{bridgeQuery.data?.ok ? "Ready" : "Offline"}
							</Text>
						</View>
					</View>
					{bridgeErrorMessage ? (
						<Text className="text-xs font-medium text-destructive">
							{bridgeErrorMessage}
						</Text>
					) : null}
					<View className="flex-row gap-2">
						<StatBox
							label="Facebook"
							value={formatCount(summaryQuery.data?.totalCount)}
						/>
						<StatBox
							label="Imported"
							value={formatCount(summaryQuery.data?.importedCount)}
						/>
					</View>
					<View className="flex-row gap-2">
						<StatBox label="Pending" value={formatCount(pendingCount)} />
						<StatBox label="Failed" value={formatCount(failedCount)} />
					</View>
					<Pressable
						disabled={hasRunningJob ? !canStop : !canStart}
						onPress={() => {
							if (hasRunningJob) {
								stopMutation.mutate();
								return;
							}
							startMutation.mutate({
								status,
								limit: bulkStartCount,
								channelIds: selectedChannelIds,
								baseUrl: canUseFacebookBridgeUrl
									? (facebookBridgeBaseUrl ?? undefined)
									: undefined,
							});
						}}
						className={
							hasRunningJob
								? "flex-row items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-3"
								: canStart
								? "flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3"
								: "flex-row items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 opacity-60"
						}
					>
						{startMutation.isPending || stopMutation.isPending ? (
							<ActivityIndicator size="small" color={colors.background} />
						) : (
							<Icon
								name={hasRunningJob ? "X" : "Send"}
								size={18}
								className={
									hasRunningJob || canStart
										? "text-primary-foreground"
										: "text-muted-foreground"
								}
							/>
						)}
						<Text
							className={
								hasRunningJob || canStart
									? "text-sm font-extrabold text-primary-foreground"
									: "text-sm font-extrabold text-muted-foreground"
							}
						>
							{startButtonLabel}
						</Text>
					</Pressable>
					{failedCount > 0 ? (
						<Pressable
							disabled={!canClearFailed}
							onPress={confirmClearFailedImports}
							className={
								canClearFailed
									? "flex-row items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
									: "flex-row items-center justify-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 opacity-60"
							}
						>
							{clearFailedMutation.isPending ? (
								<ActivityIndicator size="small" />
							) : (
								<Icon
									name="RotateCcw"
									size={18}
									className={
										canClearFailed
											? "text-destructive"
											: "text-muted-foreground"
									}
								/>
							)}
							<Text
								className={
									canClearFailed
										? "text-sm font-extrabold text-destructive"
										: "text-sm font-extrabold text-muted-foreground"
								}
							>
								Clear failed
							</Text>
						</Pressable>
					) : null}
				</View>

				{job ? (
					<View className="gap-2 rounded-lg border border-border bg-card p-3">
						<View className="flex-row items-center gap-2">
							{job.status === "running" ? (
								<ActivityIndicator size="small" />
							) : job.status === "failed" ? (
								<Icon
									name="AlertCircle"
									size={16}
									className="text-destructive"
								/>
							) : job.status === "cancelled" ? (
								<Icon name="X" size={16} className="text-muted-foreground" />
							) : (
								<Icon name="CheckCircle2" size={16} className="text-primary" />
							)}
							<Text className="flex-1 text-sm font-bold text-foreground">
								{job.status === "running"
									? "Current media import"
									: job.status === "cancelled"
										? "Stopped media import"
									: "Last media import"}
							</Text>
							<Text className="text-xs text-muted-foreground">
								{job.processedCount}/{job.selectedCount}
							</Text>
						</View>
						<Text className="text-xs text-muted-foreground">
							Imported {formatCount(job.importedCount)} · Failed{" "}
							{formatCount(job.failedCount)} · Started{" "}
							{formatDate(job.startedAt)}
						</Text>
						{job.error ? (
							<Text className="text-xs font-medium text-destructive">
								{job.error}
							</Text>
						) : null}
					</View>
				) : null}

				<View className="flex-row gap-2">
					{FILTERS.map((filter) => {
						const selected = status === filter.id;
						return (
							<Pressable
								key={filter.id}
								onPress={() => setStatus(filter.id)}
								className={
									selected
										? "rounded-full bg-primary px-3 py-2"
										: "rounded-full bg-card px-3 py-2"
								}
							>
								<Text
									className={
										selected
											? "text-xs font-bold text-primary-foreground"
											: "text-xs font-bold text-muted-foreground"
									}
								>
									{filter.label}
									{" "}
									({formatCount(filterCounts[filter.id])})
								</Text>
							</Pressable>
						);
					})}
				</View>

				<Pressable
					onPress={() => setChannelFilterOpen(true)}
					className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3"
				>
					<View className="size-9 items-center justify-center rounded-full bg-secondary">
						<Icon name="Layers" size={17} className="text-foreground" />
					</View>
					<View className="flex-1">
						<Text className="text-sm font-extrabold text-foreground">
							{channelFilterLabel}
						</Text>
						<Text className="text-xs text-muted-foreground">
							Tap to filter Facebook imports by channel
						</Text>
					</View>
					{selectedChannelIds.length > 0 ? (
						<View className="rounded-full bg-primary px-2 py-1">
							<Text className="text-[10px] font-bold text-primary-foreground">
								{selectedChannelIds.length}
							</Text>
						</View>
					) : null}
				</Pressable>
			</View>
		),
		[
			bridgeQuery.data,
			bridgeQuery.isFetching,
			bulkStartCount,
			canStart,
			canClearFailed,
			canStop,
			clearFailedMutation.isPending,
			colors.background,
			confirmClearFailedImports,
			failedCount,
			filterCounts,
			hasRunningJob,
			job,
			pendingCount,
			selectedChannelIds,
			channelFilterLabel,
			canUseFacebookBridgeUrl,
			facebookBridgeBaseUrl,
			bridgeErrorMessage,
			startMutation,
			startButtonLabel,
			stopMutation,
			status,
			summaryQuery.data,
		],
	);

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				<View className="flex-row items-center gap-3 px-4 py-3">
					<Pressable
						onPress={() => router.back()}
						className="size-10 items-center justify-center rounded-full bg-card"
					>
						<Icon name="ChevronLeft" size={22} className="text-foreground" />
					</Pressable>
					<View className="flex-1">
						<Text className="text-xl font-extrabold text-foreground">
							Facebook Import
						</Text>
						<Text className="text-xs text-muted-foreground">
							Media download and Telegram upload
						</Text>
					</View>
					<Pressable
						onPress={() => setChannelFilterOpen(true)}
						className="size-10 items-center justify-center rounded-full bg-card"
					>
						<Icon name="Layers" size={18} className="text-foreground" />
						{selectedChannelIds.length > 0 ? (
							<View className="absolute right-1 top-1 size-4 items-center justify-center rounded-full bg-primary">
								<Text className="text-[9px] font-bold text-primary-foreground">
									{selectedChannelIds.length}
								</Text>
							</View>
						) : null}
					</Pressable>
					<Pressable
						onPress={refresh}
						className="size-10 items-center justify-center rounded-full bg-card"
					>
						{isRefreshing ? (
							<ActivityIndicator size="small" />
						) : (
							<Icon name="RefreshCw" size={18} className="text-foreground" />
						)}
					</Pressable>
				</View>

				<FlatList
					style={{ backgroundColor: colors.background }}
					data={items}
					keyExtractor={(item) => String(item.blogId)}
					renderItem={({ item }) => (
						<ImportRow
							item={item}
							selected={selectedSet.has(item.blogId)}
							importing={importingBlogIds.includes(item.blogId)}
							onOpen={openItem}
							onMark={toggleSelectedItem}
							onImportSingle={importSingleItem}
							onTogglePlayback={toggleImportPlayback}
							playbackActive={activePlaybackBlogId === item.blogId}
							playbackPlaying={playbackPlaying}
							playbackLoading={playbackLoadingBlogId === item.blogId}
						/>
					)}
					contentContainerStyle={{ paddingBottom: floatingFooterInset + 32 }}
					contentContainerClassName="gap-3 px-4"
					ListHeaderComponent={header}
					refreshControl={
						<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
					}
					ListEmptyComponent={
						<View className="items-center gap-3 py-16">
							{itemsQuery.isLoading ? (
								<ActivityIndicator color={colors.primary} />
							) : (
								<Icon
									name="Library"
									size={40}
									className="text-muted-foreground"
								/>
							)}
							<Text className="text-sm font-semibold text-muted-foreground">
								{itemsQuery.isLoading ? "Loading imports" : "No Facebook rows"}
							</Text>
						</View>
					}
				/>
				<ChannelFilterSheet
					visible={channelFilterOpen}
					channels={channels}
					selectedIds={selectedChannelIds}
					onClose={() => setChannelFilterOpen(false)}
					onSelectAll={() => setSelectedChannelIds([])}
					onToggle={toggleChannel}
				/>
				<ImportPreviewModal
					item={currentPreviewItem}
					importing={
						!!currentPreviewItem &&
						(importingBlogIds.includes(currentPreviewItem.blogId) ||
							currentPreviewItem.status === "running")
					}
					canImport={!startMutation.isPending && !hasRunningJob}
					onClose={() => setPreviewItem(null)}
					onImport={importSingleItem}
					onOpenImported={(item) => {
						setPreviewItem(null);
						openImportedItem(item);
					}}
					onTogglePlayback={toggleImportPlayback}
					playbackActive={
						!!currentPreviewItem &&
						activePlaybackBlogId === currentPreviewItem.blogId
					}
					playbackPlaying={playbackPlaying}
					playbackLoading={
						!!currentPreviewItem &&
						playbackLoadingBlogId === currentPreviewItem.blogId
					}
				/>
			</SafeArea>
		</View>
	);
}
