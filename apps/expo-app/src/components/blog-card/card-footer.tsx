import { Pressable } from "@/components/ui/pressable";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { getAudioPlayability } from "@/lib/audio-playability";
import { withAlpha } from "@/lib/theme";
import { getTranscriptionBadgeState } from "@/lib/transcription-status";
import { useAudioStore } from "@/store/audio-store";

import type { BlogItem } from "./types";

export function CardFooter({
	post,
	onAddToAlbum,
}: {
	post: BlogItem;
	onAddToAlbum?: (post: BlogItem) => void;
}) {
	const tags = post.tags?.slice(0, 2) ?? [];
	const router = useRouter();
	const colors = useColors();
	const loadedBlogId = useAudioStore((s) => s.blog?.id);
	const globalIsPlaying = useAudioStore((s) => s.isPlaying);
	const globalIsLoading = useAudioStore((s) => s.isLoading);
	const globalIsDownloading = useAudioStore((s) => s.isDownloading);
	const pauseAudio = useAudioStore((s) => s.pause);
	const playAudio = useAudioStore((s) => s.play);
	const loadAudio = useAudioStore((s) => s.loadAudio);
	const [playbackPending, setPlaybackPending] = useState(false);
	const hasAudioSource = !!(
		post.audio?.telegramFileId || (post.audio as any)?.url
	);
	const isCurrent = loadedBlogId === post.id;
	const isPlaying = isCurrent && globalIsPlaying;
	const isLoading =
		playbackPending ||
		(isCurrent && (globalIsLoading || globalIsDownloading));
	const audioPlayability = getAudioPlayability(post.audio as any);
	const isPlayBlocked = !audioPlayability.canPlay;
	const isPlayControlDisabled = isLoading || isPlayBlocked;
	const albumName = (post.audio as any)?.albumName as string | null | undefined;
	const albumId = (post.audio as any)?.albumId as number | null | undefined;
	const transcriptBadge = getTranscriptionBadgeState(post.audio as any);
	const transcriptColor =
		transcriptBadge.tone === "success"
			? colors.success
			: transcriptBadge.tone === "warn"
				? colors.warn
				: transcriptBadge.tone === "muted"
					? colors.mutedForeground
					: colors.primary;
	const canAddToAlbum = Boolean(
		post.audio?.mediaId && !albumName && !albumId && onAddToAlbum,
	);
	const externalMedia = (post as any).externalMedia;
	const playPause = useCallback(async () => {
		if (isPlayControlDisabled) return;

		if (isPlaying) {
			await pauseAudio();
			return;
		}

		if (isCurrent) {
			await playAudio();
			return;
		}

		setPlaybackPending(true);
		try {
			await loadAudio(post as any);
			if (!useAudioStore.getState().error) {
				await useAudioStore.getState().play();
			}
		} finally {
			setPlaybackPending(false);
		}
	}, [
		isCurrent,
		isPlayControlDisabled,
		isPlaying,
		loadAudio,
		pauseAudio,
		playAudio,
		post,
	]);

	if (externalMedia?.externalUrl) {
		const destinationLabel =
			externalMedia.destination === "telegram" ? "Telegram" : "Facebook";
		return (
			<View className="mt-3 flex-row justify-end">
				<Pressable
					onPress={(event) => {
						event.stopPropagation();
						void Linking.openURL(externalMedia.externalUrl);
					}}
					className="min-h-11 flex-row items-center gap-2 rounded-full bg-primary px-4"
				>
					<Icon name="Share" size={16} className="text-primary-foreground" />
					<Text className="text-xs font-extrabold text-primary-foreground">
						Open in {destinationLabel}
					</Text>
				</Pressable>
			</View>
		);
	}

	if (hasAudioSource) {
		return (
			<View className="mt-3 flex-row items-center gap-1">
				{transcriptBadge.show ? (
					<View
						className="size-7 items-center justify-center rounded-full"
						style={{ backgroundColor: withAlpha(transcriptColor, 0.14) }}
					>
						<Icon name="FileText" size={14} color={transcriptColor} />
					</View>
				) : null}
				{albumName ? (
					<Pressable
						disabled={!albumId}
						onPress={(e) => {
							e.stopPropagation();
							if (albumId) {
								router.push(`/albums/${albumId}` as any);
							}
						}}
						className="max-w-[108px] rounded-full bg-primary/10 px-2 py-0.5"
						style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
					>
						<Text
							className="text-[10px] font-semibold text-primary"
							numberOfLines={1}
							style={{
								color: colors.primary,
								includeFontPadding: false,
								textAlignVertical: "center",
							}}
						>
							{albumName}
						</Text>
					</Pressable>
				) : null}
				{canAddToAlbum ? (
					<Pressable
						onPress={(e) => {
							e.stopPropagation();
							onAddToAlbum?.(post);
						}}
						className="size-7 items-center justify-center rounded-full bg-primary/10 active:opacity-70"
						style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
					>
						<Icon name="Plus" size={14} className="text-primary" />
					</Pressable>
				) : null}
				<View className="flex-1" />
				<Pressable className="min-h-11 flex-row items-center gap-1 rounded-full px-2 active:bg-muted">
					<Icon name="Heart" className="text-muted-foreground" />
				</Pressable>
				<Pressable className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted">
					<Icon name="Bookmark" className="text-muted-foreground" />
				</Pressable>
				<Pressable className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted">
					<Icon name="Share" className="text-muted-foreground" />
				</Pressable>
				<Pressable
					className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted"
					accessibilityLabel={audioPlayability.reason ?? "Play audio"}
					disabled={isPlayControlDisabled}
					onPress={(e) => {
						e.stopPropagation();
						void playPause();
					}}
					style={{
						backgroundColor: isPlayBlocked
							? colors.muted
							: withAlpha(colors.primary, isCurrent ? 0.18 : 0.1),
						opacity: isPlayBlocked ? 0.62 : 1,
					}}
				>
					{isLoading ? (
						<ActivityIndicator size="small" color={colors.primary} />
					) : (
						<Icon
							name={isPlayBlocked ? "Lock" : isPlaying ? "Pause" : "Play"}
							color={isPlayBlocked ? colors.mutedForeground : colors.primary}
						/>
					)}
				</Pressable>
			</View>
		);
	}

	return (
		<View className="mt-3 flex-row items-center justify-between gap-3">
			<View className="min-w-0 flex-1 flex-row gap-2">
				{tags.map((tag, idx) => (
					<View
						key={`${tag}-${idx}`}
						className="max-w-[46%] rounded-full bg-accent/10 px-2.5 py-1"
						style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
					>
						<Text
							className="text-xs font-medium text-accent"
							numberOfLines={1}
							style={{ color: colors.primary }}
						>
							#{tag}
						</Text>
					</View>
				))}
			</View>

			<View className="flex-row items-center gap-1">
				<Pressable className="min-h-11 flex-row items-center gap-1 rounded-full px-2 active:bg-muted">
					<Icon name="Heart" className="text-muted-foreground" />
				</Pressable>
				<Pressable className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted">
					<Icon name="Bookmark" className="text-muted-foreground" />
				</Pressable>
				<Pressable className="min-h-11 min-w-11 items-center justify-center rounded-full active:bg-muted">
					<Icon name="Share" className="text-muted-foreground" />
				</Pressable>
			</View>
		</View>
	);
}
