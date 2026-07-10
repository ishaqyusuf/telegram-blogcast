import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Clipboard, Share, Text, View } from "react-native";

import { CommentInput } from "@/components/comments-sheet/comment-input";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon, type IconKeys } from "@/components/ui/icon";
import { Toast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-color";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";
import { updateBlogPostInCache } from "@/lib/blog-post-cache";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
import { getBlogShareUrl } from "@/lib/share-links";
import { withAlpha } from "@/lib/theme";
import { getDefaultTranscriberUrl } from "@/lib/transcribe";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useGlobalAudioBarStore } from "@/store/global-audio-bar-store";
import { vanillaTrpc } from "@/trpc/vanilla-client";
import { getBlogHref } from "./utils";

type Props = {
	blogId: string;
	postType?: string | null;
	postTitle?: string | null;
	audioMediaId?: string | null;
	audioTelegramFileId?: string | null;
	audioUrl?: string | null;
	audioIsTranscribed?: boolean;
	audioTranscriptStatus?: string | null;
	audioTranscriptionJobStatus?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
	audio: "Audio",
	image: "Image",
	picture: "Image",
	text: "Text",
	video: "Video",
};

function ActionRow({
	label,
	description,
	icon,
	onPress,
	danger = false,
}: {
	label: string;
	description: string;
	icon: IconKeys;
	onPress: () => void;
	danger?: boolean;
}) {
	const colors = useColors();
	const actionColor = danger ? colors.destructive : colors.foreground;

	return (
		<Pressable
			haptic
			onPress={onPress}
			className="min-h-14 flex-row items-center gap-3 rounded-2xl px-3 py-2 active:bg-muted"
		>
			<View
				className="size-11 items-center justify-center rounded-full"
				style={{
					backgroundColor: danger
						? withAlpha(colors.destructive, 0.12)
						: colors.muted,
				}}
			>
				<Icon
					name={icon}
					className={danger ? "text-destructive" : "text-foreground"}
				/>
			</View>
			<View className="min-w-0 flex-1">
				<Text
					className={
						danger
							? "text-sm font-medium text-destructive"
							: "text-sm font-medium text-foreground"
					}
					style={{ color: actionColor }}
				>
					{label}
				</Text>
				<Text
					className="mt-0.5 text-xs text-muted-foreground"
					numberOfLines={1}
					style={{ color: colors.mutedForeground }}
				>
					{description}
				</Text>
			</View>
			{!danger && (
				<Icon name="ChevronRight" className="text-muted-foreground" />
			)}
		</Pressable>
	);
}

