import {
	type CommentsSheetState,
	useCommentsState,
} from "@/components/comments-sheet";
import { CommentInput } from "@/components/comments-sheet/comment-input";
import { CommentsList } from "@/components/comments-sheet/comments-list";
import { useLocalServicesSession } from "@/components/local-services";
import { _trpc } from "@/components/static-trpc";
import { TranscriptionRequestModal } from "@/components/transcription-request-modal";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { getMediaFileUrl } from "@/lib/media-source";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-query";
import { isHttpTranscriberUrl } from "@/lib/transcribe";
import { getTranscriptionBadgeState } from "@/lib/transcription-status";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { getFacebookExternalMedia } from "@acme/blog/facebook-media";
import { type AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Image,
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
	author?: {
		name?: string | null;
	} | null;
	album?: {
		name?: string | null;
	} | null;
	file?: {
		duration?: number | null;
		fileSize?: number | null;
		fileId?: string | number | null;
		fileName?: string | null;
		mimeType?: string | null;
		source?: string | null;
	} | null;
};

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
	shape = "pill",
	active = false,
}: {
	icon: "MessageCircle" | "Share" | "Heart";
	label?: string;
	onPress: () => void;
	disabled?: boolean;
	shape?: "pill" | "circle";
	active?: boolean;
}) {
	const isCircle = shape === "circle";

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityLabel={label ?? icon}
			className={`h-[52px] flex-row items-center justify-center rounded-full bg-[#1A2834] active:opacity-80 disabled:opacity-40 ${
				isCircle ? "w-[52px]" : "min-w-[112px] gap-2 px-5"
			}`}
		>
			<Icon
				name={icon}
				size={isCircle ? 25 : 24}
				color="#FFFFFF"
				fill={active ? "#FFFFFF" : "none"}
			/>
			{!isCircle && label ? (
				<Text
					className="min-w-0 text-[15px] font-semibold text-white"
					numberOfLines={1}
				>
					{label}
				</Text>
			) : null}
		</Pressable>
	);
}

