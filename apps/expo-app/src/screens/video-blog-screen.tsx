import { KaraokeTranscript } from "@/components/audio-blog-view/karaoke-transcript";
import {
	type RawTranscriptSegment,
	normalizeTranscriptSegment,
} from "@/components/audio-blog-view/transcript-timing";
import {
	type CommentsSheetState,
	useCommentsState,
} from "@/components/comments-sheet";
import { CommentInput } from "@/components/comments-sheet/comment-input";
import { CommentsList } from "@/components/comments-sheet/comments-list";
import { _trpc } from "@/components/static-trpc";
import { TranscriptionRequestModal } from "@/components/transcription-request-modal";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { getMediaFileUrl } from "@/lib/media-source";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { withAlpha } from "@/lib/theme";
import {
	getDefaultTranscriberUrl,
	isHttpTranscriberUrl,
} from "@/lib/transcribe";
import { getTranscriptionBadgeState } from "@/lib/transcription-status";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { formatDate } from "@acme/utils/dayjs";
import { type AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Linking,
	Modal,
	Platform,
	Share,
	Text,
	TouchableWithoutFeedback,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BlogMedia = {
	id?: number | null;
	fileId?: string | number | null;
	mimeType?: string | null;
	title?: string | null;
	file?: {
		duration?: number | null;
		fileId?: string | number | null;
		fileName?: string | null;
		mimeType?: string | null;
		source?: string | null;
	} | null;
};

const CONTROLS_HIDE_DELAY_MS = 2600;
const VIDEO_RATE_OPTIONS = [1, 1.25, 1.5, 2] as const;
const VIDEO_META_BOTTOM_OFFSET = 156;
const VIDEO_ACTIONS_BOTTOM_OFFSET = 86;
const VIDEO_PROGRESS_BOTTOM_OFFSET = 72;
const VIDEO_TRANSPORT_BOTTOM_OFFSET = 8;

function formatDuration(seconds?: number | null) {
	if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
	const total = Math.floor(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	}
	return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getLoadedStatus(status: AVPlaybackStatus | null) {
	return status?.isLoaded ? status : null;
}

function isVideoMedia(media: any) {
	const mimeType = String(media?.mimeType ?? "").toLowerCase();
	const fileMimeType = String(media?.file?.mimeType ?? "").toLowerCase();
	return mimeType.startsWith("video/") || fileMimeType.startsWith("video/");
}

function getVideoMedia(blog?: { medias?: BlogMedia[] } | null) {
	return blog?.medias?.find(isVideoMedia) ?? blog?.medias?.[0] ?? null;
}

function getVideoTitle(blog: any, media: any) {
	const fromMedia = media?.title || media?.file?.fileName;
	if (fromMedia) return fromMedia;
	const firstLine = String(blog?.content ?? "")
		.split("\n")
		.map((line) => line.trim())
		.find(Boolean);
	return firstLine || `Video #${blog?.id ?? ""}`;
}

function getCaptionPreview(blog: any, title: string) {
	const value = String(blog?.content ?? "").trim();
	if (!value || value === title) return null;
	return value;
}

function getMediaKey(media: any) {
	return String(media?.id ?? media?.fileId ?? media?.file?.fileId ?? "");
}

function VideoCommentsSheet({
	blogId,
	visible,
	onClose,
	fallbackCount,
}: {
	blogId: number;
	visible: boolean;
	onClose: () => void;
	fallbackCount: number;
}) {
	const insets = useSafeAreaInsets();
	const state = useCommentsState(blogId);
	const count = state.isLoading ? fallbackCount : state.comments.length;

	return (
		<Modal
			animationType="slide"
			onRequestClose={onClose}
			transparent
			visible={visible}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				className="flex-1 justify-end"
			>
				<View className="flex-1 justify-end bg-black/60">
					<TouchableWithoutFeedback onPress={onClose}>
						<View className="absolute inset-0" />
					</TouchableWithoutFeedback>

					<View
						className="overflow-hidden rounded-t-[28px] border-t border-border bg-background shadow-2xl"
						style={{
							height: "82%",
							paddingBottom: Math.max(insets.bottom, 10),
						}}
					>
						<View className="items-center pb-2 pt-3">
							<View className="h-1.5 w-12 rounded-full bg-muted" />
						</View>

						<View className="flex-row items-center gap-3 border-b border-border px-5 pb-3">
							<View className="flex-1">
								<Text className="text-lg font-extrabold text-foreground">
									Comments
								</Text>
								<Text className="text-xs font-semibold text-muted-foreground">
									{count} {count === 1 ? "comment" : "comments"}
								</Text>
							</View>

							<SheetHeaderButton
								icon="Search"
								onPress={() => state.setSearchVisible(!state.searchVisible)}
								state={state}
							/>
							<Pressable
								onPress={onClose}
								className="size-10 items-center justify-center rounded-full bg-card"
							>
								<Icon name="X" size={17} className="text-foreground" />
							</Pressable>
						</View>

						<View className="flex-1">
							<CommentsList state={state} />
						</View>

						<CommentInput
							blogId={blogId}
							compact
							noKeyboardAvoid
							onCommentAdded={state.refetch}
						/>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function SheetHeaderButton({
	icon,
	onPress,
	state,
}: {
	icon: "Search";
	onPress: () => void;
	state: CommentsSheetState;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="size-10 items-center justify-center rounded-full bg-card"
		>
			<Icon
				name={icon}
				size={17}
				className={
					state.searchVisible ? "text-primary" : "text-muted-foreground"
				}
			/>
		</Pressable>
	);
}

function ActionButton({
	icon,
	label,
	onPress,
	disabled,
	color,
	shape = "pill",
}: {
	icon: "MessageCircle" | "Share" | "Compass" | "Captions";
	label: string;
	onPress: () => void;
	disabled?: boolean;
	color?: string;
	shape?: "pill" | "circle";
}) {
	const isCircle = shape === "circle";

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityLabel={label}
			className={`h-[52px] flex-row items-center justify-center rounded-full border border-white/5 bg-[#17212B] active:opacity-80 disabled:opacity-40 ${
				isCircle ? "w-[52px]" : "min-w-0 flex-1 gap-2 px-3"
			}`}
		>
			<Icon name={icon} size={isCircle ? 23 : 21} color={color ?? "#ffffff"} />
			{isCircle ? null : (
				<Text
					className="min-w-0 text-[13px] font-extrabold"
					style={{ color: color ?? "#ffffff" }}
					numberOfLines={1}
				>
					{label}
				</Text>
			)}
		</Pressable>
	);
}

export default function VideoBlogScreen() {
	const { blogId } = useLocalSearchParams<{ blogId?: string }>();
	const router = useRouter();
	const colors = useColors();
	const qc = useQueryClient();
	const insets = useSafeAreaInsets();
	const videoRef = useRef<Video>(null);
	const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [transcriptionModalOpen, setTranscriptionModalOpen] = useState(false);
	const [isQueueingTranscription, setIsQueueingTranscription] = useState(false);
	const [controlsVisible, setControlsVisible] = useState(true);
	const [controlsVisibleUntil, setControlsVisibleUntil] = useState(
		() => Date.now() + CONTROLS_HIDE_DELAY_MS,
	);
	const [hasPlaybackEnded, setHasPlaybackEnded] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [videoRate, setVideoRate] =
		useState<(typeof VIDEO_RATE_OPTIONS)[number]>(1);
	const setGlobalAudioBarHidden = useGlobalAudioBarStore((s) => s.setHidden);
	const localTranscriberBaseUrl = useAppSettingsStore(
		(s) => s.localTranscriberBaseUrl,
	);
	const localServicesIp = useAppSettingsStore((s) => s.localServicesIp);
	const localApiLastIp = useAppSettingsStore((s) => s.localApiLastIp);
	const transcriberUrl = getDefaultTranscriberUrl(
		localTranscriberBaseUrl,
		localServicesIp ?? localApiLastIp,
	);
	const canCheckTranscriber = isHttpTranscriberUrl(transcriberUrl);
	const id = Number(blogId);
	const canQuery = Number.isFinite(id) && id > 0;

	const { data: blog, isLoading } = useQuery(
		_trpc.blog.getBlog.queryOptions(
			{ id: id || 0 },
			{
				enabled: canQuery,
			},
		),
	);

	const defaultMedia = useMemo(() => getVideoMedia(blog), [blog]);
	const media = defaultMedia;

	const mediaFile = media?.file;
	const videoUrl = getMediaFileUrl(mediaFile);
	const mediaId = media?.id ?? undefined;
	const telegramFileId =
		mediaFile?.source === "vercel_blob"
			? null
			: mediaFile?.fileId
				? String(mediaFile.fileId)
				: null;
	const title = getVideoTitle(blog, media);
	const caption = getCaptionPreview(blog, title);
	const loadedStatus = getLoadedStatus(status);
	const durationLabel =
		formatDuration(
			loadedStatus?.durationMillis ? loadedStatus.durationMillis / 1000 : null,
		) ?? formatDuration(mediaFile?.duration);
	const positionLabel = formatDuration(
		loadedStatus?.positionMillis ? loadedStatus.positionMillis / 1000 : null,
	);
	const progress =
		loadedStatus?.durationMillis && loadedStatus.durationMillis > 0
			? Math.min(
					100,
					Math.max(
						0,
						(loadedStatus.positionMillis / loadedStatus.durationMillis) * 100,
					),
				)
			: 0;
	const date = blog?.blogDate ?? blog?.createdAt;
	const tags =
		blog?.blogTags?.map((tag: any) => tag.tags?.title).filter(Boolean) ?? [];
	const commentCount = blog?.blogs?.length ?? 0;
	const channelLabel =
		blog?.channel?.title || blog?.channel?.username || "Al-Ghurobaa";
	const channelInitial = channelLabel.trim().charAt(0).toUpperCase() || "A";
	const sourceUrl = (blog as any)?.sourceUrl;
	const isPlaying = Boolean(loadedStatus?.isPlaying);
	const activeMediaKey = getMediaKey(media);
	const videoDurationSec =
		mediaFile?.duration ??
		(loadedStatus?.durationMillis ? loadedStatus.durationMillis / 1000 : null);
	const {
		enqueue: enqueueTranscription,
		deleteJob: deleteTranscriptionJob,
		jobs: transcriptionJobs,
		reload: reloadTranscriptionJobs,
	} = useTranscriptionQueue(mediaId, {
		autoLoad: Boolean(mediaId),
		reloadOnEnqueue: false,
	});
	const { data: transcriptData } = useQuery({
		..._trpc.blog.getTranscript.queryOptions({ mediaId: mediaId ?? 0 }),
		enabled: Boolean(mediaId),
	});
	const latestTranscriptionJob = transcriptionJobs.find(
		(job) => job.mediaId === mediaId,
	);
	const queuedTranscriptionJob = transcriptionJobs.find(
		(job) => job.mediaId === mediaId && job.status === "queued",
	);
	const runningTranscriptionJob = transcriptionJobs.find(
		(job) => job.mediaId === mediaId && job.status === "running",
	);
	const latestTranscriptionStatus =
		latestTranscriptionJob?.status === "completed"
			? "done"
			: latestTranscriptionJob?.status;
	const transcriptSegments = useMemo(
		() =>
			(transcriptData?.segments ?? []).map((segment, index) =>
				normalizeTranscriptSegment(segment as RawTranscriptSegment, index),
			),
		[transcriptData?.segments],
	);
	const transcriptBadge = getTranscriptionBadgeState({
		...(media as any),
		transcript: transcriptData
			? {
					status: transcriptData.status,
					segments: transcriptData.segments,
				}
			: (media as any)?.transcript,
		transcriptStatus:
			transcriptData?.status ??
			(media as any)?.transcriptStatus ??
			latestTranscriptionStatus,
		transcriptionJobStatus:
			latestTranscriptionJob?.status ?? (media as any)?.transcriptionJobStatus,
		transcriptionJobs,
		duration: videoDurationSec,
	});
	const isVideoAlreadyTranscribed = transcriptBadge.isFullyTranscribed;
	const transcriptBadgeColor =
		transcriptBadge.tone === "success"
			? colors.success
			: transcriptBadge.tone === "warn"
				? colors.warn
				: transcriptBadge.tone === "muted"
					? colors.warn
					: colors.primary;
	const transcribeActionLabel = queuedTranscriptionJob
		? "Queued"
		: runningTranscriptionJob
			? "Running"
			: isVideoAlreadyTranscribed
				? "Transcript"
				: "Transcribe";
	const transcriptionStatusLabel = latestTranscriptionJob
		? `Latest job: ${latestTranscriptionJob.status}`
		: canCheckTranscriber
			? "Ready to queue with local Whisper"
			: "Local transcriber URL is not configured";
	const resetVideoTranscript = useMutation(
		_trpc.blog.resetTranscript.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					qc.invalidateQueries({
						queryKey: _trpc.blog.getTranscript.queryKey({
							mediaId: mediaId ?? 0,
						}),
					}),
					qc.invalidateQueries({
						queryKey: _trpc.blog.getBlog.queryKey({ id }),
					}),
				]);
				await reloadTranscriptionJobs();
			},
			onError: (e) => Alert.alert("Could not reset transcription", e.message),
		}),
	);

	const wakeControls = useCallback(() => {
		setControlsVisible(true);
		setControlsVisibleUntil(Date.now() + CONTROLS_HIDE_DELAY_MS);
	}, []);

	useEffect(() => {
		const previousHidden = useGlobalAudioBarStore.getState().hidden;
		setGlobalAudioBarHidden(true);

		return () => {
			setGlobalAudioBarHidden(previousHidden);
		};
	}, [setGlobalAudioBarHidden]);

	useEffect(() => {
		if (
			!videoUrl ||
			!controlsVisible ||
			commentsOpen ||
			transcriptionModalOpen
		) {
			return;
		}
		const delayMs = Math.max(0, controlsVisibleUntil - Date.now());
		const timeout = setTimeout(() => {
			setControlsVisible(false);
		}, delayMs);

		return () => clearTimeout(timeout);
	}, [
		commentsOpen,
		controlsVisible,
		controlsVisibleUntil,
		transcriptionModalOpen,
		videoUrl,
	]);

	useEffect(() => {
		if (!activeMediaKey) return;
		setStatus(null);
		setHasPlaybackEnded(false);
		wakeControls();
	}, [activeMediaKey, wakeControls]);

	const handlePlaybackStatusUpdate = useCallback(
		(nextStatus: AVPlaybackStatus) => {
			setStatus(nextStatus);
			const nextLoadedStatus = getLoadedStatus(nextStatus);
			if (!nextLoadedStatus) return;
			if (nextLoadedStatus.didJustFinish) {
				setHasPlaybackEnded(true);
				wakeControls();
				return;
			}
			if (nextLoadedStatus.isPlaying) {
				setHasPlaybackEnded(false);
			}
		},
		[wakeControls],
	);

	const togglePlayback = useCallback(async () => {
		if (!videoRef.current) return;
		wakeControls();
		if (loadedStatus?.isPlaying) {
			await videoRef.current.pauseAsync();
			return;
		}
		const durationMillis = loadedStatus?.durationMillis ?? 0;
		const positionMillis = loadedStatus?.positionMillis ?? 0;
		const shouldRestart =
			hasPlaybackEnded ||
			(durationMillis > 0 && positionMillis >= durationMillis - 250);
		if (shouldRestart) {
			setHasPlaybackEnded(false);
			await videoRef.current.setPositionAsync(0);
		}
		await videoRef.current.playAsync();
	}, [hasPlaybackEnded, loadedStatus, wakeControls]);

	const cycleVideoRate = useCallback(async () => {
		const currentIndex = VIDEO_RATE_OPTIONS.findIndex(
			(rate) => Math.abs(rate - videoRate) < 0.01,
		);
		const nextRate =
			VIDEO_RATE_OPTIONS[(currentIndex + 1) % VIDEO_RATE_OPTIONS.length] ?? 1;
		setVideoRate(nextRate);
		wakeControls();
		await videoRef.current?.setRateAsync(nextRate, true);
	}, [videoRate, wakeControls]);

	const toggleMuted = useCallback(async () => {
		const nextMuted = !isMuted;
		setIsMuted(nextMuted);
		wakeControls();
		await videoRef.current?.setIsMutedAsync(nextMuted);
	}, [isMuted, wakeControls]);

	const handleVideoSurfacePress = useCallback(() => {
		wakeControls();
	}, [wakeControls]);

	const handlePressTranscriptSegment = useCallback(
		(segment: { startSec: number }, _index: number, shouldPlay: boolean) => {
			if (!videoRef.current) return;
			void videoRef.current
				.setPositionAsync(segment.startSec * 1000)
				.then(() => {
					if (shouldPlay) return videoRef.current?.playAsync();
				});
		},
		[],
	);

	async function shareVideo() {
		await Share.share({
			message: videoUrl || sourceUrl || title,
		});
	}

	async function openSource() {
		if (!sourceUrl) return;
		await Linking.openURL(sourceUrl);
	}

	async function queueVideoTranscription() {
		if (!mediaId) return false;
		let reachableVideoUrl =
			videoUrl?.startsWith("http://") || videoUrl?.startsWith("https://")
				? videoUrl
				: null;

		if (!telegramFileId && !reachableVideoUrl) {
			Alert.alert(
				"Cannot transcribe yet",
				"This video does not have a reachable file source to queue.",
			);
			return false;
		}

		try {
			setIsQueueingTranscription(true);
			if (!reachableVideoUrl && telegramFileId) {
				const resolved = await getTelegramFileUrl(telegramFileId);
				reachableVideoUrl =
					resolved?.url?.startsWith("http://") ||
					resolved?.url?.startsWith("https://")
						? resolved.url
						: null;
			}

			if (!reachableVideoUrl) {
				throw new Error(
					"Could not resolve a reachable video URL for this job.",
				);
			}

			await enqueueTranscription({
				mediaId,
				telegramFileId: telegramFileId ?? null,
				audioUrl: reachableVideoUrl,
				language: "ar",
				transcriberUrl,
			});
			await reloadTranscriptionJobs();
			Alert.alert("Queued", "Added video to transcription queue.");
			return true;
		} catch (error) {
			Alert.alert(
				"Could not queue transcription",
				error instanceof Error
					? error.message
					: "This video could not be added to the transcription queue.",
			);
			return false;
		} finally {
			setIsQueueingTranscription(false);
		}
	}

	async function startVideoTranscriptionFromModal() {
		const queued = await queueVideoTranscription();
		if (queued) setTranscriptionModalOpen(false);
	}

	function confirmRemoveQueuedVideoTranscription(jobId: number) {
		Alert.alert(
			"Remove from queue?",
			"This video is already queued for transcription.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: () => {
						void deleteTranscriptionJob(jobId)
							.then(reloadTranscriptionJobs)
							.catch((error) =>
								Alert.alert(
									"Could not remove queue item",
									error instanceof Error
										? error.message
										: "This queued transcription could not be removed.",
								),
							);
					},
				},
			],
		);
	}

	function confirmCompletedVideoTranscriptionAction() {
		if (!mediaId) return;
		Alert.alert(
			"Transcript available",
			"Clear the saved transcript or clear it and queue a new transcription.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Clear",
					style: "destructive",
					onPress: () => resetVideoTranscript.mutate({ mediaId }),
				},
				{
					text: "Re-transcribe",
					onPress: () => {
						void resetVideoTranscript
							.mutateAsync({ mediaId })
							.then(() => queueVideoTranscription());
					},
				},
			],
		);
	}

	function handleVideoTranscriptionPress() {
		if (queuedTranscriptionJob) {
			confirmRemoveQueuedVideoTranscription(queuedTranscriptionJob.id);
			return;
		}
		if (runningTranscriptionJob) {
			Alert.alert(
				"Transcription running",
				"This video is already being transcribed.",
			);
			return;
		}
		if (isVideoAlreadyTranscribed) {
			confirmCompletedVideoTranscriptionAction();
			return;
		}
		setTranscriptionModalOpen(true);
	}

	if (!canQuery || isLoading) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: "#05070B" }}
			>
				{isLoading ? (
					<ActivityIndicator color={colors.primary} />
				) : (
					<Text className="text-sm font-semibold text-white/70">
						Invalid video
					</Text>
				)}
			</View>
		);
	}

	if (!blog) return null;

	return (
		<View className="flex-1 bg-black">
			<View className="absolute inset-0 bg-black">
				{videoUrl ? (
					<Pressable className="flex-1" onPress={handleVideoSurfacePress}>
						<Video
							key={activeMediaKey || videoUrl}
							ref={videoRef}
							source={{ uri: videoUrl }}
							style={{ flex: 1 }}
							resizeMode={ResizeMode.CONTAIN}
							isMuted={isMuted}
							progressUpdateIntervalMillis={500}
							onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
						/>
					</Pressable>
				) : (
					<View className="flex-1 items-center justify-center px-8">
						<View className="mb-4 size-16 items-center justify-center rounded-full bg-white/10">
							<Icon name="Play" size={32} className="text-white" />
						</View>
						<Text className="text-center text-base font-extrabold text-white">
							Video file is not available yet.
						</Text>
					</View>
				)}
			</View>

			{controlsVisible ? (
				<LinearGradient
					pointerEvents="none"
					colors={["rgba(0,0,0,0.72)", "transparent", "rgba(0,0,0,0.88)"]}
					locations={[0, 0.38, 1]}
					className="absolute inset-0"
				/>
			) : null}

			{controlsVisible ? (
				<View
					className="absolute inset-x-0 flex-row items-center justify-between px-6"
					style={{ top: insets.top + 12 }}
				>
					<Pressable
						onPress={() => router.back()}
						className="size-[52px] items-center justify-center rounded-full bg-[#1A2834] active:opacity-80"
					>
						<Icon name="ArrowLeft" size={27} className="text-white" />
					</Pressable>

					<Pressable
						onPress={openSource}
						disabled={!sourceUrl}
						className="size-[52px] items-center justify-center rounded-full bg-[#1A2834] active:opacity-80 disabled:opacity-45"
					>
						<Icon
							name="MoreHorizontal"
							size={28}
							className="text-white"
							style={{ transform: [{ rotate: "90deg" }] }}
						/>
					</Pressable>
				</View>
			) : null}

			{videoUrl && controlsVisible ? (
				<View
					className="absolute inset-x-0 px-6"
					style={{ bottom: insets.bottom + VIDEO_META_BOTTOM_OFFSET }}
				>
					<View className="mb-3 flex-row items-center gap-3">
						<View
							className="size-12 items-center justify-center rounded-full border-2 border-white"
							style={{ backgroundColor: withAlpha(colors.primary, 0.95) }}
						>
							<Text className="text-lg font-black text-primary-foreground">
								{channelInitial}
							</Text>
						</View>
						<View className="min-w-0 flex-1">
							<Text
								className="text-[15px] font-black text-white"
								numberOfLines={1}
							>
								{channelLabel}
							</Text>
							<Text className="mt-0.5 text-[13px] font-semibold text-white/75">
								{[
									durationLabel ? `Video ${durationLabel}` : "Video",
									date ? formatDate(date, "D MMM YYYY") : null,
								]
									.filter(Boolean)
									.join(" - ")}
							</Text>
						</View>
						<Pressable
							onPress={openSource}
							disabled={!sourceUrl}
							className="h-11 items-center justify-center rounded-full bg-[#1E2B36] px-5 active:opacity-80 disabled:opacity-45"
						>
							<Text className="text-[14px] font-black text-white">Source</Text>
						</Pressable>
					</View>

					<Text
						className="text-[16px] font-semibold leading-5 text-white"
						numberOfLines={2}
					>
						{title}
					</Text>

					{caption ? (
						<Text
							className="mt-1 text-[14px] font-medium leading-5 text-white/88"
							numberOfLines={2}
						>
							{caption}
						</Text>
					) : null}

					{tags.length > 0 ? (
						<View className="mt-3 flex-row flex-wrap gap-2 pr-6">
							{tags.slice(0, 4).map((tag: string) => (
								<View
									key={tag}
									className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1"
								>
									<Text className="text-[11px] font-bold text-white">
										#{tag}
									</Text>
								</View>
							))}
						</View>
					) : null}
				</View>
			) : null}

			{transcriptSegments.length > 0 ? (
				<View
					pointerEvents={controlsVisible ? "none" : "auto"}
					className="absolute inset-x-0"
					style={{
						top: insets.top + (controlsVisible ? 104 : 56),
						bottom: controlsVisible
							? insets.bottom + VIDEO_META_BOTTOM_OFFSET + 112
							: insets.bottom + 34,
					}}
				>
					<KaraokeTranscript
						segments={transcriptSegments}
						positionSecOverride={(loadedStatus?.positionMillis ?? 0) / 1000}
						autoScroll={isPlaying}
						playbackEnabled
						contentPaddingVertical={controlsVisible ? 48 : 120}
						onPressSegment={handlePressTranscriptSegment}
					/>
				</View>
			) : null}

			{controlsVisible ? (
				<View
					className="absolute inset-x-0 px-6"
					style={{ bottom: insets.bottom + VIDEO_ACTIONS_BOTTOM_OFFSET }}
				>
					<View className="flex-row items-center gap-2">
						<ActionButton
							icon="MessageCircle"
							label={commentCount > 0 ? String(commentCount) : "Comment"}
							onPress={() => setCommentsOpen(true)}
						/>
						<ActionButton
							icon="Captions"
							label={
								transcribeActionLabel === "Transcribe"
									? "Transcript"
									: transcribeActionLabel
							}
							onPress={handleVideoTranscriptionPress}
							disabled={!mediaId}
							color={transcriptBadge.show ? transcriptBadgeColor : undefined}
						/>
						<ActionButton
							icon="Compass"
							label="Source"
							onPress={openSource}
							disabled={!sourceUrl}
						/>
						<ActionButton
							icon="Share"
							label="Share"
							onPress={shareVideo}
							shape="circle"
						/>
					</View>
				</View>
			) : null}

			{controlsVisible ? (
				<View
					className="absolute inset-x-0"
					style={{
						bottom:
							Math.max(insets.bottom, 0) + VIDEO_PROGRESS_BOTTOM_OFFSET,
					}}
				>
					<View className="h-[3px] bg-white/20">
						<View
							className="h-full bg-white"
							style={{ width: `${progress}%` }}
						/>
					</View>
				</View>
			) : null}

			{controlsVisible ? (
				<View
					className="absolute inset-x-0 px-6"
					style={{
						bottom:
							Math.max(insets.bottom, 8) + VIDEO_TRANSPORT_BOTTOM_OFFSET,
					}}
				>
					<View className="h-14 flex-row items-center">
						<Pressable
							onPress={togglePlayback}
							disabled={!videoUrl}
							className="size-12 items-center justify-center active:opacity-80 disabled:opacity-40"
						>
							<Icon
								name={isPlaying ? "Pause" : "Play"}
								size={isPlaying ? 34 : 32}
								color="#FFFFFF"
								fill="#FFFFFF"
								style={isPlaying ? undefined : { marginLeft: 2 }}
							/>
						</Pressable>
						<Text className="ml-4 w-16 text-[15px] font-bold text-white/80">
							{positionLabel ?? "0:00"}
						</Text>
						<View className="flex-1" />
						<Pressable
							onPress={cycleVideoRate}
							className="h-11 min-w-14 items-center justify-center px-2 active:opacity-80"
						>
							<Text className="text-[17px] font-black text-white">
								{videoRate}x
							</Text>
						</Pressable>
						<Pressable
							onPress={toggleMuted}
							className="ml-5 size-11 items-center justify-center active:opacity-80"
						>
							<Icon
								name="Volume2"
								size={30}
								color={isMuted ? "rgba(255,255,255,0.45)" : "#FFFFFF"}
							/>
						</Pressable>
					</View>
				</View>
			) : null}

			<VideoCommentsSheet
				blogId={id}
				visible={commentsOpen}
				onClose={() => setCommentsOpen(false)}
				fallbackCount={commentCount}
			/>
			<TranscriptionRequestModal
				visible={transcriptionModalOpen}
				mediaKind="video"
				title={title}
				statusLabel={transcriptionStatusLabel}
				isStarting={isQueueingTranscription}
				canStart={Boolean(mediaId)}
				onClose={() => setTranscriptionModalOpen(false)}
				onStart={() => {
					void startVideoTranscriptionFromModal();
				}}
			/>
		</View>
	);
}
