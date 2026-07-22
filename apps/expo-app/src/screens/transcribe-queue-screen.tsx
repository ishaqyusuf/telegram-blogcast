import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	RefreshControl,
	ScrollView,
	Text,
	View,
	useWindowDimensions,
} from "react-native";
import ReanimatedSwipeable, {
	SwipeDirection,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
	Easing,
	Extrapolation,
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	type SharedValue,
} from "react-native-reanimated";

import { SafeArea } from "@/components/safe-area";
import { useLocalServicesSession } from "@/components/local-services";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon, type IconKeys } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import {
	SwipeDeleteAction,
	getSwipeDeleteThreshold,
} from "@/components/ui/swipe-delete-action";
import { useColors } from "@/hooks/use-color";
import {
	getTranscriptionJobProgress,
	useTranscriptionQueue,
} from "@/hooks/use-transcription-queue";
import { withAlpha } from "@/lib/theme";

type QueueJob = ReturnType<typeof useTranscriptionQueue>["jobs"][number];

const QUEUE_STATUS_FILTERS = [
	"queued",
	"running",
	"completed",
	"failed",
	"duplicate",
	"already_transcribed",
];

function canDeleteQueueJob(job: QueueJob) {
	return job.status === "queued" || job.status === "failed";
}

function formatQueueStatus(status?: string | null) {
	if (status === "already_transcribed") return "Already transcribed";
	if (status === "duplicate") return "Duplicate";
	return status?.replace(/_/g, " ") ?? "unknown";
}

function getQueueJobIconName(job: QueueJob): IconKeys {
	if (job.status === "completed" || job.status === "already_transcribed") {
		return "CheckCircle2";
	}
	if (job.status === "duplicate") return "Copy";
	if (job.status === "failed") return "AlertCircle";
	return "Captions";
}

function formatRange(fromSec?: number | null, toSec?: number | null) {
	if (fromSec == null && toSec == null) return "Full audio";
	const from = fromSec ?? 0;
	return `${from}s-${toSec ?? "end"}s`;
}

