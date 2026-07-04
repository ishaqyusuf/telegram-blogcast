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
import { useQuery } from "@/lib/react-query";
import { withAlpha } from "@/lib/theme";
import {
	getDefaultTranscriberUrl,
	isHttpTranscriberUrl,
} from "@/lib/transcribe";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { formatDate } from "@acme/utils/dayjs";
import { type AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Linking,
	Modal,
	Platform,
	ScrollView,
	Share,
	Text,
	TouchableWithoutFeedback,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BlogMedia = NonNullable<
	ReturnType<typeof _trpc.blog.getBlog.queryOptions>["queryFn"]
> extends (...args: any[]) => Promise<infer Blog>
	? Blog extends { medias?: (infer Media)[] }
		? Media
		: never
	: never;

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
}: {
	icon: "MessageCircle" | "Share" | "Compass" | "Captions";
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			className="items-center gap-1.5 active:opacity-80 disabled:opacity-40"
		>
			<View className="size-12 items-center justify-center rounded-full bg-black/45">
				<Icon name={icon} size={22} className="text-white" />
			</View>
			<Text className="max-w-[56px] text-center text-[11px] font-extrabold text-white">
				{label}
			</Text>
		</Pressable>
	);
}

function MediaRail({
	items,
	activeKey,
	onSelect,
}: {
	items: any[];
	activeKey: string;
	onSelect: (media: any) => void;
}) {
	if (items.length === 0) return null;

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ gap: 10, paddingRight: 24 }}
			className="mt-4"
		>
			{items.map((item) => {
				const key = getMediaKey(item);
				const active = key === activeKey;
				const duration = formatDuration(item?.file?.duration ?? item?.duration);
				return (
					<Pressable
						key={key || String(item?.id)}
						onPress={() => onSelect(item)}
						className="h-20 w-24 overflow-hidden rounded-xl border bg-black/50"
						style={{
							borderColor: active ? "white" : "rgba(255,255,255,0.2)",
						}}
					>
						<LinearGradient
							colors={["rgba(255,255,255,0.18)", "rgba(0,0,0,0.25)"]}
							className="flex-1 justify-between p-2"
						>
							<View className="size-7 items-center justify-center rounded-full bg-white/20">
								<Icon name="Play" size={14} className="text-white" />
							</View>
							<Text
								numberOfLines={2}
								className="text-[10px] font-bold leading-3 text-white"
							>
								{item?.title || item?.file?.fileName || "Video"}
							</Text>
							{duration ? (
								<Text className="text-[9px] font-bold text-white/75">
									{duration}
								</Text>
							) : null}
						</LinearGradient>
					</Pressable>
				);
			})}
		</ScrollView>
	);
}

