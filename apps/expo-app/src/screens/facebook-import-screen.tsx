import { SafeArea } from "@/components/safe-area";
import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import type { RouterOutputs } from "@api/trpc/routers/_app";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	Text,
	View,
} from "react-native";

type ImportItem =
	RouterOutputs["facebookImport"]["listMediaImports"]["items"][number];
type StatusFilter = "all" | ImportItem["status"];

const FILTERS: { id: StatusFilter; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "not_started", label: "Pending" },
	{ id: "imported", label: "Imported" },
	{ id: "failed", label: "Failed" },
];

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

function StatBox({ label, value }: { label: string; value: string | number }) {
	return (
		<View className="flex-1 gap-1 rounded-lg bg-card p-3">
			<Text className="text-xs font-medium text-muted-foreground">{label}</Text>
			<Text className="text-lg font-extrabold text-foreground">{value}</Text>
		</View>
	);
}

function ImportRow({ item }: { item: ImportItem }) {
	const statusClass = statusClassName(item.status);
	const [statusBg, statusText] = statusClass.split(" ");
	return (
		<View className="gap-3 rounded-lg border border-border bg-card p-3">
			<View className="flex-row items-start gap-3">
				<View className="mt-1 size-9 items-center justify-center rounded-full bg-background">
					{item.status === "running" ? (
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
						<View className={`rounded-full px-2 py-1 ${statusBg}`}>
							<Text className={`text-[10px] font-bold ${statusText}`}>
								{statusLabel(item.status)}
							</Text>
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
		</View>
	);
}

export default function FacebookImportScreen() {
	const router = useRouter();
	const colors = useColors();
	const qc = useQueryClient();
	const [status, setStatus] = useState<StatusFilter>("all");
	const summaryQuery = useQuery({
		..._trpc.facebookImport.getSummary.queryOptions(),
		refetchInterval: 2500,
	});
	const hasRunningJob =
		summaryQuery.data?.job.activeJob?.status === "running" ||
		(summaryQuery.data?.runningCount ?? 0) > 0;
	const bridgeQuery = useQuery({
		..._trpc.facebookImport.checkBridge.queryOptions(),
		retry: false,
	});
	const itemsQuery = useQuery({
		..._trpc.facebookImport.listMediaImports.queryOptions({
			status,
			limit: 50,
		}),
		refetchInterval: hasRunningJob ? 2500 : false,
	});
	const startMutation = useMutation(
		_trpc.facebookImport.startMediaImport.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.getSummary.queryKey(),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.listMediaImports.queryKey({
							status,
							limit: 50,
						}),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.facebookImport.checkBridge.queryKey(),
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
		summaryQuery.isFetching || itemsQuery.isFetching || bridgeQuery.isFetching;
	const items = itemsQuery.data?.items ?? [];
	const pendingCount = summaryQuery.data?.pendingCount ?? 0;
	const failedCount = summaryQuery.data?.failedCount ?? 0;
	const canStart =
		!startMutation.isPending &&
		!hasRunningJob &&
		(pendingCount > 0 || failedCount > 0);

	const refresh = useCallback(() => {
		void Promise.all([
			summaryQuery.refetch(),
			itemsQuery.refetch(),
			bridgeQuery.refetch(),
		]);
	}, [bridgeQuery, itemsQuery, summaryQuery]);

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
					{bridgeQuery.data?.error ? (
						<Text className="text-xs font-medium text-destructive">
							{bridgeQuery.data.error}
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
						disabled={!canStart}
						onPress={() => startMutation.mutate({ limit: 10 })}
						className={
							canStart
								? "flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3"
								: "flex-row items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 opacity-60"
						}
					>
						{startMutation.isPending || hasRunningJob ? (
							<ActivityIndicator size="small" color={colors.background} />
						) : (
							<Icon
								name="Send"
								size={18}
								className={
									canStart ? "text-primary-foreground" : "text-muted-foreground"
								}
							/>
						)}
						<Text
							className={
								canStart
									? "text-sm font-extrabold text-primary-foreground"
									: "text-sm font-extrabold text-muted-foreground"
							}
						>
							{hasRunningJob ? "Import running" : "Start next 10"}
						</Text>
					</Pressable>
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
							) : (
								<Icon name="CheckCircle2" size={16} className="text-primary" />
							)}
							<Text className="flex-1 text-sm font-bold text-foreground">
								{job.status === "running"
									? "Current media import"
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
								</Text>
							</Pressable>
						);
					})}
				</View>
			</View>
		),
		[
			bridgeQuery.data,
			bridgeQuery.isFetching,
			canStart,
			colors.background,
			failedCount,
			hasRunningJob,
			job,
			pendingCount,
			startMutation,
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
					renderItem={({ item }) => <ImportRow item={item} />}
					contentContainerClassName="gap-3 px-4 pb-8"
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
			</SafeArea>
		</View>
	);
}