export function BlogCardOptionsSheet({
	blogId,
	postType,
	postTitle: initialPostTitle,
	audioMediaId,
	audioTelegramFileId,
	audioUrl,
	audioIsTranscribed,
	audioTranscriptStatus,
	audioTranscriptionJobStatus,
}: Props) {
	const router = useRouter();
	const colors = useColors();
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
	const { enqueue } = useTranscriptionQueue(undefined, {
		autoLoad: false,
		reloadOnEnqueue: false,
	});
	const numericBlogId = Number(blogId);
	const numericAudioMediaId = Number(audioMediaId);
	const [quickCommentVisible, setQuickCommentVisible] = useState(false);

	useEffect(() => {
		const previousHidden = useGlobalAudioBarStore.getState().hidden;
		setGlobalAudioBarHidden(true);

		return () => {
			setGlobalAudioBarHidden(previousHidden);
		};
	}, [setGlobalAudioBarHidden]);

	const onShare = async () => {
		const id = encodeURIComponent(blogId);
		let webUrl = `https://alghurobaa.com/blog/${id}`;
		try {
			webUrl = getBlogShareUrl(id);
		} catch {}
		await Share.share({
			message: `Check out this post: ${webUrl}`,
			url: webUrl,
		});
	};

	const onCopyLink = () => {
		const id = encodeURIComponent(blogId);
		let webUrl = `https://alghurobaa.com/blog/${id}`;
		try {
			webUrl = getBlogShareUrl(id);
		} catch {}
		Clipboard.setString(webUrl);
		Toast.show("Link copied", {
			type: "success",
			position: "bottom",
		});
	};

	const onComingSoon = () => {
		Alert.alert("Coming soon", "This action is not connected yet.");
	};
	const postTitle = initialPostTitle?.trim() || `Post #${blogId}`;
	const rawPostType = postType ? String(postType) : "post";
	const postTypeLabel = TYPE_LABELS[rawPostType] ?? "Post";
	const canQueueTranscription = Boolean(
		rawPostType === "audio" &&
			Number.isFinite(numericAudioMediaId) &&
			numericAudioMediaId > 0,
	);
	const isAudioAlreadyTranscribed = Boolean(
		audioIsTranscribed ||
			audioTranscriptStatus === "done" ||
			audioTranscriptionJobStatus === "completed",
	);
	const canResetTranscription = Boolean(
		canQueueTranscription && isAudioAlreadyTranscribed,
	);

	const onQueueTranscription = async () => {
		if (!canQueueTranscription) return;
		let reachableAudioUrl =
			audioUrl?.startsWith("http://") || audioUrl?.startsWith("https://")
				? audioUrl
				: null;

		if (!audioTelegramFileId && !reachableAudioUrl) {
			Alert.alert(
				"Cannot transcribe yet",
				"This audio does not have a reachable file source to queue.",
			);
			return;
		}

		try {
			if (!reachableAudioUrl && audioTelegramFileId) {
				const resolved = await getTelegramFileUrl(audioTelegramFileId);
				reachableAudioUrl =
					resolved?.url?.startsWith("http://") ||
					resolved?.url?.startsWith("https://")
						? resolved.url
						: null;
			}

			if (!reachableAudioUrl) {
				throw new Error(
					"Could not resolve a reachable audio URL for this job.",
				);
			}

			await enqueue({
				mediaId: numericAudioMediaId,
				telegramFileId: audioTelegramFileId ?? null,
				audioUrl: reachableAudioUrl,
				language: "ar",
				transcriberUrl,
			});
			if (Number.isFinite(numericBlogId)) {
				updateBlogPostInCache(numericBlogId, (post) => ({
					...post,
					audio: post.audio
						? {
								...post.audio,
								transcriptionJobStatus: "queued",
							}
						: post.audio,
				}));
			}
			Toast.show("Added to transcription queue", {
				type: "success",
				position: "bottom",
			});
			router.back();
		} catch (error) {
			Alert.alert(
				"Could not queue transcription",
				error instanceof Error
					? error.message
					: "This audio could not be added to the transcription queue.",
			);
		}
	};

	const onTranscribePress = () => {
		if (!isAudioAlreadyTranscribed) {
			void onQueueTranscription();
			return;
		}

		Alert.alert(
			"Already transcribed",
			"This audio already has a transcript. Do you want to retranscribe it?",
			[
				{ text: "No", style: "cancel" },
				{
					text: "Retranscribe",
					onPress: () => {
						void onQueueTranscription();
					},
				},
			],
		);
	};

	const onResetTranscription = () => {
		if (!canResetTranscription) return;
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
							await vanillaTrpc.blog.resetTranscript.mutate({
								mediaId: numericAudioMediaId,
							});
							if (Number.isFinite(numericBlogId)) {
								updateBlogPostInCache(numericBlogId, (post) => ({
									...post,
									audio: post.audio
										? {
												...post.audio,
												transcriptStatus: null,
												transcriptionJobStatus: "",
												transcriptSegments: [],
												isTranscribed: false,
											}
										: post.audio,
								}));
							}
							Toast.show("Transcription reset", {
								type: "success",
								position: "bottom",
							});
							Alert.alert("Queue for transcribing", undefined, [
								{
									text: "No",
									style: "cancel",
									onPress: () => router.back(),
								},
								{
									text: "Yes",
									onPress: () => {
										void onQueueTranscription();
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
		<FloatingBottomSheet
			visible
			onClose={() => router.back()}
			accessibilityLabel="Post options"
		>
			<View className="px-4 pb-8">
				<View className="pb-4">
					<View className="mb-3 flex-row items-center gap-2">
						<View
							className="rounded-full px-2.5 py-1"
							style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
						>
							<Text
								className="text-xs font-semibold text-primary"
								style={{ color: colors.primary }}
							>
								{postTypeLabel}
							</Text>
						</View>
						<Text
							className="text-xs text-muted-foreground"
							style={{ color: colors.mutedForeground }}
						>
							#{blogId}
						</Text>
					</View>
					<Text
						className="text-xl font-semibold text-foreground"
						numberOfLines={2}
						style={{ color: colors.foreground }}
					>
						Post options
					</Text>
					<Text
						className="mt-1 text-sm leading-5 text-muted-foreground"
						numberOfLines={2}
						style={{ color: colors.mutedForeground }}
					>
						{postTitle}
					</Text>
				</View>

				<View className="gap-1">
					<ActionRow
						label="Open post"
						description="View the full post and media"
						icon="FileText"
						onPress={() => {
							router.replace(
								getBlogHref({
									id: numericBlogId || Number(blogId),
									type: rawPostType,
								} as any) as any,
							);
						}}
					/>
					<ActionRow
						label="Share"
						description="Send a web link to this post"
						icon="Share"
						onPress={onShare}
					/>
					<ActionRow
						label="Copy link"
						description="Paste it in comments to show a preview"
						icon="Copy"
						onPress={onCopyLink}
					/>
					<ActionRow
						label="Comment"
						description="Add a quick comment"
						icon="MessageSquare"
						onPress={() => {
							setQuickCommentVisible((visible) => !visible);
						}}
					/>
					{quickCommentVisible && Number.isFinite(numericBlogId) ? (
						<View
							className="overflow-hidden rounded-2xl border border-border"
							style={{ borderColor: colors.border }}
						>
							<CommentInput
								blogId={numericBlogId}
								compact
								noKeyboardAvoid
								autoFocus
								onClose={() => setQuickCommentVisible(false)}
								onCommentAdded={() => setQuickCommentVisible(false)}
							/>
						</View>
					) : null}
					{canQueueTranscription ? (
						<ActionRow
							label="Transcribe"
							description="Queue this audio for local Whisper"
							icon="Captions"
							onPress={onTranscribePress}
						/>
					) : null}
					{canResetTranscription ? (
						<ActionRow
							label="Reset transcribe"
							description="Clear saved transcript and queue jobs"
							icon="RotateCcw"
							onPress={onResetTranscription}
						/>
					) : null}
					<ActionRow
						label="Save"
						description="Keep this post in saved items"
						icon="Bookmark"
						onPress={onComingSoon}
					/>
					<ActionRow
						label="Like"
						description="Add this post to liked items"
						icon="Heart"
						onPress={onComingSoon}
					/>
				</View>

				<View
					className="my-3 h-px"
					style={{ backgroundColor: colors.border }}
				/>

				<ActionRow
					label="Delete post"
					description="Remove this post from the blog list"
					icon="Trash2"
					danger
					onPress={onComingSoon}
				/>
			</View>
		</FloatingBottomSheet>
	);
}
