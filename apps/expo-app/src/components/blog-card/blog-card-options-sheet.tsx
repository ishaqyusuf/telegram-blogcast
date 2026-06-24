import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, Share, Text, View } from "react-native";

import { Icon, type IconKeys } from "@/components/ui/icon";
import { Toast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-color";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";
import { getWebUrl } from "@/lib/base-url";
import { updateBlogPostInCache } from "@/lib/blog-post-cache";
import { getTelegramFileUrl } from "@/lib/get-telegram-file";
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
	const transcriberUrl = getDefaultTranscriberUrl(localTranscriberBaseUrl);
	const { enqueue } = useTranscriptionQueue(undefined, {
		autoLoad: false,
		reloadOnEnqueue: false,
	});
	const numericBlogId = Number(blogId);
	const numericAudioMediaId = Number(audioMediaId);

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
			webUrl = `${getWebUrl()}/blog/${id}`;
		} catch {}
		await Share.share({
			message: `Check out this post: ${webUrl}`,
			url: webUrl,
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
	const canResetTranscription = Boolean(
		canQueueTranscription &&
			(audioIsTranscribed ||
				audioTranscriptStatus === "done" ||
				audioTranscriptionJobStatus === "completed"),
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
							router.back();
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
			className="flex-1 justify-end"
			style={{ backgroundColor: withAlpha(colors.foreground, 0.4) }}
		>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Close post options"
				className="flex-1"
				onPress={() => router.back()}
			/>
			<View
				className="rounded-t-[28px] border border-border bg-card px-4 pb-8 shadow-lg"
				style={{
					backgroundColor: colors.card,
					borderColor: colors.border,
					maxHeight: "82%",
				}}
			>
				<View className="items-center py-3.5">
					<View
						className="h-1 w-11 rounded-full bg-muted"
						style={{ backgroundColor: colors.muted }}
					/>
				</View>

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
						label="Comment"
						description="Open the discussion for this post"
						icon="MessageSquare"
						onPress={() => {
							router.replace({
								pathname: getBlogHref({
									id: numericBlogId || Number(blogId),
									type: rawPostType,
								} as any) as any,
								params: { openComments: "1" },
							});
						}}
					/>
					{canQueueTranscription ? (
						<ActionRow
							label="Transcribe"
							description="Queue this audio for local Whisper"
							icon="Captions"
							onPress={() => {
								void onQueueTranscription();
							}}
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
		</View>
	);
}