function formatDate(value?: Date | null) {
	if (!value) return "";
	return value.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function cleanTitle(value?: string | null) {
	const trimmed = value?.replace(/\s+/g, " ").trim();
	return trimmed ? trimmed : null;
}

function getQueueJobTitle(
	job: ReturnType<typeof useTranscriptionQueue>["jobs"][number],
) {
	return (
		cleanTitle(job.media?.title) ??
		cleanTitle(job.media?.file?.fileName) ??
		cleanTitle(job.media?.blog?.content) ??
		`Media #${job.mediaId}`
	);
}

function formatJobStage(
	job: ReturnType<typeof useTranscriptionQueue>["jobs"][number],
) {
	const stage = cleanTitle(job.stage)?.replace(/_/g, " ");
	const chunk =
		job.currentChunk && job.totalChunks
			? `Chunk ${job.currentChunk}/${job.totalChunks}`
			: null;
	return [stage, chunk].filter(Boolean).join(" · ");
}

function cleanModelName(value?: string | null) {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	return trimmed.replace(/^mlx-community\//, "");
}

function getQueueJobModel(
	job: ReturnType<typeof useTranscriptionQueue>["jobs"][number],
) {
	const segmentModel = cleanModelName(
		job.media?.transcript?.segments?.[0]?.model,
	);
	if (segmentModel) return segmentModel;
	if (job.transcriberUrl) return "whisper-local";
	return null;
}

function QueueJobRow({
	job,
	colors,
	onDelete,
	onOpenOptions,
	onPress,
}: {
	job: QueueJob;
	colors: ReturnType<typeof useColors>;
	onDelete: (job: QueueJob) => Promise<boolean>;
	onOpenOptions: (job: QueueJob) => void;
	onPress: (job: QueueJob) => void;
}) {
	const { width } = useWindowDimensions();
	const swipeRef = useRef<any>(null);
	const isDeletingRef = useRef(false);
	const rowHeight = useSharedValue(0);
	const deleteProgress = useSharedValue(0);
	const canDelete = canDeleteQueueJob(job);
	const fullSwipeThreshold = useMemo(
		() => getSwipeDeleteThreshold(width),
		[width],
	);
	const progress = getTranscriptionJobProgress(job);
	const title = getQueueJobTitle(job);
	const stage = formatJobStage(job);
	const model = getQueueJobModel(job);
	const blogId = job.media?.blog?.id;
	const isFailed = job.status === "failed";
	const isComplete =
		job.status === "completed" || job.status === "already_transcribed";
	const statusLabel = formatQueueStatus(job.status);

	const finishDelete = useCallback(async () => {
		const deleted = await onDelete(job);
		if (!deleted) {
			swipeRef.current?.close();
			deleteProgress.value = withTiming(0, {
				duration: 180,
				easing: Easing.out(Easing.cubic),
			});
		}
		isDeletingRef.current = false;
	}, [deleteProgress, job, onDelete]);

	const handleSwipeWillOpen = useCallback(
		(direction: SwipeDirection) => {
			if (
				!canDelete ||
				direction !== SwipeDirection.LEFT ||
				isDeletingRef.current
			) {
				swipeRef.current?.close();
				return;
			}

			isDeletingRef.current = true;
			deleteProgress.value = withTiming(
				1,
				{ duration: 240, easing: Easing.out(Easing.cubic) },
				(finished) => {
					if (finished) {
						runOnJS(finishDelete)();
					}
				},
			);
		},
		[canDelete, deleteProgress, finishDelete],
	);

	const containerStyle = useAnimatedStyle(() => {
		const measuredHeight = rowHeight.value;
		const height =
			measuredHeight > 0
				? interpolate(
						deleteProgress.value,
						[0, 1],
						[measuredHeight, 0],
						Extrapolation.CLAMP,
					)
				: undefined;

		return {
			height,
			opacity: interpolate(
				deleteProgress.value,
				[0, 0.7, 1],
				[1, 0.35, 0],
				Extrapolation.CLAMP,
			),
			overflow: "hidden",
			transform: [
				{
					translateX: interpolate(
						deleteProgress.value,
						[0, 1],
						[0, -Math.min(width * 0.18, 72)],
						Extrapolation.CLAMP,
					),
				},
			],
		};
	});

	const renderRightActions = useCallback(
		(progressValue: SharedValue<number>, translation: SharedValue<number>) => (
			<SwipeDeleteAction
				progress={progressValue}
				translation={translation}
				actionWidth={width}
				fullSwipeThreshold={fullSwipeThreshold}
			/>
		),
		[fullSwipeThreshold, width],
	);

	return (
		<Animated.View
			onLayout={(event) => {
				if (!isDeletingRef.current) {
					rowHeight.value = event.nativeEvent.layout.height;
				}
			}}
			style={containerStyle}
		>
			<ReanimatedSwipeable
				ref={swipeRef}
				enabled={canDelete}
				friction={1.15}
				overshootFriction={8}
				overshootRight={false}
				rightThreshold={fullSwipeThreshold}
				onSwipeableWillOpen={handleSwipeWillOpen}
				renderRightActions={renderRightActions}
			>
				<Pressable
					className="rounded-xl border border-border bg-card p-4"
					disabled={!blogId || isDeletingRef.current}
					onPress={() => onPress(job)}
					style={{
						backgroundColor: colors.card,
						borderColor: colors.border,
						opacity: blogId ? 1 : 0.85,
					}}
				>
					<View className="flex-row items-center gap-3">
						<View
							className="size-10 items-center justify-center rounded-full"
							style={{
								backgroundColor: isFailed
									? withAlpha(colors.destructive, 0.12)
									: isComplete
										? withAlpha(colors.success, 0.12)
										: withAlpha(colors.primary, 0.12),
							}}
						>
							{job.status === "running" ? (
								<ActivityIndicator color={colors.primary} />
							) : (
								<Icon
									name={getQueueJobIconName(job)}
									className={
										isFailed
											? "text-destructive"
											: isComplete
												? "text-success"
												: "text-primary"
									}
								/>
							)}
						</View>
						<View className="min-w-0 flex-1">
							<Text
								className="text-sm font-bold text-foreground"
								numberOfLines={1}
								style={{ color: colors.foreground }}
							>
								{title}
							</Text>
							<Text
								className="mt-0.5 text-xs text-muted-foreground"
								numberOfLines={1}
								style={{ color: colors.mutedForeground }}
							>
								{formatRange(job.fromSec, job.toSec)} ·{" "}
								{formatDate(job.createdAt)}
							</Text>
							{stage ? (
								<Text
									className="mt-0.5 text-xs capitalize text-muted-foreground"
									numberOfLines={1}
									style={{ color: colors.mutedForeground }}
								>
									{stage}
								</Text>
							) : null}
							{model ? (
								<Text
									className="mt-0.5 text-xs text-muted-foreground"
									numberOfLines={1}
									style={{ color: colors.mutedForeground }}
								>
									Model: {model}
								</Text>
							) : null}
						</View>
						<View className="items-end gap-0.5">
							<Pressable
								className="size-9 items-center justify-center rounded-full active:bg-muted"
								onPress={(event) => {
									event.stopPropagation?.();
									onOpenOptions(job);
								}}
							>
								<Icon
									name="MoreHorizontal"
									size={16}
									className="text-muted-foreground"
								/>
							</Pressable>
							<Text
								className="text-xs font-bold text-muted-foreground"
								style={{ color: colors.mutedForeground }}
							>
								{statusLabel}
							</Text>
							<Text
								className="text-xs font-bold text-foreground"
								style={{ color: colors.foreground }}
							>
								{progress}%
							</Text>
						</View>
					</View>
					<View
						className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
						style={{ backgroundColor: colors.muted }}
					>
						<View
							className="h-full rounded-full bg-primary"
							style={{
								backgroundColor: isFailed
									? colors.destructive
									: isComplete
										? colors.success
										: colors.primary,
								width: `${progress}%`,
							}}
						/>
					</View>
					{job.errorMessage ? (
						<Text
							className="mt-3 text-xs leading-5 text-muted-foreground"
							style={{
								color: isFailed ? colors.destructive : colors.mutedForeground,
							}}
						>
							{job.errorMessage}
						</Text>
					) : null}
				</Pressable>
			</ReanimatedSwipeable>
		</Animated.View>
	);
}

export default function TranscribeQueueScreen() {
	const router = useRouter();
	const colors = useColors();
	const { connectionStatus, localApiClient } = useLocalServicesSession();
	const { jobs, queuedCount, isRunning, deleteJob, runQueued, reload } =
		useTranscriptionQueue();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null);
	const counts = useMemo(
		() =>
			jobs.reduce(
				(acc, job) => {
					acc[job.status] = (acc[job.status] ?? 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			),
		[jobs],
	);
	const overallProgress = useMemo(() => {
		if (jobs.length === 0) return 0;
		const total = jobs.reduce(
			(sum, job) => sum + getTranscriptionJobProgress(job),
			0,
		);
		return Math.round(total / jobs.length);
	}, [jobs]);
	const refresh = async () => {
		setIsRefreshing(true);
		try {
			await reload();
		} finally {
			setIsRefreshing(false);
		}
	};

	const deleteQueueJob = useCallback(
		async (job: QueueJob) => {
			try {
				await deleteJob(job.id);
				if (selectedJob?.id === job.id) {
					setSelectedJob(null);
				}
				return true;
			} catch (error) {
				await reload().catch((reloadError) =>
					console.warn("[TranscribeQueue] reload after delete failed", reloadError),
				);
				Alert.alert(
					"Could not delete transcription",
					error instanceof Error
						? error.message
						: "This transcription job could not be deleted.",
				);
				return false;
			}
		},
		[deleteJob, reload, selectedJob?.id],
	);

	const openQueueJob = useCallback(
		(job: QueueJob) => {
			const blogId = job.media?.blog?.id;
			if (blogId) {
				router.push(`/blog-view-2/${blogId}` as any);
			}
		},
		[router],
	);

	const resetSelectedJob = () => {
		if (!selectedJob) return;
		const jobToReset = selectedJob;
		const mediaId = jobToReset.mediaId;
		Alert.alert(
			"Reset transcription?",
			"This will clear the saved transcript and queued jobs for this audio.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Reset",
					style: "destructive",
					onPress: async () => {
						try {
							if (!localApiClient || connectionStatus !== "online") {
								throw new Error("The selected local API is offline.");
							}
							await localApiClient.blog.resetTranscript.mutate({ mediaId });
							setSelectedJob(null);
							await reload();
							Alert.alert("Queue for transcribing", undefined, [
								{ text: "No", style: "cancel" },
								{
									text: "Yes",
									onPress: async () => {
										try {
											await localApiClient.blog.enqueueTranscriptionJob.mutate({
												mediaId,
												telegramFileId: jobToReset.telegramFileId ?? null,
												audioUrl: jobToReset.audioUrl ?? null,
												fromSec: jobToReset.fromSec ?? null,
												toSec: jobToReset.toSec ?? null,
												language: jobToReset.language ?? "ar",
												transcriberUrl: jobToReset.transcriberUrl ?? null,
											});
											await reload();
										} catch (error) {
											Alert.alert(
												"Could not queue transcription",
												error instanceof Error
													? error.message
													: "This audio could not be queued.",
											);
										}
									},
								},
							]);
						} catch (error) {
							Alert.alert(
								"Could not reset transcription",
								error instanceof Error
									? error.message
									: "This transcription could not be reset.",
							);
						}
					},
				},
			],
		);
	};

	return (
		<View
			className="flex-1 bg-background"
			style={{ backgroundColor: colors.background }}
		>
			<SafeArea>
				<View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
					<Pressable
						className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted"
						onPress={() => router.back()}
					>
						<Icon name="ArrowLeft" className="text-foreground" />
					</Pressable>
					<View className="min-w-0 flex-1">
						<Text
							className="text-xl font-bold text-foreground"
							style={{ color: colors.foreground }}
						>
							Transcribe Queue
						</Text>
						<Text
							className="text-xs font-medium text-muted-foreground"
							style={{ color: colors.mutedForeground }}
						>
							{jobs.length} jobs · {queuedCount} waiting · {overallProgress}%
						</Text>
					</View>
					<Pressable
						className="min-h-11 rounded-full bg-primary px-4 items-center justify-center active:opacity-80"
						disabled={isRunning}
						onPress={() => {
							void runQueued();
						}}
						style={{
							backgroundColor: isRunning ? colors.muted : colors.primary,
						}}
					>
						<Text
							className="text-sm font-bold"
							style={{
								color: isRunning
									? colors.mutedForeground
									: colors.primaryForeground,
							}}
						>
							{isRunning ? "Refreshing" : "Refresh"}
						</Text>
					</Pressable>
				</View>

				<View className="flex-row flex-wrap gap-2 px-4 py-3">
					{QUEUE_STATUS_FILTERS.map((status) => (
						<View
							key={status}
							className="rounded-full px-2.5 py-1"
							style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
						>
							<Text
								className="text-[11px] font-semibold text-primary"
								style={{ color: colors.primary }}
							>
								{formatQueueStatus(status)} {counts[status] ?? 0}
							</Text>
						</View>
					))}
				</View>

				{jobs.length > 0 ? (
					<View className="px-4 pb-3">
						<View
							className="h-2 overflow-hidden rounded-full bg-muted"
							style={{ backgroundColor: colors.muted }}
						>
							<View
								className="h-full rounded-full bg-primary"
								style={{
									backgroundColor: colors.primary,
									width: `${overallProgress}%`,
								}}
							/>
						</View>
					</View>
				) : null}

				<ScrollView
					className="flex-1"
					contentContainerStyle={{ paddingBottom: 40 }}
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={() => {
								void refresh();
							}}
							tintColor={colors.primary}
							colors={[colors.primary]}
						/>
					}
				>
					{jobs.length === 0 ? (
						<View className="items-center justify-center px-8 py-16">
							<View
								className="mb-4 size-14 items-center justify-center rounded-full"
								style={{ backgroundColor: withAlpha(colors.primary, 0.12) }}
							>
								<Icon name="Captions" className="text-primary" />
							</View>
							<Text
								className="text-center text-base font-bold text-foreground"
								style={{ color: colors.foreground }}
							>
								No transcriptions queued
							</Text>
							<Text
								className="mt-2 text-center text-sm leading-5 text-muted-foreground"
								style={{ color: colors.mutedForeground }}
							>
								Open an audio post menu and choose Queue for transcribe.
							</Text>
						</View>
					) : (
						<View className="gap-2 px-4">
							{jobs.map((job) => (
								<QueueJobRow
									key={job.id}
									job={job}
									colors={colors}
									onDelete={deleteQueueJob}
									onOpenOptions={setSelectedJob}
									onPress={openQueueJob}
								/>
							))}
						</View>
					)}
				</ScrollView>
			</SafeArea>
			<FloatingBottomSheet
				visible={Boolean(selectedJob)}
				onClose={() => setSelectedJob(null)}
				accessibilityLabel="Transcription options"
			>
				<View className="bg-card px-4 pb-8" style={{ backgroundColor: colors.card }}>
					<Text
						className="text-base font-bold text-foreground"
						numberOfLines={1}
						style={{ color: colors.foreground }}
					>
						{selectedJob ? getQueueJobTitle(selectedJob) : "Transcription"}
					</Text>
					<Pressable
						className="mt-4 min-h-14 flex-row items-center gap-3 rounded-2xl px-3 py-2 active:bg-muted"
						onPress={resetSelectedJob}
					>
						<View
							className="size-11 items-center justify-center rounded-full"
							style={{ backgroundColor: withAlpha(colors.destructive, 0.12) }}
						>
							<Icon name="RotateCcw" className="text-destructive" />
						</View>
						<View className="min-w-0 flex-1">
							<Text
								className="text-sm font-bold text-destructive"
								style={{ color: colors.destructive }}
							>
								Reset transcribe
							</Text>
							<Text
								className="mt-0.5 text-xs text-muted-foreground"
								numberOfLines={1}
								style={{ color: colors.mutedForeground }}
							>
								Clear transcript and queue jobs
							</Text>
						</View>
					</Pressable>
				</View>
			</FloatingBottomSheet>
		</View>
	);
}