export default function VideoBlogScreen() {
	const {
		isEnabled: localServicesEnabled,
		requestSetup: requestLocalServicesSetup,
		urls: localServiceUrls,
	} = useLocalServicesSession();
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
	const [hasPlaybackEnded, setHasPlaybackEnded] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [videoRate, setVideoRate] =
		useState<(typeof VIDEO_RATE_OPTIONS)[number]>(1);
	const setGlobalAudioBarHidden = useGlobalAudioBarStore((s) => s.setHidden);
	const transcriberUrl = localServiceUrls?.transcriberBaseUrl ?? null;
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
	const externalMedia = getFacebookExternalMedia({
		source: (blog as any)?.source,
		sourceUrl: (blog as any)?.sourceUrl,
		meta: (blog as any)?.meta,
		fileSize: mediaFile?.fileSize,
		mediaType: "video",
		mimeType: mediaFile?.mimeType ?? media?.mimeType,
		fileName: mediaFile?.fileName,
		duration: mediaFile?.duration,
		thumbnailFileId: (blog as any)?.thumbnail?.file?.fileId,
	});
	const videoUrl = externalMedia ? null : getMediaFileUrl(mediaFile);
	const externalThumbnailUrl = getMediaFileUrl((blog as any)?.thumbnail?.file);
	const mediaId = media?.id ?? undefined;
	const telegramFileId =
		externalMedia || mediaFile?.source === "vercel_blob"
			? null
			: mediaFile?.fileId
				? String(mediaFile.fileId)
				: null;
	const title = getVideoTitle(blog, media);
	const caption = getCaptionPreview(blog, title);
	const loadedStatus = getLoadedStatus(status);
	const durationSeconds =
		(loadedStatus?.durationMillis ?? 0) / 1000 || mediaFile?.duration || 0;
	const positionSeconds = (loadedStatus?.positionMillis ?? 0) / 1000;
	const remainingLabel = formatDuration(
		Math.max(0, durationSeconds - positionSeconds),
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
	const commentCount = blog?.blogs?.length ?? 0;
	const channelLabel =
		blog?.channel?.title || blog?.channel?.username || "Al-Ghurobaa";
	const channelInitial = channelLabel.trim().charAt(0).toUpperCase() || "A";
	const channelHandle = blog?.channel?.username
		? `@${String(blog.channel.username).replace(/^@/, "")}`
		: null;
	const sourceLabel =
		media?.author?.name || media?.album?.name || "Al-Ghurobaa";
	const sourceInitial = sourceLabel.trim().charAt(0).toUpperCase() || "A";
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
		autoLoad: Boolean(mediaId && !externalMedia),
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
	const { data: reactions = [] } = useQuery({
		..._trpc.blog.getReactions.queryOptions({ blogId: id || 0 }),
		enabled: canQuery,
	});
	const heartReaction = reactions.find((reaction) => reaction.emoji === "❤️");
	const toggleHeart = useMutation(
		_trpc.blog.addReaction.mutationOptions({
			onSettled: () => {
				qc.invalidateQueries(
					_trpc.blog.getReactions.queryOptions({ blogId: id }),
				);
			},
		}),
	);

	useEffect(() => {
		const previousHidden = useGlobalAudioBarStore.getState().hidden;
		setGlobalAudioBarHidden(true);

		return () => {
			setGlobalAudioBarHidden(previousHidden);
		};
	}, [setGlobalAudioBarHidden]);

	useEffect(() => {
		if (!activeMediaKey) return;
		setStatus(null);
		setHasPlaybackEnded(false);
		setControlsVisible(true);
	}, [activeMediaKey]);

	const handlePlaybackStatusUpdate = useCallback(
		(nextStatus: AVPlaybackStatus) => {
			setStatus(nextStatus);
			const nextLoadedStatus = getLoadedStatus(nextStatus);
			if (!nextLoadedStatus) return;
			if (nextLoadedStatus.didJustFinish) {
				setHasPlaybackEnded(true);
				return;
			}
			if (nextLoadedStatus.isPlaying) {
				setHasPlaybackEnded(false);
			}
		},
		[],
	);

	const togglePlayback = useCallback(async () => {
		if (!videoRef.current) return;
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
	}, [hasPlaybackEnded, loadedStatus]);

	const cycleVideoRate = useCallback(async () => {
		const currentIndex = VIDEO_RATE_OPTIONS.findIndex(
			(rate) => Math.abs(rate - videoRate) < 0.01,
		);
		const nextRate =
			VIDEO_RATE_OPTIONS[(currentIndex + 1) % VIDEO_RATE_OPTIONS.length] ?? 1;
		setVideoRate(nextRate);
		await videoRef.current?.setRateAsync(nextRate, true);
	}, [videoRate]);

	const toggleMuted = useCallback(async () => {
		const nextMuted = !isMuted;
		setIsMuted(nextMuted);
		await videoRef.current?.setIsMutedAsync(nextMuted);
	}, [isMuted]);

	const handleVideoSurfacePress = useCallback(() => {
		setControlsVisible((visible) => !visible);
	}, []);

	const presentFullscreen = useCallback(async () => {
		await videoRef.current?.presentFullscreenPlayer();
	}, []);

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
		if (!localServicesEnabled) {
			requestLocalServicesSetup();
			return false;
		}
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
		if (!localServicesEnabled) {
			requestLocalServicesSetup();
			return;
		}
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

	function handleMorePress() {
		if (externalMedia) {
			const destination =
				externalMedia.destination === "telegram" ? "Telegram" : "Facebook";
			Alert.alert("Video options", undefined, [
				{
					text: `Open in ${destination}`,
					onPress: () => void Linking.openURL(externalMedia.externalUrl),
				},
				{ text: "Cancel", style: "cancel" },
			]);
			return;
		}
		const transcriptAction = {
			text: "Transcript",
			onPress: handleVideoTranscriptionPress,
		};
		const cancelAction = { text: "Cancel", style: "cancel" as const };

		if (sourceUrl) {
			Alert.alert("Video options", undefined, [
				{
					text: "Open source",
					onPress: () => {
						void openSource();
					},
				},
				transcriptAction,
				cancelAction,
			]);
			return;
		}

		Alert.alert("Video options", undefined, [transcriptAction, cancelAction]);
	}

	if (!canQuery || isLoading) {
		return (
			<View className="flex-1 items-center justify-center bg-[#05070B]">
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
				{externalMedia ? (
					<Pressable
						className="flex-1 items-center justify-center overflow-hidden px-8"
						onPress={() => void Linking.openURL(externalMedia.externalUrl)}
						accessibilityRole="link"
					>
						{externalThumbnailUrl ? (
							<Image
								source={{ uri: externalThumbnailUrl }}
								className="absolute inset-0 h-full w-full opacity-55"
								resizeMode="contain"
							/>
						) : null}
						<View className="mb-4 size-16 items-center justify-center rounded-full bg-primary">
							<Icon name="Share" size={30} className="text-primary-foreground" />
						</View>
						<Text className="text-center text-base font-extrabold text-white">
							Open in {externalMedia.destination === "telegram" ? "Telegram" : "Facebook"}
						</Text>
					</Pressable>
				) : videoUrl ? (
					<Pressable
						className="flex-1"
						onPress={handleVideoSurfacePress}
						accessibilityRole="button"
						accessibilityLabel={
							controlsVisible ? "Hide video controls" : "Show video controls"
						}
						testID="video-controls-surface"
					>
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
				<View
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: insets.top + 12,
					}}
				>
					<View className="flex-row items-center justify-between px-6">
						<Pressable
							onPress={() => router.back()}
							accessibilityLabel="Go back"
							className="size-[52px] items-center justify-center rounded-full bg-[#1A2834] active:opacity-80"
						>
							<Icon name="ArrowLeft" size={27} color="#FFFFFF" />
						</Pressable>

						<Pressable
							onPress={handleMorePress}
							accessibilityLabel="Video options"
							className="size-[52px] items-center justify-center rounded-full bg-[#1A2834] active:opacity-80"
						>
							<Icon
								name="MoreHorizontal"
								size={28}
								className="rotate-90 text-white"
							/>
						</Pressable>
					</View>
				</View>
			) : null}

			{videoUrl && controlsVisible ? (
				<View
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: insets.bottom + VIDEO_META_BOTTOM_OFFSET,
					}}
				>
					<View className="px-6">
						<View className="mb-3 self-start rounded-lg bg-[#242424] px-3 py-1.5">
							<View className="flex-row items-center gap-1.5">
								<Text className="text-[13px] font-medium text-white/60">
									From
								</Text>
								<View className="size-5 items-center justify-center rounded-full bg-primary">
									<Text className="text-[10px] font-black text-primary-foreground">
										{sourceInitial}
									</Text>
								</View>
								<Text
									className="max-w-44 text-[13px] font-black text-white"
									numberOfLines={1}
								>
									{sourceLabel}
								</Text>
							</View>
						</View>

						<View className="mb-3 flex-row items-center gap-3">
							<View className="size-[52px] items-center justify-center rounded-full border-2 border-white bg-primary">
								<Text className="text-lg font-black text-primary-foreground">
									{channelInitial}
								</Text>
							</View>
							<View className="min-w-0 flex-1">
								<Text
									className="text-[16px] font-black text-white"
									numberOfLines={1}
								>
									{channelLabel}
								</Text>
								{channelHandle ? (
									<Text
										className="mt-0.5 text-[13px] font-medium text-white/70"
										numberOfLines={1}
									>
										{channelHandle}
									</Text>
								) : null}
							</View>
						</View>

						<Text
							className="text-[16px] font-medium leading-5 text-white"
							numberOfLines={1}
						>
							{title}
						</Text>
						{caption ? (
							<Text
								className="mt-1 text-[13px] font-medium leading-5 text-white/75"
								numberOfLines={1}
							>
								{caption}
							</Text>
						) : null}
					</View>
				</View>
			) : null}

			{controlsVisible ? (
				<View
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: insets.bottom + VIDEO_ACTIONS_BOTTOM_OFFSET,
					}}
				>
					<View className="flex-row items-center gap-2 px-6">
						<ActionButton
							icon="MessageCircle"
							label={commentCount > 0 ? String(commentCount) : "Comment"}
							onPress={() => setCommentsOpen(true)}
						/>
						<ActionButton
							icon="Heart"
							onPress={() => toggleHeart.mutate({ blogId: id, emoji: "❤️" })}
							disabled={toggleHeart.isPending}
							active={Boolean(heartReaction?.reacted)}
							shape="circle"
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
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: Math.max(insets.bottom, 0) + VIDEO_PROGRESS_BOTTOM_OFFSET,
					}}
				>
					<View className="h-[3px] bg-white/20">
						<View
							style={{
								height: "100%",
								backgroundColor: "#FFFFFF",
								width: `${progress}%`,
							}}
						/>
					</View>
				</View>
			) : null}

			{controlsVisible ? (
				<View
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: Math.max(insets.bottom, 8) + VIDEO_TRANSPORT_BOTTOM_OFFSET,
					}}
				>
					<View className="h-14 flex-row items-center px-6">
						<Pressable
							onPress={togglePlayback}
							disabled={!videoUrl}
							className="size-12 items-center justify-center active:opacity-80 disabled:opacity-40"
						>
							<View className={isPlaying ? undefined : "ml-0.5"}>
								<Icon
									name={isPlaying ? "Pause" : "Play"}
									size={isPlaying ? 34 : 32}
									color="#FFFFFF"
									fill="#FFFFFF"
								/>
							</View>
						</Pressable>
						<Text className="ml-4 w-16 text-[15px] font-bold text-white/80">
							{remainingLabel ? `-${remainingLabel}` : "-0:00"}
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
							accessibilityLabel={isMuted ? "Unmute" : "Mute"}
							className="ml-3 size-11 items-center justify-center active:opacity-80"
						>
							<Icon
								name="Volume2"
								size={30}
								color={isMuted ? "rgba(255,255,255,0.45)" : "#FFFFFF"}
							/>
						</Pressable>
						<Pressable
							onPress={presentFullscreen}
							accessibilityLabel="Enter fullscreen"
							className="ml-2 size-11 items-center justify-center active:opacity-80"
						>
							<Icon name="Fullscreen" size={29} color="#FFFFFF" />
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