export default function VideoBlogScreen() {
	const { blogId } = useLocalSearchParams<{ blogId?: string }>();
	const router = useRouter();
	const colors = useColors();
	const insets = useSafeAreaInsets();
	const videoRef = useRef<Video>(null);
	const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
	const [selectedMediaKey, setSelectedMediaKey] = useState<string | null>(null);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [transcriptionModalOpen, setTranscriptionModalOpen] = useState(false);
	const [isQueueingTranscription, setIsQueueingTranscription] = useState(false);
	const localTranscriberBaseUrl = useAppSettingsStore(
		(s) => s.localTranscriberBaseUrl,
	);
	const transcriberUrl = getDefaultTranscriberUrl(localTranscriberBaseUrl);
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

	const videoMediaItems = useMemo(() => {
		const media = (blog?.medias ?? []) as any[];
		const videos = media.filter(isVideoMedia);
		return videos.length > 0 ? videos : media;
	}, [blog]);

	const defaultMedia = useMemo(() => getVideoMedia(blog), [blog]);
	const media = useMemo(() => {
		if (!selectedMediaKey) return defaultMedia;
		return (
			videoMediaItems.find((item) => getMediaKey(item) === selectedMediaKey) ??
			defaultMedia
		);
	}, [defaultMedia, selectedMediaKey, videoMediaItems]);

	const mediaFile = media?.file;
	const videoUrl = getMediaFileUrl(mediaFile);
	const mediaId = media?.id;
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
	const sourceUrl = (blog as any)?.sourceUrl;
	const isPlaying = Boolean(loadedStatus?.isPlaying);
	const activeMediaKey = getMediaKey(media);
	const {
		enqueue: enqueueTranscription,
		jobs: transcriptionJobs,
		reload: reloadTranscriptionJobs,
	} = useTranscriptionQueue(mediaId, {
		autoLoad: Boolean(mediaId),
		reloadOnEnqueue: false,
	});
	const latestTranscriptionJob = transcriptionJobs.find(
		(job) => job.mediaId === mediaId,
	);
	const transcriptionStatusLabel = latestTranscriptionJob
		? `Latest job: ${latestTranscriptionJob.status}`
		: canCheckTranscriber
			? "Ready to queue with local Whisper"
			: "Local transcriber URL is not configured";

	async function togglePlayback() {
		if (!videoRef.current) return;
		if (loadedStatus?.isPlaying) {
			await videoRef.current.pauseAsync();
			return;
		}
		await videoRef.current.playAsync();
	}

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
					<Pressable className="flex-1" onPress={togglePlayback}>
						<Video
							key={activeMediaKey || videoUrl}
							ref={videoRef}
							source={{ uri: videoUrl }}
							style={{ flex: 1 }}
							resizeMode={ResizeMode.CONTAIN}
							progressUpdateIntervalMillis={500}
							onPlaybackStatusUpdate={setStatus}
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

			<LinearGradient
				pointerEvents="none"
				colors={["rgba(0,0,0,0.72)", "transparent", "rgba(0,0,0,0.88)"]}
				locations={[0, 0.38, 1]}
				className="absolute inset-0"
			/>

			<View
				className="absolute inset-x-0 flex-row items-center gap-3 px-4"
				style={{ top: insets.top + 10 }}
			>
				<Pressable
					onPress={() => router.back()}
					className="size-11 items-center justify-center rounded-full bg-black/40"
				>
					<Icon name="ChevronLeft" size={22} className="text-white" />
				</Pressable>

				<View className="flex-1 flex-row items-center justify-center gap-3">
					<Text className="text-sm font-bold text-white/65">For you</Text>
					<View className="h-1.5 w-1.5 rounded-full bg-primary" />
					<Text className="text-sm font-extrabold text-white" numberOfLines={1}>
						{channelLabel}
					</Text>
				</View>

				<Pressable
					onPress={() => router.push("/search")}
					className="size-11 items-center justify-center rounded-full bg-black/40"
				>
					<Icon name="Search" size={20} className="text-white" />
				</Pressable>
			</View>

			{videoUrl ? (
				<View className="absolute inset-0 items-center justify-center">
					<Pressable
						onPress={togglePlayback}
						className="size-20 items-center justify-center rounded-full bg-black/35 active:opacity-80"
						style={{ opacity: isPlaying ? 0 : 1 }}
					>
						<Icon name="Play" size={40} className="text-white" />
					</Pressable>
				</View>
			) : null}

			<View
				className="absolute right-4 items-center gap-5"
				style={{ bottom: insets.bottom + 190 }}
			>
				<ActionButton
					icon="Captions"
					label="Transcribe"
					onPress={() => setTranscriptionModalOpen(true)}
					disabled={!mediaId}
				/>
				<ActionButton
					icon="MessageCircle"
					label={commentCount > 0 ? String(commentCount) : "Comment"}
					onPress={() => setCommentsOpen(true)}
				/>
				<ActionButton icon="Share" label="Share" onPress={shareVideo} />
				<ActionButton
					icon="Compass"
					label="Source"
					onPress={openSource}
					disabled={!sourceUrl}
				/>
			</View>

			<View
				className="absolute inset-x-0 px-5"
				style={{ bottom: insets.bottom + 18 }}
			>
				<View className="mb-3 flex-row items-center gap-2">
					<View
						className="size-9 items-center justify-center rounded-full"
						style={{ backgroundColor: withAlpha(colors.primary, 0.9) }}
					>
						<Icon name="Play" size={18} className="text-primary-foreground" />
					</View>
					<View className="flex-1">
						<Text
							className="text-sm font-extrabold text-white"
							numberOfLines={1}
						>
							{channelLabel}
						</Text>
						<Text className="text-[11px] font-semibold text-white/65">
							{[
								durationLabel ? `Video ${durationLabel}` : "Video",
								date ? formatDate(date, "D MMM YYYY") : null,
							]
								.filter(Boolean)
								.join(" - ")}
						</Text>
					</View>
				</View>

				<Text
					className="pr-20 text-lg font-extrabold leading-6 text-white"
					numberOfLines={2}
				>
					{title}
				</Text>

				{caption ? (
					<Text
						className="mt-1 pr-20 text-xs font-medium leading-5 text-white/72"
						numberOfLines={2}
					>
						{caption}
					</Text>
				) : null}

				{tags.length > 0 ? (
					<View className="mt-3 flex-row flex-wrap gap-2 pr-16">
						{tags.slice(0, 4).map((tag: string) => (
							<View
								key={tag}
								className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1"
							>
								<Text className="text-[11px] font-bold text-white">#{tag}</Text>
							</View>
						))}
					</View>
				) : null}

				<MediaRail
					items={videoMediaItems}
					activeKey={activeMediaKey}
					onSelect={(item) => {
						setSelectedMediaKey(getMediaKey(item));
						setStatus(null);
					}}
				/>

				<View className="mt-4 flex-row items-center gap-2">
					<Text className="w-11 text-[10px] font-bold text-white/65">
						{positionLabel ?? "0:00"}
					</Text>
					<View className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
						<View
							className="h-full rounded-full bg-primary"
							style={{ width: `${progress}%` }}
						/>
					</View>
					<Text className="w-11 text-right text-[10px] font-bold text-white/65">
						{durationLabel ?? "0:00"}
					</Text>
				</View>
			</View>

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
